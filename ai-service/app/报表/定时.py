import asyncio
import logging
import os
from datetime import date

from app.agent.tools import 请求内部接口
from app.config import 取配置
from app.报表.生成器 import 生成Excel, 生成PDF

logger = logging.getLogger(__name__)

报表文件名 = {"xlsx": "运营日报.xlsx", "pdf": "运营日报.pdf"}


async def 取日报数据() -> tuple[dict, list[dict]]:
    概览 = await 请求内部接口("/api/internal/stats/overview")
    趋势 = await 请求内部接口("/api/internal/stats/users/trend", {"days": 7})
    if not isinstance(概览, dict):
        概览 = {}
    if not isinstance(趋势, list):
        趋势 = []
    return 概览, 趋势


async def 生成并落盘() -> dict[str, str]:
    配置 = 取配置()
    os.makedirs(配置.报表目录, exist_ok=True)
    概览, 趋势 = await 取日报数据()
    路径表 = {}
    for 后缀, 生成器 in (("xlsx", 生成Excel), ("pdf", 生成PDF)):
        路径 = os.path.join(配置.报表目录, f"{date.today().isoformat()}-{报表文件名[后缀]}")
        with open(路径, "wb") as 文件:
            文件.write(生成器(概览, 趋势))
        路径表[后缀] = 路径
    logger.info("定时报表已生成: %s", 路径表)
    return 路径表


async def 报表定时循环(停止事件: asyncio.Event) -> None:
    配置 = 取配置()
    while not 停止事件.is_set():
        try:
            await 生成并落盘()
        except asyncio.CancelledError:
            break
        except Exception as 异常:
            logger.warning("定时报表生成失败: %s", 异常)
        try:
            await asyncio.wait_for(停止事件.wait(), timeout=max(60, 配置.报表定时秒))
        except asyncio.TimeoutError:
            continue
