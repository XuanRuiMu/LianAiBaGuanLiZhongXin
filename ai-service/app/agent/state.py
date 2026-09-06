from typing import Annotated, TypedDict

from langchain_core.messages import AnyMessage
from langgraph.graph.message import add_messages


from typing import Annotated, Any, Literal, TypedDict

from langchain_core.messages import AnyMessage
from langgraph.graph.message import add_messages


def 追加轨迹(旧: list[dict] | None, 新: list[dict]) -> list[dict]:
    return (旧 or []) + 新


class AgentState(TypedDict, total=False):
    messages: Annotated[list[AnyMessage], add_messages]
    question: str
    iterations: int
    reflections: int
    决策: Literal["直接回答", "检索数据", "检索知识", "需审批"] | str
    计划: list[str]
    轨迹: Annotated[list[dict], 追加轨迹]
    会话号: str
    需审批: bool
    记忆上下文: str
