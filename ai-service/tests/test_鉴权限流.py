import base64
import hashlib
import hmac
import json
import os
import time

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

import app.texts as texts
from app.api.鉴权 import (
    校验访问令牌,
    滑动窗口限流器,
    聊天限流器,
    鉴权限流中间件,
    解码载荷,
)


def _签发(用户名: str, 密钥: str, 过期秒: int = 3600) -> str:
    头 = base64.urlsafe_b64encode(json.dumps({"alg": "HS256", "typ": "JWT"}).encode()).decode().rstrip("=")
    体 = base64.urlsafe_b64encode(json.dumps({"sub": 用户名, "exp": time.time() + 过期秒}).encode()).decode().rstrip("=")
    签 = hmac.new(密钥.encode(), f"{头}.{体}".encode(), hashlib.sha256).digest()
    尾 = base64.urlsafe_b64encode(签).decode().rstrip("=")
    return f"{头}.{体}.{尾}"


def _测试应用() -> FastAPI:
    应用 = FastAPI()
    应用.middleware("http")(鉴权限流中间件)

    @应用.post("/api/chat/stream")
    async def 流():
        return {"ok": True}

    @应用.get("/api/health")
    async def 健():
        return {"status": "ok"}

    return 应用


class Test令牌校验:
    def test_自签令牌通过(self, monkeypatch):
        monkeypatch.setenv("JWT_SECRET", "单测专用密钥单测专用密钥0123456789")
        from app.config import 取配置
        取配置.cache_clear()
        try:
            令牌 = _签发("张三", "单测专用密钥单测专用密钥0123456789")
            assert 校验访问令牌(令牌) == "张三"
        finally:
            取配置.cache_clear()

    def test_过期令牌拒绝(self, monkeypatch):
        monkeypatch.setenv("JWT_SECRET", "单测专用密钥单测专用密钥0123456789")
        from app.config import 取配置
        取配置.cache_clear()
        try:
            令牌 = _签发("张三", "单测专用密钥单测专用密钥0123456789", 过期秒=-10)
            with pytest.raises(ValueError):
                校验访问令牌(令牌)
        finally:
            取配置.cache_clear()

    def test_错签令牌拒绝(self, monkeypatch):
        monkeypatch.setenv("JWT_SECRET", "单测专用密钥单测专用密钥0123456789")
        from app.config import 取配置
        取配置.cache_clear()
        try:
            令牌 = _签发("张三", "完全不同的密钥完全不同的密钥0123456789")
            with pytest.raises(ValueError):
                校验访问令牌(令牌)
        finally:
            取配置.cache_clear()

    def test_残缺令牌拒绝(self):
        with pytest.raises(ValueError):
            解码载荷("只有一段")


class Test中间件:
    def setup_method(self):
        聊天限流器.重置()

    def test_无凭证拒收(self):
        客户端 = TestClient(_测试应用(), raise_server_exceptions=False)
        响应 = 客户端.post("/api/chat/stream", json={"question": "你好", "history": []})
        assert 响应.status_code == 401
        assert 响应.json()["detail"] == texts.鉴权失败_缺凭证

    def test_伪造令牌拒收(self):
        客户端 = TestClient(_测试应用(), raise_server_exceptions=False)
        响应 = 客户端.post("/api/chat/stream", json={"question": "你好", "history": []},
                            headers={"Authorization": "Bearer fake.token.value"})
        assert 响应.status_code == 401
        assert 响应.json()["detail"] == texts.鉴权失败_令牌无效

    def test_内部令牌放行(self):
        客户端 = TestClient(_测试应用(), raise_server_exceptions=False)
        响应 = 客户端.post("/api/chat/stream", json={"question": "你好", "history": []},
                            headers={"X-Internal-Token": os.environ.get("INTERNAL_TOKEN", "test-token")})
        assert 响应.status_code == 200

    def test_健康检查免凭证(self):
        客户端 = TestClient(_测试应用(), raise_server_exceptions=False)
        响应 = 客户端.get("/api/health")
        assert 响应.status_code == 200

    def test_超限返回429(self, monkeypatch):
        import app.api.鉴权 as 鉴权模块

        class 假配置:
            JWT密钥 = ""
            INTERNAL_TOKEN = "test-token"
            聊天限流次数 = 1
            聊天限流窗口秒 = 60

        monkeypatch.setattr(鉴权模块, "取配置", lambda: 假配置())
        客户端 = TestClient(_测试应用(), raise_server_exceptions=False)
        头 = {"X-Internal-Token": "test-token"}
        assert 客户端.post("/api/chat/stream", json={}, headers=头).status_code == 200
        超限 = 客户端.post("/api/chat/stream", json={}, headers=头)
        assert 超限.status_code == 429
        assert 超限.json()["detail"] == texts.限流_超限


class Test限流器:
    def test_窗口滑动(self):
        限流 = 滑动窗口限流器()
        assert 限流.检查并占用("甲", 1, 60)
        assert not 限流.检查并占用("甲", 1, 60)
        assert 限流.检查并占用("乙", 1, 60)
        限流.重置()
        assert 限流.检查并占用("甲", 1, 60)


class Test主应用接线:
    def test_MCP已挂载(self):
        from app.main import app
        路径表 = [getattr(路由, "path", "") for 路由 in app.routes]
        assert any(路径.startswith("/mcp") for 路径 in 路径表)

    def test_双健康路径(self):
        from app.main import app
        客户端 = TestClient(app, raise_server_exceptions=False)
        assert 客户端.get("/api/health").status_code == 200
        assert 客户端.get("/health").status_code == 200
