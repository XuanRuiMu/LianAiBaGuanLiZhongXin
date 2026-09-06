import asyncio
import time
from typing import Any, Literal

import anyio
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage
from langgraph.graph import END, START, StateGraph
from langgraph.graph.state import CompiledStateGraph
from langgraph.types import Command, interrupt

import app.prompts as prompts
import app.texts as texts
from app.agent.state import AgentState
from app.agent.tools import 执行单个工具调用, 工具列表
from app.config import 取配置
from app.llm import 创建聊天模型

审批关键词 = ("删除", "导出全量", "清空", "封禁", "审批")


def _轨迹(节点: str, 事件: str) -> dict:
    return {"轨迹": [{"节点": 节点, "事件": 事件, "时间": time.strftime("%H:%M:%S")}]}


def 规划路由(state: AgentState, 最大轮数: int) -> Literal["execute_tools", "generate"]:
    if state.get("iterations", 0) >= 最大轮数:
        return "generate"
    if getattr(state["messages"][-1], "tool_calls", None):
        return "execute_tools"
    return "generate"


def 工具结果路由(state: AgentState, 反思上限: int = 1) -> Literal["reflect", "plan"]:
    if state.get("reflections", 0) >= 反思上限:
        return "plan"
    消息们 = state["messages"]
    for 索引 in range(len(消息们) - 1, -1, -1):
        调用们 = getattr(消息们[索引], "tool_calls", None)
        if not 调用们:
            continue
        本轮结果 = [m for m in 消息们[索引 + 1:] if isinstance(m, ToolMessage)]
        for 结果 in 本轮结果[: len(调用们)]:
            if 结果.name != "search_knowledge":
                continue
            内容文本 = 结果.content if isinstance(结果.content, str) else ""
            if 内容文本.startswith(texts.标记_检索无结果) or 内容文本.startswith(texts.标记_工具错误):
                return "reflect"
        return "plan"
    return "plan"


def _读记忆(会话号: str) -> str:
    if not 会话号:
        return ""
    try:
        from app.记忆.记忆库 import 取记忆库
        情景 = 取记忆库().读情景(会话号)
        摘要 = str(情景.get("摘要", ""))
        return f"【历史摘要】{摘要}" if 摘要 else ""
    except Exception:
        return ""


def _语义回忆(问题: str) -> str:
    try:
        from app.记忆.检索链 import 混合检索
        命中 = 混合检索(问题, 条数=3)
        if not 命中:
            return ""
        条目 = "\n".join(f"- {行['文本']}（来源：{行['来源']}）" for 行 in 命中)
        return f"【语义回忆】\n{条目}"
    except Exception:
        return ""


def _后台压缩记忆(会话号: str, 问题: str, 回答: str) -> None:
    async def _跑():
        try:
            def _写():
                from app.记忆.记忆库 import 取记忆库
                库 = 取记忆库()
                旧 = 库.读情景(会话号)
                新摘要 = (旧.get("摘要", "") + f"\n问：{问题[:100]}\n答：{回答[:100]}")[-2000:]
                库.写情景(会话号, 新摘要, int(旧.get("轮数", 0)) + 1)
            await anyio.to_thread.run_sync(_写)
        except Exception:
            pass
    try:
        asyncio.get_running_loop().create_task(_跑())
    except RuntimeError:
        pass


