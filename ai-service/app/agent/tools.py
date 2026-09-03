import json
from typing import Any

import anyio
import httpx
from langchain_core.messages import ToolMessage
from langchain_core.tools import ToolException, tool
from pydantic import BaseModel, Field, ValidationError

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


async def 知识检索逻辑(query: str) -> str:
    query = 检索入参(query=query).query
    try:
        命中 = await anyio.to_thread.run_sync(_同步检索, query)
    except 知识库未就绪异常:
        return texts.知识库_未初始化
    if not 命中:
        return f"{texts.标记_检索无结果} {texts.知识库_无结果}"
    return "\n\n".join(f"【来源：{项['source']}】\n{项['text']}" for 项 in 命中)


@tool
async def query_overview() -> str:
    """查询「和我恋爱吧」平台核心运营数据总量概览，包括累计用户数、角色卡总数、消息总数等汇总指标。

    无参数。适用于"目前整体情况怎么样""平台有多少用户"这类概览型问题。
    """
    return await 概览逻辑()


@tool(args_schema=趋势天数入参)
async def query_user_trend(days: int) -> str:
    """查询最近 N 天每日新增注册用户的趋势数据。

    Args:
        days: 统计回溯天数，7~30 之间的整数，例如 14 表示近两周。
    """
    return await 注册趋势逻辑(days)


@tool(args_schema=趋势天数入参)
async def query_message_trend(days: int) -> str:
    """查询最近 N 天平台内用户与 AI 角色每日聊天消息量的趋势数据。

    Args:
        days: 统计回溯天数，7~30 之间的整数，例如 7 表示近一周。
    """
    return await 消息趋势逻辑(days)


@tool
async def query_favorability_distribution() -> str:
    """查询全平台用户与 AI 角色的关系阶段分布（冷淡、疏远、认识、熟悉、朋友、好友、暧昧、心动、热恋、深爱各阶段人数）。

    无参数。适用于"用户恋爱进度如何""好感度处于什么水平"这类关系分析问题。
    """
    return await 关系分布逻辑()


@tool(args_schema=检索入参)
async def search_knowledge(query: str) -> str:
    """从产品知识库检索资料，知识库包含产品手册（角色卡系统、好感度五维、挑战玩法）、平台架构说明、运营常见问题。

    Args:
        query: 检索词，2~50 个字的中文短语，越贴近产品术语效果越好，例如"好感度五维体系"。
    """
    return await 知识检索逻辑(query)


工具列表 = [query_overview, query_user_trend, query_message_trend, query_favorability_distribution, search_knowledge]


async def 执行单个工具调用(调用: dict) -> ToolMessage:
    工具名 = str(调用.get("name") or "")
    目标工具 = next((t for t in 工具列表 if t.name == 工具名), None)
    if 目标工具 is None:
        内容 = texts.工具错误_未知工具.format(tool_name=工具名)
    else:
        try:
            内容 = await 目标工具.ainvoke(调用.get("args") or {})
        except ToolException as 异常:
            内容 = f"{texts.标记_工具错误} {异常}"
        except ValidationError as 异常:
            内容 = f"{texts.标记_工具错误} {texts.工具错误_参数非法.format(detail=异常.errors()[0].get('msg', ''))}"
        except Exception:
            内容 = f"{texts.标记_工具错误} {texts.工具错误_通用}"
    return ToolMessage(content=内容, name=工具名, tool_call_id=str(调用.get("id") or ""))
