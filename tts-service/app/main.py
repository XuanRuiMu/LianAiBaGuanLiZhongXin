import contextvars
import logging
import uuid
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request

from app.config import settings
from app.router import router
from app.provider import 合成服务单例

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
    根.setLevel(getattr(logging, settings.日志级别.upper(), logging.INFO))


@asynccontextmanager
async def 生命周期(应用: FastAPI):
    日志 = logging.getLogger(__name__)
    日志.info("语音合成服务启动中（免费边缘语音）...")
    yield
    日志.info("语音合成服务停止中...")


配置日志()

app = FastAPI(
    title="语音合成服务",
    description="免费边缘语音合成服务（多音色+参数矩阵+缓存）",
    version="2.0.0",
    lifespan=生命周期,
)


@app.middleware("http")
async def 追踪中间件(请求: Request, 调用下一个):
    追踪号 = 请求.headers.get("x-trace-id") or uuid.uuid4().hex[:16]
    请求追踪号.set(追踪号)
    响应 = await 调用下一个(请求)
    响应.headers["X-Trace-Id"] = 追踪号
    return 响应


app.include_router(router)


@app.get("/health")
async def 健康别名():
    return {"状态": "正常", "服务": "tts-service"}


@app.get("/")
async def 根():
    return {"服务": "tts-service", "版本": "2.0.0", "状态": "运行中"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.监听地址,
        port=settings.监听端口,
        log_level=settings.日志级别.lower(),
        reload=False,
    )
