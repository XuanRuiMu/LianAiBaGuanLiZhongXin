from langchain_core.language_models.fake_chat_models import FakeListChatModel
from langchain_core.messages import AIMessage, HumanMessage

from app.agent.graph import 构建分析图谱, 工具结果路由, 规划路由


class 假聊天模型(FakeListChatModel):
    def bind_tools(self, tools, **kwargs):
        return self


async def 测试_图谱编译成功且节点齐全():
    图谱 = 构建分析图谱(假聊天模型(responses=["好的"]))
    节点名 = set(图谱.nodes.keys())
    assert {"plan", "execute_tools", "reflect", "generate"} <= 节点名


async def 测试_假模型直答链路跑通():
    回复文本 = "根据现有数据显示，今日运营平稳。"
    图谱 = 构建分析图谱(假聊天模型(responses=[回复文本]))
    问题 = "今天运营情况如何"
    结果 = await 图谱.ainvoke({"messages": [HumanMessage(问题)], "question": 问题})
    最后消息 = 结果["messages"][-1]
    assert isinstance(最后消息, AIMessage)
    assert 最后消息.content == 回复文本
    assert 结果["iterations"] == 1
    assert 结果.get("reflections", 0) == 0


def 测试_路由_无工具调用走生成():
    state = {"messages": [AIMessage(content="结论")], "iterations": 1}
    assert 规划路由(state, 最大轮数=6) == "generate"


def 测试_路由_有工具调用走执行():
    带调用 = AIMessage(content="", tool_calls=[{"name": "query_overview", "args": {}, "id": "t1"}])
    state = {"messages": [带调用], "iterations": 1}
    assert 规划路由(state, 最大轮数=6) == "execute_tools"


def 测试_路由_达到最大轮数强制生成():
    带调用 = AIMessage(content="", tool_calls=[{"name": "query_overview", "args": {}, "id": "t2"}])
    state = {"messages": [带调用], "iterations": 6}
    assert 规划路由(state, 最大轮数=6) == "generate"


def 测试_工具结果路由_检索未命中触发反思():
    带调用 = AIMessage(content="", tool_calls=[{"name": "search_knowledge", "args": {"query": "测试"}, "id": "t3"}])
    from langchain_core.messages import ToolMessage

    state = {
        "messages": [
            带调用,
            ToolMessage(content="[KNOWLEDGE_EMPTY] 知识库中没有找到相关内容。", name="search_knowledge", tool_call_id="t3"),
        ],
        "reflections": 0,
    }
    assert 工具结果路由(state) == "reflect"


def 测试_工具结果路由_已反思过不再反思():
    带调用 = AIMessage(content="", tool_calls=[{"name": "search_knowledge", "args": {"query": "测试"}, "id": "t4"}])
    from langchain_core.messages import ToolMessage

    state = {
        "messages": [
            带调用,
            ToolMessage(content="[KNOWLEDGE_EMPTY] 知识库中没有找到相关内容。", name="search_knowledge", tool_call_id="t4"),
        ],
        "reflections": 1,
    }
    assert 工具结果路由(state) == "plan"


def 测试_工具结果路由_正常数据回规划():
    带调用 = AIMessage(content="", tool_calls=[{"name": "query_overview", "args": {}, "id": "t5"}])
    from langchain_core.messages import ToolMessage

    state = {
        "messages": [
            带调用,
            ToolMessage(content='{"total_users": 100}', name="query_overview", tool_call_id="t5"),
        ],
        "reflections": 0,
    }
    assert 工具结果路由(state) == "plan"
