import asyncio
import logging

import httpx2
import pytest
from asgi_lifespan import LifespanManager
from fastapi import Request

import app.main as 主模块
import app.provider as 提供者模块
from app import 鉴权 as 鉴权模块
from app import 文案
from app.cache import 合成缓存
from app.main import app
from app.provider import EdgeTTSProvider, 合成服务, 合成错误, 语音Provider
from app.router import 合成服务单例
from app.鉴权 import 滑动窗口限流器, 取缓存连接


@pytest.fixture(autouse=True)
def 重置鉴权全局():
    鉴权模块._缓存连接 = None
    鉴权模块._连接地址快照 = None
    鉴权模块.合成限流器.重置()
    yield
    鉴权模块._缓存连接 = None
    鉴权模块._连接地址快照 = None
    鉴权模块.合成限流器.重置()


def 建请求(头):
    return Request({"type": "http", "headers": [(键.lower().encode(), 值.encode()) for 键, 值 in 头.items()]})


def 内部凭证头(令牌="test-internal-token-16p0"):
    return {"X-Internal-Token": 令牌}


def test_抽象提供者拒绝实例化():
    with pytest.raises(TypeError):
        语音Provider()


@pytest.mark.asyncio
async def test_抽象提供者子类调用父实现抛错():
    class 子类(语音Provider):
        async def 合成(self, 文本, 音色, 语速, 音调, 音量, 风格):
            return await super().合成(文本, 音色, 语速, 音调, 音量, 风格)

    with pytest.raises(NotImplementedError):
        await 子类().合成("文本", "音色", 1.0, 0.0, 1.0, "normal")


async def test_应用生命周期根路由与追踪头():
    async with LifespanManager(app) as 生命周期:
        transport = httpx2.ASGITransport(app=生命周期.app)
        async with httpx2.AsyncClient(transport=transport, base_url="http://testserver") as 客户端:
            响应 = await 客户端.get("/", headers={"X-Trace-Id": "trace-test-12345678"})
    assert 响应.status_code == 200
    assert 响应.headers["X-Trace-Id"] == "trace-test-12345678"
    assert 响应.json() == {"服务": "tts-service", "版本": "2.0.0", "状态": "运行中"}


async def test_应用自动生成追踪头并重配日志(monkeypatch):
    monkeypatch.setattr(主模块.settings, "日志级别", "debug")
    主模块.配置日志()
    assert logging.getLogger().level == logging.DEBUG
    async with LifespanManager(app) as 生命周期:
        transport = httpx2.ASGITransport(app=生命周期.app)
        async with httpx2.AsyncClient(transport=transport, base_url="http://testserver") as 客户端:
            响应 = await 客户端.get("/health")
    assert len(响应.headers["X-Trace-Id"]) == 16


def test_主模块直接启动调用Uvicorn(monkeypatch):
    import runpy
    import uvicorn
    from pathlib import Path

    调用 = []
    monkeypatch.setattr(uvicorn, "run", lambda *args, **kwargs: 调用.append((args, kwargs)))
    runpy.run_path(str(Path(主模块.__file__)), run_name="__main__")
    assert 调用[0][0] == ("app.main:app",)
    assert 调用[0][1] == {
        "host": "0.0.0.0",
        "port": 8000,
        "log_level": "info",
        "reload": False,
    }


@pytest.mark.asyncio
async def test_缓存单飞共享未来并淘汰():
    缓存 = 合成缓存(1)
    命中甲, 未来甲 = await 缓存.单飞("甲")
    命中乙, 未来乙 = await 缓存.单飞("甲")
    assert not 命中甲 and 命中乙 and 未来乙 is 未来甲
    await 缓存.单飞完成("甲", b"a")
    assert await 未来甲 == b"a"
    assert await 缓存.取("甲") == b"a"
    await 缓存.单飞完成("乙", b"b")
    assert await 缓存.取("甲") is None
    assert 缓存.状态() == {"条目": 1, "上限": 1, "命中": 1, "未命中": 2}


@pytest.mark.asyncio
async def test_缓存单飞向等待者传播异常():
    缓存 = 合成缓存()
    _, 未来 = await 缓存.单飞("失败")
    错误 = RuntimeError("失败")
    await 缓存.单飞完成("失败", None, 错误)
    with pytest.raises(RuntimeError, match="失败"):
        await 未来


