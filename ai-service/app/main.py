import asyncio
import contextvars
import logging
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import chat, health, 开放平台, 报表
from app.api.鉴权 import 鉴权限流中间件
from app.config import 取配置
from app.报表.定时 import 报表定时循环
from app.开放平台.投递器 import 投递循环

请求追踪号: contextvars.ContextVar[str] = contextvars.ContextVar("请求追踪号", default="-")


class 追踪日志过滤器(logging.Filter):
    def filter(self, 记录: logging.LogRecord) -> bool:
        记录.追踪号 = 请求追踪号.get()
        return True


def 配置日志() -> None:
    处理器 = logging.StreamHandler()
    处理器.setFormatter(logging.Formatter("%(asctime)s %(levelname)s [%(name)s] 追踪号=%(追踪号)s %(message)s"))
    处理器.addFilter(追踪日志过滤器())
    根 = logging.getLogger()
    根.handlers.clear()
    根.addHandler(处理器)
    根.setLevel(logging.INFO)


async def 追踪中间件(请求, 调用下一个):
    追踪号 = 请求.headers.get("x-trace-id") or uuid.uuid4().hex[:16]
    请求追踪号.set(追踪号)
    响应 = await 调用下一个(请求)
    响应.headers["X-Trace-Id"] = 追踪号
    return 响应


@asynccontextmanager
async def 生命周期(应用: FastAPI):
    停止事件 = asyncio.Event()
    任务们 = [
        asyncio.create_task(报表定时循环(停止事件)),
        asyncio.create_task(投递循环(停止事件)),
    ]
    try:
        yield
    finally:
        停止事件.set()
        for 任务 in 任务们:
            任务.cancel()


def 创建应用() -> FastAPI:
    配置日志()
    配置 = 取配置()
    应用 = FastAPI(title="恋爱吧数据中心 AI 分析服务", lifespan=生命周期)
    应用.add_middleware(
        CORSMiddleware,
        allow_origins=配置.CORS_ORIGINS,
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    应用.middleware("http")(追踪中间件)
    应用.middleware("http")(鉴权限流中间件)
    应用.include_router(chat.路由)
    应用.include_router(health.路由)
    应用.include_router(报表.路由)
    应用.include_router(开放平台.路由)
    if 配置.MCP挂载开关:
        from app.mcp_server import 服务器
        应用.mount("/mcp", 服务器.streamable_http_app())
    return 应用


app = 创建应用()
