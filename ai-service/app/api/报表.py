import os

from fastapi import APIRouter
from fastapi.responses import FileResponse

import app.texts as texts
from app.config import 取配置
from app.报表.定时 import 取日报数据, 报表文件名
from app.报表.生成器 import 生成Excel, 生成PDF

路由 = APIRouter()


async def _报表文件(后缀: str) -> FileResponse:
    配置 = 取配置()
    概览, 趋势 = await 取日报数据()
    生成器 = 生成Excel if 后缀 == "xlsx" else 生成PDF
    内容 = 生成器(概览, 趋势)
    os.makedirs(配置.报表目录, exist_ok=True)
    路径 = os.path.join(配置.报表目录, 报表文件名[后缀])
    with open(路径, "wb") as 文件:
        文件.write(内容)
    媒体类型 = (
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        if 后缀 == "xlsx" else "application/pdf"
    )
    return FileResponse(路径, media_type=媒体类型, filename=报表文件名[后缀])


@路由.get("/api/v1/reports/日报.xlsx")
async def 下载日报表() -> FileResponse:
    try:
        return await _报表文件("xlsx")
    except Exception:
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=texts.报表_生成失败)


@路由.get("/api/v1/reports/日报.pdf")
async def 下载日报PDF() -> FileResponse:
    try:
        return await _报表文件("pdf")
    except Exception:
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=texts.报表_生成失败)
