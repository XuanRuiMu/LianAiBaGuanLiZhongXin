import pytest
from fastapi.testclient import TestClient

from app.cache import 合成缓存, 缓存键
from app.provider import 离线Provider, 合成错误, EdgeTTSProvider
from app.router import estimate_duration_ms
from app.voices import 归一化音色, 是否已知音色, 音色目录, 旧别名映射


class TestEstimateDuration:
    def test_basic(self):
        assert estimate_duration_ms("你好世界", 1.0) > 0

    def test_speed(self):
        assert estimate_duration_ms("测试文本", 2.0) < estimate_duration_ms("测试文本", 1.0) < estimate_duration_ms("测试文本", 0.5)

    def test_longer(self):
        assert estimate_duration_ms("这是一段很长的测试文本用来验证时长估算是否正确", 1.0) > estimate_duration_ms("短", 1.0)


class TestVoices:
    def test_catalog_size(self):
        assert len(音色目录) >= 10

    def test_alias(self):
        assert 归一化音色("female-shaonv", "zh-CN-XiaoxiaoNeural") == "zh-CN-XiaoxiaoNeural"
        assert 归一化音色("male-qn-chenqing", "zh-CN-XiaoxiaoNeural") == "zh-CN-YunyangNeural"
        assert 归一化音色(None, "zh-CN-XiaoxiaoNeural") == "zh-CN-XiaoxiaoNeural"
        assert 归一化音色("zh-CN-YunjianNeural", "zh-CN-XiaoxiaoNeural") == "zh-CN-YunjianNeural"

    def test_known(self):
        assert 是否已知音色("zh-CN-XiaoxiaoNeural")
        assert 是否已知音色("female-shaonv")
        for 别名 in 旧别名映射:
            assert 是否已知音色(别名)


class TestCache:
    @pytest.mark.asyncio
    async def test_key_stable(self):
        k1 = 缓存键("你好", "zh-CN-XiaoxiaoNeural", 1.0, 0.0, 1.0, "normal")
        k2 = 缓存键("你好", "zh-CN-XiaoxiaoNeural", 1.0, 0.0, 1.0, "normal")
        k3 = 缓存键("你好", "zh-CN-YunjianNeural", 1.0, 0.0, 1.0, "normal")
        assert k1 == k2 and k1 != k3 and len(k1) == 64

    @pytest.mark.asyncio
    async def test_lru_evict(self):
        c = 合成缓存(2)
        await c.存("a", b"1")
        await c.存("b", b"2")
        await c.存("c", b"3")
        assert await c.取("a") is None
        assert await c.取("b") == b"2"


class TestOffline:
    @pytest.mark.asyncio
    async def test_wav_header(self):
        p = 离线Provider()
        数据, 格式 = await p.合成("你好世界", "zh-CN-XiaoxiaoNeural", 1.0, 0.0, 1.0, "normal")
        assert 格式 == "wav" and 数据[:4] == b"RIFF" and len(数据) > 1000

    @pytest.mark.asyncio
    async def test_validation(self):
        from app.provider import 合成服务
        s = 合成服务()
        s._模式 = "offline"
        with pytest.raises(合成错误):
            await s.合成("", "zh-CN-XiaoxiaoNeural")
        with pytest.raises(合成错误):
            await s.合成("x" * 6000, "zh-CN-XiaoxiaoNeural")

    @pytest.mark.asyncio
    async def test_offline_cache_hit(self):
        from app.provider import 合成服务
        s = 合成服务()
        s._模式 = "offline"
        d1, f1, c1, _ = await s.合成("缓存测试文本", "zh-CN-XiaoxiaoNeural")
        d2, f2, c2, _ = await s.合成("缓存测试文本", "zh-CN-XiaoxiaoNeural")
        assert d1 == d2 and not c1 and c2


class TestEdgeModulation:
    def test_style_map(self):
        r, p, v = EdgeTTSProvider._调制(1.0, 0.0, 1.0, "cheerful")
        assert r != "+0%" or p != "+0Hz"
        r2, p2, v2 = EdgeTTSProvider._调制(1.0, 0.0, 1.0, "unknown-style")
        assert r2 == "+0%" and p2 == "+0Hz"


