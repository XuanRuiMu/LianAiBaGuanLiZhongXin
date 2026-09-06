import time

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

import app.texts as texts
from app.agent.tools import 请求内部接口
from app.config import 取配置
from app.开放平台.存储 import 计算签名, 开放平台存储
from app.开放平台.渠道 import 广播通知
from app.开放平台.投递器 import 取存储, 发布事件
from app.工具总线.注册表 import 注册表

路由 = APIRouter()


def _拒绝(文案: str, 状态码: int = 401) -> JSONResponse:
    return JSONResponse(status_code=状态码, content={"detail": 文案})


def _校验开放密钥(请求: Request) -> str | None:
    明文 = 请求.headers.get("x-api-key", "").strip()
    if not 明文:
        return None
    return 取存储().校验并占用(明文)


@路由.get("/api/v1/公开概览")
async def 公开概览(请求: Request):
    if _校验开放密钥(请求) is None:
        return _拒绝(texts.鉴权失败_缺凭证)
    try:
        return {"code": 200, "data": await 请求内部接口("/api/internal/stats/overview")}
    except Exception:
        return _拒绝(texts.服务错误_通用, 502)


@路由.get("/api/v1/公开趋势")
async def 公开趋势(请求: Request, days: int = 7):
    if _校验开放密钥(请求) is None:
        return _拒绝(texts.鉴权失败_缺凭证)
    if days < 7 or days > 30:
        return _拒绝(texts.工具错误_参数非法.format(detail="days 须在 7~30 之间"), 400)
    try:
        return {"code": 200, "data": await 请求内部接口(
            "/api/internal/stats/users/trend", {"days": days})}
    except Exception:
        return _拒绝(texts.服务错误_通用, 502)


@路由.get("/api/v1/工具清单")
async def 工具清单(请求: Request):
    if _校验开放密钥(请求) is None:
        return _拒绝(texts.鉴权失败_缺凭证)
    return 注册表.开放接口模型()


@路由.get("/api/v1/投递记录")
async def 投递记录(请求: Request, limit: int = 20):
    if _校验开放密钥(请求) is None:
        return _拒绝(texts.鉴权失败_缺凭证)
    return {"code": 200, "data": 取存储().投递历史(min(limit, 100))}


class 入站事件(BaseModel):
    事件: str = Field(min_length=1, max_length=64)
    数据: dict = Field(default_factory=dict)


@路由.post("/api/v1/webhooks/外部触发")
async def 外部触发(请求: Request, 事件: 入站事件):
    配置 = 取配置()
    签名 = 请求.headers.get("x-event-sign", "")
    时间戳 = 请求.headers.get("x-event-time", "")
    幂等键 = 请求.headers.get("x-idempotency-key", "")
    if not 签名 or not 时间戳 or not 幂等键:
        return _拒绝("缺少签名头或幂等键", 400)
    try:
        已有 = 取存储().取幂等(幂等键)
    except Exception:
        return _拒绝(texts.服务错误_通用, 502)
    if 已有 is not None:
        import json as _json
        return {"code": 200, "data": _json.loads(已有), "幂等命中": True}
    if abs(time.time() - float(时间戳)) > 300:
        return _拒绝("签名已过期", 401)
    期望 = 计算签名(配置.事件密钥 or "dev-event-secret", 时间戳, await 请求.body())
    if 签名 != 期望:
        return _拒绝("签名不符", 401)
    结果 = {"已受理": 事件.事件}
    try:
        取存储().存幂等(幂等键, 结果)
    except Exception:
        return _拒绝(texts.服务错误_通用, 502)
    发布事件(事件.事件, 事件.数据)
    try:
        await 广播通知("外部事件", f"{事件.事件} 已受理")
    except Exception:
        pass
    return {"code": 200, "data": 结果}
