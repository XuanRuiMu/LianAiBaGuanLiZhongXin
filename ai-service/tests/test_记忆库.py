import os

import pytest

from app.记忆.记忆库 import 记忆库, 健康探针


def _测试串() -> str:
    密码 = os.environ.get("MEMORY_PG_PASSWORD", "MemoryDemo2026")
    return f"postgresql://postgres:{密码}@localhost:55433/love_memory"


@pytest.fixture()
def 本地库():
    return 记忆库(_测试串())


class Test记忆库:
    def test_探针连通(self):
        assert 健康探针() is True

    def test_情景读写(self, 本地库):
        本地库.写情景("单测会话", "用户关心留存", 3)
        assert 本地库.读情景("单测会话") == {"摘要": "用户关心留存", "轮数": 3}
        assert 本地库.读情景("不存在") == {"摘要": "", "轮数": 0}

    def test_语义存取(self, 本地库):
        import uuid
        后缀 = uuid.uuid4().hex[:8]
        文本 = f"好感度五维体系说明{后缀}"
        编号 = 本地库.存语义(文本, "产品手册",
                             [0.1] * 384, 置信度=0.9, 有效天数=1)
        assert 编号 > 0
        命中 = 本地库.向量召回([0.1] * 384, 条数=50)
        assert any(行["编号"] == 编号 for 行 in 命中)
        全文 = 本地库.全文召回(f"五维体系说明{后缀}", 条数=50)
        assert any(行["编号"] == 编号 for 行 in 全文)

    def test_跟踪回放(self, 本地库):
        import uuid
        跟踪号 = f"跟踪单测-{uuid.uuid4().hex[:8]}"
        本地库.记跨度(跟踪号, f"跨度-{uuid.uuid4().hex[:8]}", "测试节点", "成功", 12, "{}", "{}")
        回放 = 本地库.按跟踪回放(跟踪号)
        assert any(行["节点"] == "测试节点" for 行 in 回放)
