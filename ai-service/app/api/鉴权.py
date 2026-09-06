import base64
import hashlib
import hmac
import json
import threading
import time
from collections import deque
from collections.abc import Awaitable, Callable

from fastapi import Request
from fastapi.responses import JSONResponse

import app.texts as texts
from app.config import 取配置


class 凭证异常(Exception):
    def __init__(self, 文案: str, 状态码: int = 401):
        super().__init__(文案)
        self.文案 = 文案
        self.状态码 = 状态码


def 解码载荷(令牌: str) -> dict:
    段 = 令牌.split(".")
    if len(段) != 3:
        raise ValueError("段数非法")
    填充 = "=" * (-len(段[1]) % 4)
    return json.loads(base64.urlsafe_b64decode(段[1] + 填充))


def 校验访问令牌(令牌: str) -> str:
    配置 = 取配置()
    段 = 令牌.split(".")
    if len(段) != 3:
        raise ValueError("段数非法")
    try:
        载荷 = 解码载荷(令牌)
    except (ValueError, json.JSONDecodeError) as 异常:
        raise ValueError("载荷非法") from 异常
    到期 = 载荷.get("exp")
    if 到期 is not None and float(到期) < time.time():
        raise ValueError("令牌过期")
    密钥 = (配置.JWT密钥 or "").encode("utf-8")
    if not 密钥:
        raise ValueError("未配置密钥")
    期望 = hmac.new(密钥, f"{段[0]}.{段[1]}".encode("ascii"), hashlib.sha256).digest()
    填充 = "=" * (-len(段[2]) % 4)
    实际 = base64.urlsafe_b64decode(段[2] + 填充)
    if not hmac.compare_digest(期望, 实际):
        raise ValueError("签名不符")
    return str(载荷.get("sub") or "匿名")


def 提取身份(请求: Request) -> str:
    配置 = 取配置()
    头 = 请求.headers.get("authorization", "")
    if 头.startswith("Bearer "):
        令牌 = 头[7:].strip()
        if 令牌:
            try:
                return f"用户:{校验访问令牌(令牌)}"
            except ValueError:
                raise 凭证异常(texts.鉴权失败_令牌无效)
    内部令牌 = 请求.headers.get("x-internal-token", "")
    if 内部令牌 and 配置.INTERNAL_TOKEN and hmac.compare_digest(内部令牌, 配置.INTERNAL_TOKEN):
        return "内部服务"
    raise 凭证异常(texts.鉴权失败_缺凭证)


class 滑动窗口限流器:
    def __init__(self) -> None:
        self._锁 = threading.Lock()
        self._记录: dict[str, deque[float]] = {}

    def 检查并占用(self, 身份: str, 上限: int, 窗口秒: int) -> bool:
        现在 = time.monotonic()
        with self._锁:
            队列 = self._记录.setdefault(身份, deque())
            while 队列 and 现在 - 队列[0] >= 窗口秒:
                队列.popleft()
            if len(队列) >= 上限:
                return False
            队列.append(现在)
            return True

    def 重置(self) -> None:
        with self._锁:
            self._记录.clear()


聊天限流器 = 滑动窗口限流器()
报表限流器 = 滑动窗口限流器()


async def 鉴权限流中间件(请求: Request, 调用下一个: Callable[[Request], Awaitable]) -> JSONResponse:
    路径 = 请求.url.path
    if 路径 == "/api/chat/stream":
        限流器, 取限流 = 聊天限流器, lambda 配置: (配置.聊天限流次数, 配置.聊天限流窗口秒)
    elif 路径.startswith("/api/v1/reports/"):
        限流器, 取限流 = 报表限流器, lambda 配置: (配置.报表限流次数, 配置.报表限流窗口秒)
    else:
        return await 调用下一个(请求)
    try:
        身份 = 提取身份(请求)
    except 凭证异常 as 异常:
        return JSONResponse(status_code=异常.状态码, content={"detail": 异常.文案})
    配置 = 取配置()
    上限, 窗口秒 = 取限流(配置)
    if not 限流器.检查并占用(身份, 上限, 窗口秒):
        return JSONResponse(status_code=429, content={"detail": texts.限流_超限})
    return await 调用下一个(请求)
