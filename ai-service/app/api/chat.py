from collections.abc import AsyncIterator
from typing import Literal

from fastapi import APIRouter
from langchain_core.messages import AIMessage, AIMessageChunk, BaseMessage, HumanMessage, ToolMessage
from pydantic import BaseModel, Field
from starlette.responses import StreamingResponse

import app.texts as texts
from app.agent.graph import 构建分析图谱
from app.api.sse import 格式化sse事件, 提取文本
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


async def _事件流(请求: 对话请求) -> AsyncIterator[str]:
    try:
        图谱 = 构建分析图谱()
        初始输入 = {
            "messages": [*_转历史(请求.history), HumanMessage(请求.question)],
            "question": 请求.question,
        }
        async for 模式, 载荷 in 图谱.astream(初始输入, stream_mode=["messages", "updates"]):
            if 模式 == "messages":
                消息块, _元数据 = 载荷
                if isinstance(消息块, AIMessageChunk):
                    文本 = 提取文本(消息块.content)
                    if 文本:
                        yield 格式化sse事件("token", {"content": 文本})
            else:
                for 节点名, 更新 in 载荷.items():
                    if 节点名 != "execute_tools" or not 更新:
                        continue
                    for 消息 in 更新.get("messages", []):
                        if isinstance(消息, ToolMessage):
                            yield 格式化sse事件(
                                "tool_end",
                                {
                                    "name": 消息.name,
                                    "content": 消息.content[: 取配置().TOOL_EVENT_SUMMARY_LENGTH],
                                },
                            )
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
