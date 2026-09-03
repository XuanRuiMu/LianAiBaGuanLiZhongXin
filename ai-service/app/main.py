from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import chat, health
from app.config import 取配置


def 创建应用() -> FastAPI:
    配置 = 取配置()
    应用 = FastAPI(title="恋爱吧数据中心 AI 分析服务")
    应用.add_middleware(
        CORSMiddleware,
        allow_origins=配置.CORS_ORIGINS,
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    应用.include_router(chat.路由)
    应用.include_router(health.路由)
    return 应用


app = 创建应用()
