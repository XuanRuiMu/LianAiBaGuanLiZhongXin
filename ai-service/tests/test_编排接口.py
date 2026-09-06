import pytest
from fastapi.testclient import TestClient

import app.api.编排 as 编排路由

五节点 = {
    "名称": "接口演示流",
    "节点": [
        {"编号": "开始", "类型": "开始"},
        {"编号": "取数", "类型": "代码", "参数": {"表达式": "40 + 2"}},
        {"编号": "结束", "类型": "结束"},
    ],
    "边": [{"从": "开始", "到": "取数"}, {"从": "取数", "到": "结束"}],
}


@pytest.fixture()
def 隔离库(tmp_path, monkeypatch):
    from app.编排.存储 import 编排存储
    from app.编排.追踪 import 追踪存储
    monkeypatch.setattr(编排路由, "_编排库", 编排存储(str(tmp_path / "编排.db")))
    monkeypatch.setattr(编排路由, "_追踪库", 追踪存储(str(tmp_path / "追踪.db")))
    return True


def _头():
    import os
    return {"X-Internal-Token": os.environ.get("INTERNAL_TOKEN", "test-token")}


class Test编排接口:
    def test_未登录拒收(self, 隔离库):
        from app.main import app
        客户端 = TestClient(app, raise_server_exceptions=False)
        assert 客户端.post("/api/v1/编排/执行",
                           json={"名称": "空", "输入": {}}).status_code == 401

    def test_保存执行回放全链路(self, 隔离库):
        from app.main import app
        客户端 = TestClient(app, raise_server_exceptions=False)
        保存 = 客户端.post("/api/v1/编排/流程", json={"定义": 五节点}, headers=_头())
        assert 保存.status_code == 200
        assert 保存.json()["data"]["版本"] == 1
        执行 = 客户端.post("/api/v1/编排/执行",
                           json={"名称": "接口演示流", "输入": {}}, headers=_头())
        assert 执行.status_code == 200
        数据 = 执行.json()["data"]
        assert 数据["状态"] == "成功"
        assert 数据["上下文"]["取数"] == 42
        回放 = 客户端.get("/api/v1/编排/回放",
                          params={"跟踪号": 数据["跟踪号"]}, headers=_头())
        assert 回放.status_code == 200
        assert len(回放.json()["data"]) >= 3
        查询 = 客户端.get("/api/v1/编排/执行",
                          params={"执行号": 数据["执行号"]}, headers=_头())
        assert 查询.json()["data"]["状态"] == "成功"

    def test_非法流程400(self, 隔离库):
        from app.main import app
        客户端 = TestClient(app, raise_server_exceptions=False)
        坏 = dict(五节点)
        坏["节点"] = [{"编号": "开始", "类型": "开始"},
                    {"编号": "甲", "类型": "外星节点"}]
        响应 = 客户端.post("/api/v1/编排/流程", json={"定义": 坏}, headers=_头())
        assert 响应.status_code == 400

    def test_YAML导出导入幂等(self, 隔离库):
        from app.main import app
        客户端 = TestClient(app, raise_server_exceptions=False)
        客户端.post("/api/v1/编排/流程", json={"定义": 五节点}, headers=_头())
        导出 = 客户端.get("/api/v1/编排/流程YAML",
                          params={"名称": "接口演示流"}, headers=_头())
        assert 导出.status_code == 200
        文本 = 导出.json()["data"]["yaml"]
        assert "开始" in 文本
        导入 = 客户端.post("/api/v1/编排/导入YAML", json={"文本": 文本}, headers=_头())
        assert 导入.json()["data"]["版本"] == 2