class TestRouter:
    def test_voices(self):
        from app.main import app
        c = TestClient(app)
        r = c.get("/api/tts/voices")
        assert r.status_code == 200
        body = r.json()
        assert body["count"] >= 10 and any(v["id"] == "zh-CN-XiaoxiaoNeural" for v in body["voices"])

    def test_health(self):
        from app.main import app
        c = TestClient(app)
        r = c.get("/api/tts/health")
        assert r.status_code == 200 and r.json()["status"] == "ok"

    def test_synthesize_offline(self, monkeypatch):
        import app.router as 路由
        from app.main import app
        from app.provider import 离线Provider
        离线 = 离线Provider()

        async def 假合成(**kwargs):
            数据, 格式 = await 离线.合成(kwargs.get("文本", "你好"), kwargs.get("音色") or "zh-CN-XiaoxiaoNeural", kwargs.get("语速", 1.0), 0.0, 1.0, "normal")
            return 数据, 格式, False, "zh-CN-XiaoxiaoNeural"

        monkeypatch.setattr(路由.合成服务单例, "合成", 假合成)
        c = TestClient(app)
        r = c.post("/api/tts/synthesize", json={"text": "你好呀", "voice": "zh-CN-XiaoxiaoNeural"})
        assert r.status_code == 200
        body = r.json()
        assert body["audio_hex"] and body["duration_ms"] > 0 and body["voice"] == "zh-CN-XiaoxiaoNeural"

    def test_compat_alias(self, monkeypatch):
        import app.router as 路由
        from app.main import app
        from app.provider import 离线Provider
        离线 = 离线Provider()
        捕获 = {}

        async def 假合成(**kwargs):
            捕获.update(kwargs)
            数据, 格式 = await 离线.合成("x", "zh-CN-XiaoxiaoNeural", 1.0, 0.0, 1.0, "normal")
            return 数据, 格式, False, "zh-CN-XiaoxiaoNeural"

        monkeypatch.setattr(路由.合成服务单例, "合成", 假合成)
        c = TestClient(app)
        r = c.post("/api/tts/synthesize", json={"text": "兼容测试", "voice_id": "female-shaonv", "speed": 1.2})
        assert r.status_code == 200

    def test_validation(self):
        from app.main import app
        c = TestClient(app)
        assert c.post("/api/tts/synthesize", json={"text": "", "voice": "zh-CN-XiaoxiaoNeural"}).status_code == 422
        assert c.post("/api/tts/synthesize", json={"text": "x" * 5001, "voice": "v"}).status_code == 422
        assert c.post("/api/tts/synthesize", json={"text": "hi", "voice": "v", "speed": 3.0}).status_code == 422

    def test_未知音色被白名单拒绝(self):
        from app.main import app
        c = TestClient(app)
        r = c.post("/api/tts/synthesize", json={"text": "你好", "voice": "zh-CN-NotExistNeural"})
        assert r.status_code == 400
        assert "未知音色" in r.json()["detail"]

    def test_已知音色与旧别名均放行(self, monkeypatch):
        import app.router as 路由
        from app.main import app
        from app.provider import 离线Provider
        离线 = 离线Provider()

        async def 假合成(**kwargs):
            数据, 格式 = await 离线.合成("你好", kwargs.get("音色") or "zh-CN-XiaoxiaoNeural", 1.0, 0.0, 1.0, "normal")
            return 数据, 格式, False, kwargs.get("音色") or "zh-CN-XiaoxiaoNeural"

        monkeypatch.setattr(路由.合成服务单例, "合成", 假合成)
        c = TestClient(app)
        for 音色 in ["zh-CN-XiaoxiaoNeural", "female-shaonv"]:
            r = c.post("/api/tts/synthesize", json={"text": "你好", "voice": 音色})
            assert r.status_code == 200, 音色
