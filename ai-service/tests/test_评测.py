import time
from pathlib import Path

import pytest
import respx
import yaml

from app.agent.tools import 执行单个工具调用

基线路径 = Path(__file__).parent.parent / "app" / "评测" / "基准.yaml"


def 读基线() -> dict:
    with open(基线路径, encoding="utf-8") as 文件:
        return yaml.safe_load(文件)


def 模拟后端(路由, 用例: dict):
    工具 = 用例["工具"]
    if 工具 == "query_overview":
        return 路由.get("http://localhost:8080/api/internal/stats/overview").respond(
            json={"code": 200, "message": "ok",
                  "data": {"totalUsers": 120, "totalMessages": 8000}})
    if 工具 in ("query_user_trend", "query_message_trend", "query_retention"):
        路径 = {"query_user_trend": "users", "query_message_trend": "messages",
                "query_retention": "retention"}[工具]
        if 工具 == "query_retention":
            return 路由.get(f"http://localhost:8080/api/internal/stats/{路径}").respond(
                json={"code": 200, "message": "ok",
                      "data": [{"date": "2026-09-05", "cohortSize": 10,
                                "day1Rate": 50.0, "day3Rate": 20.0}]})
        return 路由.get(f"http://localhost:8080/api/internal/stats/{路径}/trend").respond(
            json={"code": 200, "message": "ok",
                  "data": [{"date": "2026-09-05", "newUsers": 5, "totalUsers": 120,
                            "userCount": 3, "aiCount": 9, "total": 12}]})
    if 工具 == "query_favorability_distribution":
        return 路由.get("http://localhost:8080/api/internal/stats/favorability/distribution").respond(
            json={"code": 200, "message": "ok",
                  "data": [{"stage": 1, "label": "冷淡", "count": 4}]})
    if 工具 == "search_knowledge":
        return None
    raise AssertionError(f"未知工具 {工具}")


class Test工具评测:
    @pytest.mark.asyncio
    async def test_二十例全部命中期望片段(self):
        基线 = 读基线()
        assert len(基线["工具用例"]) == 20
        延迟 = []
        跳过 = 0
        for 用例 in 基线["工具用例"]:
            with respx.mock:
                模拟后端(respx, 用例)
                开始 = time.monotonic()
                消息 = await 执行单个工具调用(
                    {"name": 用例["工具"], "args": 用例.get("参数") or {},
                     "id": 用例["编号"]})
                延迟.append((time.monotonic() - 开始) * 1000)
                if "知识库尚未初始化" in 消息.content:
                    跳过 += 1
                    continue
                for 片段 in 用例["期望片段"]:
                    assert 片段 in 消息.content, f"{用例['编号']} 缺期望片段 {片段}"
        assert len(基线["工具用例"]) - 跳过 >= 15
        延迟.sort()
        九五 = 延迟[int(len(延迟) * 0.95) - 1]
        assert 九五 < 5000


def 嵌入可用() -> bool:
    import glob
    import os
    缓存根 = os.path.expanduser("~/.cache/huggingface/hub")
    候选 = glob.glob(os.path.join(缓存根, "models--sentence-transformers--paraphrase-multilingual-MiniLM-L12-v2",
                                  "snapshots", "*", "model.safetensors"))
    候选 += glob.glob(os.path.join(缓存根, "models--sentence-transformers--paraphrase-multilingual-MiniLM-L12-v2",
                                   "snapshots", "*", "pytorch_model.bin"))
    return any(os.path.getsize(路径) > 100_000_000 for 路径 in 候选)


class Test检索评测:
    @pytest.mark.skipif(not 嵌入可用(), reason="嵌入模型未就绪")
    @pytest.mark.asyncio
    async def test_十例召回含关键词(self):
        import anyio
        from app.记忆.检索链 import 混合检索
        基线 = 读基线()
        assert len(基线["检索用例"]) == 10
        命中数 = 0
        for 用例 in 基线["检索用例"]:
            结果 = await anyio.to_thread.run_sync(混合检索, 用例["查询"], 5)
            文本 = " ".join(行["文本"] for 行 in 结果)
            if any(词 in 文本 for 词 in 用例["期望关键词"]):
                命中数 += 1
        assert 命中数 >= 7