@pytest.mark.asyncio
async def test_edge_tts成功与空音频(monkeypatch):
    import edge_tts

    class 成功通讯:
        def __init__(self, *args, **kwargs):
            pass

        async def stream(self):
            yield {"type": "text", "data": b""}
            yield {"type": "audio", "data": b"ID3audio"}

    monkeypatch.setattr(edge_tts, "Communicate", 成功通讯)
    数据, 格式 = await EdgeTTSProvider().合成("你好", "zh-CN-XiaoxiaoNeural", 1.0, 0.0, 1.0, "normal")
    assert (数据, 格式) == (b"ID3audio", "mp3")

    class 空通讯(成功通讯):
        async def stream(self):
            yield {"type": "text", "data": b""}

    monkeypatch.setattr(edge_tts, "Communicate", 空通讯)
    with pytest.raises(合成错误) as 捕获:
        await EdgeTTSProvider().合成("你好", "zh-CN-XiaoxiaoNeural", 1.0, 0.0, 1.0, "normal")
    assert 捕获.value.错误码 == 500 and 捕获.value.可重试


@pytest.mark.asyncio
async def test_edge_tts超时后重试成功(monkeypatch):
    import edge_tts

    次数 = 0

    def 工厂(*args, **kwargs):
        nonlocal 次数
        次数 += 1
        当前次数 = 次数

        class 通讯:
            def __init__(self, *inner_args, **inner_kwargs):
                pass

            async def stream(self):
                if 当前次数 == 1:
                    raise TimeoutError
                yield {"type": "audio", "data": b"audio"}

        return 通讯()

    async def 不等待(_):
        return None

    monkeypatch.setattr(edge_tts, "Communicate", 工厂)
    monkeypatch.setattr(提供者模块.asyncio, "sleep", 不等待)
    数据, 格式 = await EdgeTTSProvider(最大重试=1).合成("你好", "zh-CN-XiaoxiaoNeural", 1.0, 0.0, 1.0, "normal")
    assert (数据, 格式) == (b"audio", "mp3") and 次数 == 2


@pytest.mark.asyncio
async def test_edge_tts耗尽重试返回可重试错误(monkeypatch):
    import edge_tts

    class 失败通讯:
        def __init__(self, *args, **kwargs):
            pass

        async def stream(self):
            yield {"type": "text", "data": b""}
            raise RuntimeError("network")

    async def 不等待(_):
        return None

    monkeypatch.setattr(edge_tts, "Communicate", 失败通讯)
    monkeypatch.setattr(提供者模块.asyncio, "sleep", 不等待)
    with pytest.raises(合成错误) as 捕获:
        await EdgeTTSProvider(最大重试=1).合成("你好", "zh-CN-XiaoxiaoNeural", 1.0, 0.0, 1.0, "normal")
    assert 捕获.value.错误码 == 502 and 捕获.value.可重试


@pytest.mark.asyncio
async def test_合成服务三种模式与参数限幅(monkeypatch):
    服务 = 合成服务()
    服务._模式 = "offline"
    assert 服务.提供者名() == "offline-sine"
    服务._模式 = "edge"
    assert 服务.提供者名() == "edge-tts"
    服务._模式 = "auto"
    assert 服务.提供者名() == "edge-tts+offline-sine(auto)"
    服务._模式 = "offline"
    捕获 = {}

    async def 记录参数(文本, 音色, 语速, 音调, 音量, 风格):
        捕获.update({
            "文本": 文本,
            "音色": 音色,
            "语速": 语速,
            "音调": 音调,
            "音量": 音量,
            "风格": 风格,
        })
        return b"RIFFdata", "wav"

    monkeypatch.setattr(服务._离线, "合成", 记录参数)
    await 服务.合成(" 文本  ", None, 3.0, 100.0, 3.0, "unknown")
    assert 捕获 == {
        "文本": "文本",
        "音色": "zh-CN-XiaoxiaoNeural",
        "语速": 2.0,
        "音调": 50.0,
        "音量": 2.0,
        "风格": "normal",
    }
    assert 服务.缓存.状态()["条目"] == 1


