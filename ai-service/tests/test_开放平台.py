import json
import time

import pytest
from fastapi.testclient import TestClient

import app.开放平台.投递器 as 投递器模块
from app.开放平台.存储 import 开放平台存储, 计算签名
from app.开放平台.渠道 import 广播通知


@pytest.fixture()
def 测试存储(tmp_path, monkeypatch):
    存储 = 开放平台存储(str(tmp_path / "开放.db"))
    monkeypatch.setattr(投递器模块, "_存储", 存储)
    import app.api.开放平台 as 开放路由
    monkeypatch.setattr(开放路由, "取存储", lambda: 存储)
    return 存储


class Test密钥配额:
    def test_创建校验占用(self, tmp_path):
        存储 = 开放平台存储(str(tmp_path / "密钥.db"))
        明文 = 存储.创建密钥("测试应用", 配额=2)
        assert 存储.校验并占用(明文) == "测试应用"
        assert 存储.校验并占用(明文) == "测试应用"
        assert 存储.校验并占用(明文) is None
        assert 存储.校验并占用("伪造") is None


class Test开放端点:
    def test_无钥拒收(self, 测试存储):
        from app.main import app
        客户端 = TestClient(app, raise_server_exceptions=False)
        assert 客户端.get("/api/v1/公开概览").status_code == 401
        assert 客户端.get("/api/v1/工具清单").status_code == 401

    def test_工具清单需钥但免后端(self, 测试存储):
        from app.main import app
        明文 = 测试存储.创建密钥("清单应用")
        客户端 = TestClient(app, raise_server_exceptions=False)
        响应 = 客户端.get("/api/v1/工具清单", headers={"X-API-Key": 明文})
        assert 响应.status_code == 200
        assert 响应.json()["openapi"] == "3.1.0"
        assert len(响应.json()["tools"]) == 6


class Test入站Webhook:
    def _签名头(self, 载荷: bytes, 密钥="dev-event-secret"):
        时间戳 = str(int(time.time()))
        return {"X-Event-Sign": 计算签名(密钥, 时间戳, 载荷),
                "X-Event-Time": 时间戳, "X-Idempotency-Key": f"key-{时间戳}"}

    def test_缺头400(self, 测试存储):
        from app.main import app
        客户端 = TestClient(app, raise_server_exceptions=False)
        assert 客户端.post("/api/v1/webhooks/外部触发",
                           json={"事件": "测试", "数据": {}}).status_code == 400

    def test_签名幂等全链路(self, 测试存储):
        from app.main import app
        客户端 = TestClient(app, raise_server_exceptions=False)
        载荷 = json.dumps({"事件": "同步完成", "数据": {}},
                          ensure_ascii=False).encode("utf-8")
        时间戳 = str(int(time.time()))
        头 = {"X-Event-Sign": 计算签名("dev-event-secret", 时间戳, 载荷),
              "X-Event-Time": 时间戳, "X-Idempotency-Key": "idem-001",
              "Content-Type": "application/json"}
        第一次 = 客户端.post("/api/v1/webhooks/外部触发", content=载荷, headers=头)
        assert 第一次.status_code == 200
        assert 第一次.json()["data"] == {"已受理": "同步完成"}
        第二次 = 客户端.post("/api/v1/webhooks/外部触发", content=载荷, headers=头)
        assert 第二次.json().get("幂等命中") is True

    def test_错签名401(self, 测试存储):
        from app.main import app
        客户端 = TestClient(app, raise_server_exceptions=False)
        载荷 = json.dumps({"事件": "测试", "数据": {}},
                          ensure_ascii=False).encode("utf-8")
        时间戳 = str(int(time.time()))
        头 = {"X-Event-Sign": 计算签名("错密钥", 时间戳, 载荷),
              "X-Event-Time": 时间戳, "X-Idempotency-Key": "idem-002",
              "Content-Type": "application/json"}
        assert 客户端.post("/api/v1/webhooks/外部触发",
                           content=载荷, headers=头).status_code == 401


class Test渠道:
    @pytest.mark.asyncio
    async def test_未配置全部跳过不阻断(self, monkeypatch):
        from app.config import 取配置
        取配置.cache_clear()
        monkeypatch.setenv("FEISHU_WEBHOOK", "")
        monkeypatch.setenv("WEWORK_WEBHOOK", "")
        monkeypatch.setenv("DINGTALK_WEBHOOK", "")
        monkeypatch.setenv("SMTP_HOST", "")
        try:
            assert await 广播通知("标题", "内容") == {}
        finally:
            取配置.cache_clear()