async def 构建分析图谱(基础模型: BaseChatModel | None = None,
                       检查点路径: str = "./data/检查点.db") -> CompiledStateGraph:
    配置 = 取配置()
    模型 = 基础模型 or 创建聊天模型()
    带工具模型 = 模型.bind_tools(工具列表)

    async def 主管节点(state: AgentState) -> dict:
        问题 = state.get("question", "")
        if any(词 in 问题 for 词 in 审批关键词):
            return {"决策": "需审批", "需审批": True, **_轨迹("supervisor", "需审批")}
        return {"决策": "检索数据", "需审批": False, **_轨迹("supervisor", "检索数据")}

    async def 计划节点(state: AgentState) -> dict:
        if state.get("需审批"):
            审批请求 = interrupt({"事由": "高风险意图需人工确认", "问题": state.get("question", "")})
            return {"计划": ["已审批"], **_轨迹("planner", f"审批结果：{审批请求}")}
        问题 = state.get("question", "")
        会话号 = state.get("会话号", "")
        记忆上下文 = await anyio.to_thread.run_sync(_读记忆, 会话号)
        语义 = await anyio.to_thread.run_sync(_语义回忆, 问题)
        合并 = "\n".join(p for p in (记忆上下文, 语义) if p)
        计划 = ["调用工具获取数据", "汇总作答"]
        if 语义:
            计划.insert(0, "参考语义回忆")
        return {"计划": 计划, "记忆上下文": 合并, **_轨迹("planner", "计划已生成")}

    async def 规划节点(state: AgentState) -> dict:
        上下文 = state.get("记忆上下文", "")
        提示 = ([SystemMessage(content=prompts.系统提示词 + ("\n" + 上下文 if 上下文 else ""))]
                + state["messages"])
        响应 = await 带工具模型.ainvoke(提示)
        return {"messages": [响应], "iterations": state.get("iterations", 0) + 1,
                **_轨迹("plan", "已规划")}

    async def 执行工具节点(state: AgentState) -> dict:
        最后消息 = state["messages"][-1]
        结果们 = await asyncio.gather(
            *(执行单个工具调用(调用) for 调用 in getattr(最后消息, "tool_calls", []))
        )
        return {"messages": list(结果们), **_轨迹("execute_tools", "工具已执行")}

    async def 反思节点(state: AgentState) -> dict:
        问题 = state.get("question") or ""
        回复 = await 模型.ainvoke(
            [
                SystemMessage(content=prompts.反思提示词.format(question=问题)),
                HumanMessage(content=问题),
            ]
        )
        新检索词 = texts.提取文本(回复.content).strip()[:50] or 问题[:50]
        return {
            "messages": [SystemMessage(content=texts.反思指令模板.format(query=新检索词))],
            "reflections": state.get("reflections", 0) + 1,
            **_轨迹("reflect", "已反思"),
        }

    async def 生成节点(state: AgentState) -> dict:
        最后消息 = state["messages"][-1]
        if isinstance(最后消息, AIMessage) and not getattr(最后消息, "tool_calls", None):
            return {}
        回复 = await 模型.ainvoke([*state["messages"], SystemMessage(content=texts.最终总结指令)])
        文本 = texts.提取文本(回复.content)
        会话号 = state.get("会话号", "")
        if 会话号:
            _后台压缩记忆(会话号, state.get("question", ""), 文本)
        return {"messages": [回复], **_轨迹("generate", "已生成")}

    async def 综合节点(state: AgentState) -> dict:
        return dict(await 生成节点(state), **_轨迹("synthesizer", "已综合"))

    图谱 = StateGraph(AgentState)
    图谱.add_node("supervisor", 主管节点)
    图谱.add_node("planner", 计划节点)
    图谱.add_node("plan", 规划节点)
    图谱.add_node("execute_tools", 执行工具节点)
    图谱.add_node("reflect", 反思节点)
    图谱.add_node("generate", 生成节点)
    图谱.add_node("synthesizer", 综合节点)
    图谱.add_edge(START, "supervisor")
    图谱.add_edge("supervisor", "planner")
    图谱.add_edge("planner", "plan")
    图谱.add_conditional_edges("plan", lambda s: 规划路由(s, 配置.MAX_ITERATIONS), ["execute_tools", "generate"])
    图谱.add_conditional_edges("execute_tools", 工具结果路由, ["reflect", "plan"])
    图谱.add_edge("reflect", "plan")
    图谱.add_edge("generate", "synthesizer")
    图谱.add_edge("synthesizer", END)

    import aiosqlite
    from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver
    连接 = await aiosqlite.connect(检查点路径)
    检查点 = AsyncSqliteSaver(conn=连接)
    return 图谱.compile(checkpointer=检查点)