@pytest.mark.asyncio
async def test_合成服务edge与auto成功缓存(monkeypatch):
    服务 = 合成服务()
    服务._模式 = "edge"
    次数 = 0

    async def 边缘(*args, **kwargs):
        nonlocal 次数
        次数 += 1
        return b"ID3audio", "mp3"

    monkeypatch.setattr(服务._边缘, "合成", 边缘)
    首次 = await 服务.合成("缓存", "zh-CN-XiaoxiaoNeural")
    再次 = await 服务.合成("缓存", "zh-CN-XiaoxiaoNeural")
    assert 首次[2] is False and 再次[2] is True and 再次[1] == "mp3" and 次数 == 1

    自动服务 = 合成服务()
    自动服务._模式 = "auto"
    monkeypatch.setattr(自动服务._边缘, "合成", 边缘)
    自动结果 = await 自动服务.合成("自动", "zh-CN-XiaoxiaoNeural")
    assert 自动结果[3] == "zh-CN-XiaoxiaoNeural"
    assert 自动服务.提供者名() == "edge-tts+offline-sine(auto)"


@pytest.mark.asyncio
async def test_合成服务auto仅对可重试错误降级(monkeypatch):
    服务 = 合成服务()
    服务._模式 = "auto"
    离线调用 = 0

    async def 可重试失败(*args, **kwargs):
        raise 合成错误(502, "edge", True)

    async def 不可重试失败(*args, **kwargs):
        raise 合成错误(400, "edge", False)

    async def 离线(*args, **kwargs):
        nonlocal 离线调用
        离线调用 += 1
        return b"RIFF", "wav"

    monkeypatch.setattr(服务._边缘, "合成", 可重试失败)
    monkeypatch.setattr(服务._离线, "合成", 离线)
    降级结果 = await 服务.合成("降级", "zh-CN-XiaoxiaoNeural")
    assert 降级结果[3] == "zh-CN-XiaoxiaoNeural"
    assert 离线调用 == 1

    monkeypatch.setattr(服务._边缘, "合成", 不可重试失败)
    with pytest.raises(合成错误):
        await 服务.合成("不降级", "zh-CN-XiaoxiaoNeural")
    assert 离线调用 == 1


@pytest.mark.asyncio
async def test_合成服务异常后清理在途状态(monkeypatch):
    服务 = 合成服务()
    服务._模式 = "edge"

    async def 失败(*args, **kwargs):
        raise RuntimeError("boom")

    monkeypatch.setattr(服务._边缘, "合成", 失败)
    with pytest.raises(RuntimeError, match="boom"):
        await 服务.合成("清理", "zh-CN-XiaoxiaoNeural")
    assert 服务.缓存._在途 == {}


async def test_合成接口区分可重试不可重试与未知错误(monkeypatch):
    monkeypatch.setattr(鉴权模块.settings, "内部令牌", "test-internal-token-16p0")
    鉴权模块.合成限流器.重置()
    transport = httpx2.ASGITransport(app=app, raise_app_exceptions=False)

    async def 可重试(**kwargs):
        raise 合成错误(502, "稍后重试", True)

    monkeypatch.setattr(合成服务单例, "合成", 可重试)
    async with httpx2.AsyncClient(transport=transport, base_url="http://testserver") as 客户端:
        assert (await 客户端.post("/api/tts/synthesize", json={"text": "你好"}, headers=内部凭证头())).status_code == 502

        鉴权模块.合成限流器.重置()
        async def 不可重试(**kwargs):
            raise 合成错误(400, "输入错误", False)

        monkeypatch.setattr(合成服务单例, "合成", 不可重试)
        assert (await 客户端.post("/api/tts/synthesize", json={"text": "你好"}, headers=内部凭证头())).status_code == 400

        鉴权模块.合成限流器.重置()
        async def 未知(**kwargs):
            raise RuntimeError("secret")

        monkeypatch.setattr(合成服务单例, "合成", 未知)
        响应 = await 客户端.post("/api/tts/synthesize", json={"text": "你好"}, headers=内部凭证头())
    assert 响应.status_code == 500 and 响应.json()["detail"] == 文案.服务内部错误
    assert "secret" not in 响应.text


