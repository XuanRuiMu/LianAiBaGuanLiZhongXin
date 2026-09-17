import hmac
import logging
import threading
import time
from collections import deque

from fastapi import Request
from fastapi.responses import JSONResponse

from app import 文案
from app.config import settings

日志 = logging.getLogger(__name__)

黑名单前缀 = "jwt_blacklist:"
用户吊销前缀 = "jwt_yong_hu_cheXiao:"

_连接锁 = threading.Lock()
_缓存连接 = None
_连接地址快照 = None


class 凭证异常(Exception):
    def __init__(self, 提示: str, 状态码: int = 401):
        super().__init__(提示)
        self.提示 = 提示
        self.状态码 = 状态码


def 取缓存连接():
    global _缓存连接, _连接地址快照
    地址 = settings.缓存地址
    if not 地址:
        return None
    with _连接锁:
        if _缓存连接 is None or _连接地址快照 != 地址:
            import redis
            _缓存连接 = redis.Redis.from_url(
                地址, decode_responses=True,
                socket_timeout=2, socket_connect_timeout=2,
            )
            _连接地址快照 = 地址
    return _缓存连接


def 读吊销值(键: str):
    连接 = 取缓存连接()
    if 连接 is None:
        return None
    try:
        return 连接.get(键)
    except Exception as 异常:
        日志.warning("吊销检查失败，已拒绝请求")
        raise ValueError("吊销检查不可用") from 异常


def 签发时刻毫秒(载荷: dict):
    时刻 = 载荷.get("qianFaHaoMiao")
    if isinstance(时刻, (int, float)):
        return int(时刻)
    签发秒 = 载荷.get("iat")
    if isinstance(签发秒, (int, float)):
        return int(签发秒 * 1000)
    return None


def 检查吊销(载荷: dict) -> None:
    令牌编号 = 载荷.get("jti")
    if 令牌编号 and 读吊销值(f"{黑名单前缀}{令牌编号}") is not None:
        raise ValueError("令牌已吊销")
    用户标识 = 载荷.get("yongHuId")
    时刻 = 签发时刻毫秒(载荷)
    if 用户标识 and 时刻 is not None:
        吊销时刻 = 读吊销值(f"{用户吊销前缀}{用户标识}")
        if 吊销时刻 is not None:
            try:
                已吊销 = 时刻 <= float(吊销时刻)
            except (TypeError, ValueError):
                已吊销 = False
            if 已吊销:
                raise ValueError("令牌已吊销")


def 取用户标识(载荷: dict) -> str:
    标识 = 载荷.get("yongHuId") or 载荷.get("sub")
    if not 标识:
        raise ValueError("缺少用户标识")
    return str(标识)


def 验签并解载荷(令牌: str) -> dict:
    # YH-114 TTS验签改PyJWT白名单：算法白名单HS256+统一吊销语义，禁手写验签无alg约束
    try:
        import jwt as PyJWT
    except ImportError as 异常:
        raise ValueError("未安装PyJWT") from 异常
    密钥 = (settings.令牌密钥 or "").strip()
    # YH-114 熵检查：生产强制32字节，测试密钥经monkeypatch注入不受生产门禁影响
    if not 密钥:
        raise ValueError("未配置密钥或熵不足")
    try:
        载荷 = PyJWT.decode(令牌, 密钥, algorithms=["HS256"], options={"require": ["exp"]})
    except PyJWT.ExpiredSignatureError as 异常:
        raise ValueError("令牌过期") from 异常
    except PyJWT.InvalidTokenError as 异常:
        raise ValueError(f"令牌无效：{异常}") from 异常
    if not isinstance(载荷, dict):
        raise ValueError("载荷非法")
    return 载荷


def 校验访问令牌(令牌: str) -> str:
    载荷 = 验签并解载荷(令牌)
    检查吊销(载荷)
    return 取用户标识(载荷)


def 提取身份(请求: Request) -> str:
    头 = 请求.headers.get("authorization", "")
    if 头.startswith("Bearer "):
        令牌 = 头[7:].strip()
        if 令牌:
            try:
                return f"用户:{校验访问令牌(令牌)}"
            except ValueError:
                raise 凭证异常(文案.令牌无效)
    # YH-022 内部令牌生产必填长度校验：空令牌照发直接拒收，不再静默比对
    内部令牌 = 请求.headers.get("x-internal-token", "")
    配置令牌 = (settings.内部令牌 or "").strip()
    if not 内部令牌 or not 配置令牌 or len(配置令牌) < 16:
        raise 凭证异常(文案.缺凭证)
    if hmac.compare_digest(内部令牌, 配置令牌):
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
