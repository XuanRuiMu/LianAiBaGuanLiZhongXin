from fastapi import APIRouter

路由 = APIRouter()


@路由.get("/api/health")
@路由.get("/health")
async def 健康检查() -> dict:
    return {"status": "ok"}
