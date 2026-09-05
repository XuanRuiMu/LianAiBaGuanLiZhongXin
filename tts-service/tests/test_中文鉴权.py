import base64
import hashlib
import hmac
import json
import time

import pytest
from fastapi.testclient import TestClient

from app import 文案
from app.main import app
from app.provider import 合成错误, 合成服务
from app.router import 估算时长毫秒, 合成请求, 合成响应
from app.voices import 是否已知音色, 归一化音色, 音色目录, 旧别名映射
from app.鉴权 import 校验访问令牌, 合成限流器


def _签发(用户名: str, 密钥: str, 过期秒: int = 3600) -> str:
    头 = base64.urlsafe_b64encode(json.dumps({"alg": "HS256", "typ": "JWT"}).encode()).decode().rstrip("=")
    体 = base64.urlsafe_b64encode(json.dumps({"sub": 用户名, "exp": time.time() + 过期秒}).encode()).decode().rstrip("=")
    签 = hmac.new(密钥.encode(), f"{头}.{体}".encode(), hashlib.sha256).digest()
    尾 = base64.urlsafe_b64encode(签).decode().rstrip("=")
    return f"{头}.{体}.{尾}"


class Test中文收尾:
    def test_音色目录无英文键(self):
        for 条目 in 音色目录:
            assert "id" not in 条目
            assert "编号" in 条目

    def test_风格预设无英文键(self):
        from app.provider import 风格预设
        for 名, 预设 in 风格预设.items():
            assert "rate" not in 预设 and "pitch" not in 预设
            assert "语速偏移" in 预设 and "音调偏移" in 预设

    def test_合成错误全中文属性(self):
        错误 = 合成错误(400, "演示", 可重试=True)
        assert 错误.错误码 == 400 and 错误.错误信息 == "演示" and 错误.可重试
        assert not hasattr(错误, "code") and not hasattr(错误, "message") and not hasattr(错误, "retryable")

    def test_请求模型线名兼容旧英文键(self):
        请求 = 合成请求.model_validate({"text": "你好", "voice": "zh-CN-XiaoxiaoNeural"})
        assert 请求.文本 == "你好" and 请求.音色 == "zh-CN-XiaoxiaoNeural"
        响应 = 合成响应(音频十六进制="ff", 时长毫秒=100, 格式="wav", 实际音色="甲", 实际提供者="乙")
        线 = 响应.model_dump(by_alias=True)
        assert set(线) == {"audio_hex", "duration_ms", "format", "voice", "cached", "provider"}

    def test_旧别名仅作兼容保留(self):
        assert 归一化音色("female-shaonv", "zh-CN-XiaoxiaoNeural") == "zh-CN-XiaoxiaoNeural"
        assert 是否已知音色("female-shaonv")
        for 别名 in 旧别名映射:
            assert 是否已知音色(别名)


class Test合成鉴权:
    def setup_method(self):
        合成限流器.重置()

    def test_无凭证拒收(self):
        客户端 = TestClient(app, raise_server_exceptions=False)
        响应 = 客户端.post("/api/tts/synthesize", json={"text": "你好"})
        assert 响应.status_code == 401
        assert 响应.json()["提示"] == 文案.缺凭证

    def test_伪造令牌拒收(self):
        客户端 = TestClient(app, raise_server_exceptions=False)
        响应 = 客户端.post("/api/tts/synthesize", json={"text": "你好"},
                            headers={"Authorization": "Bearer fake.token.value"})
        assert 响应.status_code == 401

    def test_健康与音色免凭证(self):
        客户端 = TestClient(app, raise_server_exceptions=False)
        assert 客户端.get("/api/tts/health").status_code == 200
        assert 客户端.get("/health").status_code == 200
        音色响应 = 客户端.get("/api/tts/voices")
        assert 音色响应.status_code == 200
        assert "音色列表" in 音色响应.json()

    def test_令牌校验(self, monkeypatch):
        import app.鉴权 as 鉴权模块
        monkeypatch.setattr(鉴权模块.settings, "令牌密钥", "单测专用密钥单测专用密钥0123456789")
        try:
            令牌 = _签发("李四", "单测专用密钥单测专用密钥0123456789")
            assert 校验访问令牌(令牌) == "李四"
            with pytest.raises(ValueError):
                校验访问令牌(_签发("李四", "错错错错错错错错错错错错错错错错01234"))
        finally:
            monkeypatch.setattr(鉴权模块.settings, "令牌密钥", "")

    def test_离线模式凭证通过可合成(self, monkeypatch):
        import app.鉴权 as 鉴权模块
        from app.provider import 合成服务单例
        monkeypatch.setattr(鉴权模块.settings, "内部令牌", "test-internal-token-p0")
        monkeypatch.setattr(合成服务单例, "_模式", "offline")
        try:
            客户端 = TestClient(app, raise_server_exceptions=False)
            响应 = 客户端.post("/api/tts/synthesize", json={"text": "你好世界"},
                                headers={"X-Internal-Token": "test-internal-token-p0"})
            assert 响应.status_code == 200
            assert 响应.json()["format"] == "wav"
        finally:
            monkeypatch.setattr(鉴权模块.settings, "内部令牌", "")


class Test离线合成中文文案:
    @pytest.mark.asyncio
    async def test_空文本中文提示(self):
        服务 = 合成服务()
        服务._模式 = "offline"
        with pytest.raises(合成错误) as 捕获:
            await 服务.合成("", "zh-CN-XiaoxiaoNeural")
        assert 捕获.value.错误信息 == 文案.文本不能为空

    def test_时长估算(self):
        assert 估算时长毫秒("你好世界", 1.0) > 0
