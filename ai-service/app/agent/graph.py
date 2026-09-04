import asyncio
from typing import Any, Literal

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage
from langgraph.graph import END, START, StateGraph
from langgraph.graph.state import CompiledStateGraph

import app.prompts as prompts
import app.texts as texts
from app.agent.state import AgentState
from app.agent.tools import 执行单个工具调用, 工具列表
from app.config import 取配置
from app.llm import 创建聊天模型


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
        本轮结果 = [m for m in 消息们[索引 + 1 :] if isinstance(m, ToolMessage)]
        for 结果 in 本轮结果[: len(调用们)]:
            if 结果.name != "search_knowledge":
                continue
            内容文本 = 结果.content if isinstance(结果.content, str) else ""
            if 内容文本.startswith(texts.标记_检索无结果) or 内容文本.startswith(texts.标记_工具错误):
                return "reflect"
        return "plan"
    return "plan"


def 构建分析图谱(基础模型: BaseChatModel | None = None) -> CompiledStateGraph:
    配置 = 取配置()
    模型 = 基础模型 or 创建聊天模型()
    带工具模型 = 模型.bind_tools(工具列表)

    async def 规划节点(state: AgentState) -> dict:
        响应 = await 带工具模型.ainvoke(state["messages"])
        return {"messages": [响应], "iterations": state.get("iterations", 0) + 1}

    async def 执行工具节点(state: AgentState) -> dict:
        最后消息 = state["messages"][-1]
        结果们 = await asyncio.gather(
            *(执行单个工具调用(调用) for 调用 in getattr(最后消息, "tool_calls", []))
        )
        return {"messages": list(结果们)}

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
        }

    async def 生成节点(state: AgentState) -> dict:
        最后消息 = state["messages"][-1]
        if isinstance(最后消息, AIMessage) and not getattr(最后消息, "tool_calls", None):
            return {}
        回复 = await 模型.ainvoke([*state["messages"], SystemMessage(content=texts.最终总结指令)])
        return {"messages": [回复]}

    图谱 = StateGraph(AgentState)
    图谱.add_node("plan", 规划节点)
    图谱.add_node("execute_tools", 执行工具节点)
    图谱.add_node("reflect", 反思节点)
    图谱.add_node("generate", 生成节点)
    图谱.add_edge(START, "plan")
    图谱.add_conditional_edges("plan", lambda s: 规划路由(s, 配置.MAX_ITERATIONS), ["execute_tools", "generate"])
    图谱.add_conditional_edges("execute_tools", 工具结果路由, ["reflect", "plan"])
    图谱.add_edge("reflect", "plan")
    图谱.add_edge("generate", END)
    return 图谱.compile()
