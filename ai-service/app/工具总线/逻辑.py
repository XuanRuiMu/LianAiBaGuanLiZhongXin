import json
from typing import Any

import anyio
import httpx
from langchain_core.tools import ToolException
from pydantic import BaseModel, Field

import app.texts as texts
from app.config import 取配置
from app.rag.retriever import 知识库未就绪异常, 获取检索器


class 趋势天数入参(BaseModel):
    days: int = Field(ge=7, le=30, description="统计回溯天数，7~30 之间的整数")


class 检索入参(BaseModel):
    query: str = Field(min_length=2, max_length=50, description="检索词，2~50 个字的中文短语")


async def 请求内部接口(路径: str, 参数: dict[str, Any] | None = None) -> Any:
    配置 = 取配置()
    地址 = f"{配置.JAVA_BASE_URL.rstrip('/')}{路径}"
    try:
        async with httpx.AsyncClient(timeout=配置.HTTP_TIMEOUT_SECONDS) as 客户端:
            响应 = await 客户端.get(地址, params=参数, headers={"X-Internal-Token": 配置.INTERNAL_TOKEN})
    except httpx.TimeoutException as 异常:
        raise ToolException(texts.工具错误_超时) from 异常
    except httpx.HTTPError as 异常:
        raise ToolException(texts.工具错误_连接失败) from 异常
    if 响应.status_code != 200:
        raise ToolException(texts.工具错误_状态码.format(status_code=响应.status_code))
    try:
        响应体 = 响应.json()
    except ValueError as 异常:
        raise ToolException(texts.工具错误_解析失败) from 异常
    if isinstance(响应体, dict) and "data" in 响应体:
        return 响应体["data"]
    return 响应体


def _转文本(数据: Any) -> str:
    return json.dumps(数据, ensure_ascii=False)


def _同步检索(query: str) -> list[dict]:
    return 获取检索器().检索(query)


async def 概览逻辑() -> str:
    return _转文本(await 请求内部接口("/api/internal/stats/overview"))


async def 注册趋势逻辑(days: int) -> str:
    days = 趋势天数入参(days=days).days
    return _转文本(await 请求内部接口("/api/internal/stats/users/trend", {"days": days}))


async def 消息趋势逻辑(days: int) -> str:
    days = 趋势天数入参(days=days).days
    return _转文本(await 请求内部接口("/api/internal/stats/messages/trend", {"days": days}))


async def 关系分布逻辑() -> str:
    return _转文本(await 请求内部接口("/api/internal/stats/favorability/distribution"))


async def 留存逻辑(days: int) -> str:
    days = 趋势天数入参(days=days).days
    return _转文本(await 请求内部接口("/api/internal/stats/retention", {"days": days}))


async def 知识检索逻辑(query: str) -> str:
    query = 检索入参(query=query).query
    try:
        命中 = await anyio.to_thread.run_sync(_同步检索, query)
    except 知识库未就绪异常:
        return texts.知识库_未初始化
    if not 命中:
        return f"{texts.标记_检索无结果} {texts.知识库_无结果}"
    return "\n\n".join(f"【来源：{项['source']}】\n{项['text']}" for 项 in 命中)
