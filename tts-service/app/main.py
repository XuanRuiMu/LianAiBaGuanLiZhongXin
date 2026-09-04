import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI

from app.config import settings
from app.router import router
from app.provider import 合成服务单例

logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("TTS Service starting up (free edge-tts)...")
    yield
    logger.info("TTS Service shutting down...")


app = FastAPI(
    title="TTS Service",
    description="免费Edge-TTS语音合成服务（多音色+参数矩阵+缓存）",
    version="2.0.0",
    lifespan=lifespan,
)

app.include_router(router)


@app.get("/")
async def root():
    return {"service": "tts-service", "version": "2.0.0", "status": "running"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        log_level=settings.log_level.lower(),
        reload=False,
    )
