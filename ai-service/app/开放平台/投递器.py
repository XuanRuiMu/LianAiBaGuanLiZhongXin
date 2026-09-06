import asyncio
import json
import logging
import time

import httpx

from app.config import 取配置
from app.开放平台.存储 import 开放平台存储, 计算签名

logger = logging.getLogger(__name__)

_存储: 开放平台存储 | None = None


def 取存储() -> 开放平台存储:
    global _存储
    if _存储 is None:
        _存储 = 开放平台存储(取配置().开放平台库路径)
    return _存储


def 发布事件(事件: str, 数据: dict) -> None:
    配置 = 取配置()
    载荷 = json.dumps({"事件": 事件, "数据": 数据}, ensure_ascii=False).encode("utf-8")
    for 地址 in [a.strip() for a in 配置.事件订阅地址.split(",") if a.strip()]:
        try:
            序号 = 取存储().记录投递(事件, 地址)
            logger.info("事件已入队: %s -> %s (#%s)", 事件, 地址, 序号)
        except Exception as 异常:
            logger.warning("事件入队失败，已跳过: %s", 异常)
    _ = 载荷


async def 投递一次(序号: int, 事件: str, 地址: str, 次数: int) -> None:
    配置 = 取配置()
    时间戳 = str(int(time.time()))
    载荷 = json.dumps({"事件": 事件, "序号": 序号}, ensure_ascii=False).encode("utf-8")
    签名 = 计算签名(配置.事件密钥 or "dev-event-secret", 时间戳, 载荷)
    try:
        async with httpx.AsyncClient(timeout=10) as 客户端:
            响应 = await 客户端.post(地址, content=载荷,
                headers={"Content-Type": "application/json",
                         "X-事件签名": 签名, "X-事件时间": 时间戳})
        if 200 <= 响应.status_code < 300:
            取存储().更新投递(序号, "成功", 响应.status_code, 0)
            return
        raise RuntimeError(f"HTTP {响应.status_code}")
    except Exception as 异常:
        logger.warning("事件投递失败 #%s: %s", 序号, 异常)
        if 次数 >= 4:
            取存储().更新投递(序号, "失败", None, 0)
        else:
            取存储().更新投递(序号, "重试中", None, time.time() + (2 ** 次数) * 30)


async def 投递循环(停止事件: asyncio.Event) -> None:
    while not 停止事件.is_set():
        try:
            for 待 in 取存储().待重试(time.time()):
                await 投递一次(待["序号"], 待["事件"], 待["地址"], 待["次数"])
        except Exception as 异常:
            logger.warning("投递循环异常: %s", 异常)
        try:
            await asyncio.wait_for(停止事件.wait(), timeout=30)
        except asyncio.TimeoutError:
            continue
