from collections.abc import AsyncIterator
from typing import Literal

from fastapi import APIRouter
from langchain_core.messages import AIMessage, AIMessageChunk, BaseMessage, HumanMessage, ToolMessage
from pydantic import BaseModel, Field
from starlette.responses import StreamingResponse

import app.texts as texts
from app.agent.graph import 构建分析图谱
from app.api.sse import 格式化sse事件
from app.config import 取配置

路由 = APIRouter()


class 对话消息(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1)


class 对话请求(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    history: list[对话消息] = Field(default_factory=list, max_length=20)


def _转历史(history: list[对话消息]) -> list[BaseMessage]:
    return [
        HumanMessage(条.content) if 条.role == "user" else AIMessage(条.content) for 条 in history
    ]


from collections.abc import AsyncIterator
from typing import Literal
from uuid import uuid4

from fastapi import APIRouter
from langchain_core.messages import AIMessage, AIMessageChunk, BaseMessage, HumanMessage, ToolMessage
from pydantic import BaseModel, Field
from starlette.responses import StreamingResponse

import app.texts as texts
from app.agent.graph import 构建分析图谱
from app.api.sse import 格式化sse事件
from app.config import 取配置
from app.记忆.护栏 import 输入护栏

路由 = APIRouter()


class 对话消息(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1)


class 对话请求(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    history: list[对话消息] = Field(default_factory=list, max_length=20)
    会话号: str = Field(default="", max_length=64)
    恢复: dict = Field(default_factory=dict)


def _转历史(history: list[对话消息]) -> list[BaseMessage]:
    return [
        HumanMessage(条.content) if 条.role == "user" else AIMessage(条.content) for 条 in history
    ]


async def _事件流(请求: 对话请求) -> AsyncIterator[str]:
    try:
        安全问题 = 输入护栏(请求.question)
    except ValueError:
        yield 格式化sse事件("error", {"message": texts.护栏_注入拦截})
        return
    try:
        图谱 = await 构建分析图谱()
        会话号 = 请求.会话号.strip() or f"临-{uuid4().hex[:12]}"
        运行配置 = {"configurable": {"thread_id": 会话号}}
        if 请求.恢复:
            from langgraph.types import Command
            数据流 = 图谱.astream(Command(resume=请求.恢复),
                                  运行配置, stream_mode=["messages", "updates"])
        else:
            初始输入 = {
                "messages": [*_转历史(请求.history), HumanMessage(安全问题)],
                "question": 安全问题,
                "会话号": 会话号,
            }
            数据流 = 图谱.astream(初始输入, 运行配置, stream_mode=["messages", "updates"])
        async for 模式, 载荷 in 数据流:
            if 模式 == "messages":
                消息块, _元数据 = 载荷
                if isinstance(消息块, AIMessageChunk):
                    文本 = texts.提取文本(消息块.content)
                    if 文本:
                        yield 格式化sse事件("token", {"content": 文本})
            else:
                for 节点名, 更新 in 载荷.items():
                    if not 更新:
                        continue
                    if 节点名 == "execute_tools":
                        for 消息 in 更新.get("messages", []):
                            if isinstance(消息, ToolMessage):
                                yield 格式化sse事件(
                                    "tool_end",
                                    {
                                        "name": 消息.name,
                                        "content": 消息.content[: 取配置().TOOL_EVENT_SUMMARY_LENGTH],
                                    },
                                )
                    elif isinstance(更新, dict) and 更新.get("轨迹"):
                        for 事件 in 更新["轨迹"]:
                            yield 格式化sse事件("trace", 事件)
        yield 格式化sse事件("done", {})
    except Exception:
        yield 格式化sse事件("error", {"message": texts.服务错误_通用})


@路由.post("/api/chat/stream")
async def 聊天流式接口(请求: 对话请求) -> StreamingResponse:
    return StreamingResponse(
        _事件流(请求),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
    )