async def test_合成接口限流返回429(monkeypatch):
    monkeypatch.setattr(鉴权模块.settings, "内部令牌", "test-internal-token-16p0")
    monkeypatch.setattr(鉴权模块.settings, "合成限流次数", 1)
    鉴权模块.合成限流器.重置()

    async def 成功(**kwargs):
        return b"RIFF", "wav", False, "zh-CN-XiaoxiaoNeural"

    monkeypatch.setattr(合成服务单例, "合成", 成功)
    async with httpx2.AsyncClient(transport=httpx2.ASGITransport(app=app), base_url="http://testserver") as 客户端:
        首次 = await 客户端.post("/api/tts/synthesize", json={"text": "你好"}, headers=内部凭证头())
        再次 = await 客户端.post("/api/tts/synthesize", json={"text": "你好"}, headers=内部凭证头())
    assert 首次.status_code == 200 and 再次.status_code == 429
    assert 再次.json()["提示"] == 文案.请求频繁


def test_缓存连接按地址复用与切换(monkeypatch):
    import redis

    class 连接:
        def __init__(self, 地址):
            self.地址 = 地址

    monkeypatch.setattr(鉴权模块.settings, "缓存地址", "redis://one")
    monkeypatch.setattr(redis.Redis, "from_url", lambda 地址, **kwargs: 连接(地址))
    assert 取缓存连接().地址 == "redis://one"
    assert 取缓存连接() is 取缓存连接()
    monkeypatch.setattr(鉴权模块.settings, "缓存地址", "redis://two")
    assert 取缓存连接().地址 == "redis://two"


def test_吊销读取异常转为拒绝(monkeypatch):
    class 连接:
        def get(self, 键):
            raise OSError("down")

    monkeypatch.setattr(鉴权模块.settings, "缓存地址", "redis://test")
    monkeypatch.setattr(鉴权模块, "取缓存连接", lambda: 连接())
    with pytest.raises(ValueError, match="吊销检查不可用"):
        鉴权模块.读吊销值("键")


def test_签发时刻兼容毫秒秒与缺失():
    assert 鉴权模块.签发时刻毫秒({"qianFaHaoMiao": 123.9}) == 123
    assert 鉴权模块.签发时刻毫秒({"iat": 2}) == 2000
    assert 鉴权模块.签发时刻毫秒({}) is None


def test_验签覆盖依赖缺失过期与非字典载荷(monkeypatch):
    import builtins
    import jwt as PyJWT

    原始导入 = builtins.__import__

    def 阻断jwt(名称, *args, **kwargs):
        if 名称 == "jwt":
            raise ImportError("blocked")
        return 原始导入(名称, *args, **kwargs)

    monkeypatch.setattr(builtins, "__import__", 阻断jwt)
    with pytest.raises(ValueError, match="未安装PyJWT"):
        鉴权模块.验签并解载荷("token")
    monkeypatch.setattr(builtins, "__import__", 原始导入)

    密钥 = "单测专用密钥单测专用密钥0123456789"
    monkeypatch.setattr(鉴权模块.settings, "令牌密钥", 密钥)
    过期令牌 = PyJWT.encode({"exp": 0}, 密钥, algorithm="HS256")
    with pytest.raises(ValueError, match="令牌过期"):
        鉴权模块.验签并解载荷(过期令牌)
    monkeypatch.setattr(PyJWT, "decode", lambda *args, **kwargs: [])
    with pytest.raises(ValueError, match="载荷非法"):
        鉴权模块.验签并解载荷("token")


def test_内部令牌边界(monkeypatch):
    monkeypatch.setattr(鉴权模块.settings, "内部令牌", "short")
    with pytest.raises(鉴权模块.凭证异常, match=文案.缺凭证):
        鉴权模块.提取身份(建请求({"X-Internal-Token": "short"}))
    monkeypatch.setattr(鉴权模块.settings, "内部令牌", "test-internal-token-16p0")
    with pytest.raises(鉴权模块.凭证异常, match=文案.缺凭证):
        鉴权模块.提取身份(建请求({"X-Internal-Token": "wrong-token-16p0"}))
    assert 鉴权模块.提取身份(建请求(内部凭证头())) == "内部服务"
    with pytest.raises(鉴权模块.凭证异常, match=文案.缺凭证):
        鉴权模块.提取身份(建请求({"Authorization": "Bearer "}))


def test_滑动窗口过期后可再次请求(monkeypatch):
    时刻 = iter([1.0, 1.0, 2.0])
    monkeypatch.setattr(鉴权模块.time, "monotonic", lambda: next(时刻))
    限流器 = 滑动窗口限流器()
    assert 限流器.检查并占用("用户", 1, 1)
    assert not 限流器.检查并占用("用户", 1, 1)
    assert 限流器.检查并占用("用户", 1, 1)
