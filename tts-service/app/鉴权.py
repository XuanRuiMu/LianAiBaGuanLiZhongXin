import base64
import hashlib
import hmac
import json
import threading
import time
from collections import deque

from fastapi import Request
from fastapi.responses import JSONResponse

from app import 文案
from app.config import settings


class 凭证异常(Exception):
    def __init__(self, 提示: str, 状态码: int = 401):
        super().__init__(提示)
        self.提示 = 提示
        self.状态码 = 状态码


def 校验访问令牌(令牌: str) -> str:
    段 = 令牌.split(".")
    if len(段) != 3:
        raise ValueError("段数非法")
    填充 = "=" * (-len(段[1]) % 4)
    try:
        载荷 = json.loads(base64.urlsafe_b64decode(段[1] + 填充))
    except (ValueError, json.JSONDecodeError) as 异常:
        raise ValueError("载荷非法") from 异常
    到期 = 载荷.get("exp")
    if 到期 is not None and float(到期) < time.time():
        raise ValueError("令牌过期")
    密钥 = (settings.令牌密钥 or "").encode("utf-8")
    if not 密钥:
        raise ValueError("未配置密钥")
    期望 = hmac.new(密钥, f"{段[0]}.{段[1]}".encode("ascii"), hashlib.sha256).digest()
    尾填充 = "=" * (-len(段[2]) % 4)
    实际 = base64.urlsafe_b64decode(段[2] + 尾填充)
    if not hmac.compare_digest(期望, 实际):
        raise ValueError("签名不符")
    return str(载荷.get("sub") or "匿名")


def 提取身份(请求: Request) -> str:
    头 = 请求.headers.get("authorization", "")
    if 头.startswith("Bearer "):
        令牌 = 头[7:].strip()
        if 令牌:
            try:
                return f"用户:{校验访问令牌(令牌)}"
            except ValueError:
                raise 凭证异常(文案.令牌无效)
    内部令牌 = 请求.headers.get("x-internal-token", "")
    if 内部令牌 and settings.内部令牌 and hmac.compare_digest(内部令牌, settings.内部令牌):
        return "内部服务"
    raise 凭证异常(文案.缺凭证)


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


合成限流器 = 滑动窗口限流器()


def 守卫合成请求(请求: Request) -> str:
    身份 = 提取身份(请求)
    if not 合成限流器.检查并占用(身份, settings.合成限流次数, settings.合成限流窗口秒):
        raise 凭证异常(文案.请求频繁, 429)
    return 身份


def 凭证异常响应(异常: 凭证异常) -> JSONResponse:
    return JSONResponse(status_code=异常.状态码, content={"提示": 异常.提示})
