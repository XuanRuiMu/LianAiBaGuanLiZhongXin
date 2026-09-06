import pytest

from app.工具总线.注册表 import 工具定义, 工具注册表, 注册表


class Test唯一真源:
    def test_六工具齐全(self):
        名称们 = sorted(定义.名称 for 定义 in 注册表.全部())
        assert 名称们 == sorted([
            "query_overview", "query_user_trend", "query_message_trend",
            "query_favorability_distribution", "query_retention", "search_knowledge",
        ])

    def test_五处导出名称一致(self):
        langchain名 = sorted(t.name for t in 注册表.langchain工具())
        节点名 = sorted(n["类型"] for n in 注册表.编排节点类型())
        开放名 = sorted(t["name"] for t in 注册表.开放接口模型()["tools"])
        n8n名 = sorted(n["name"] for n in 注册表.n8n节点描述())
        基准 = sorted(定义.名称 for 定义 in 注册表.全部())
        assert langchain名 == 基准
        assert 节点名 == 基准
        assert 开放名 == 基准
        assert len(n8n名) == len(基准)

    def test_重名注册拒绝(self):
        新表 = 工具注册表()
        定义 = 工具定义(名称="重复", 描述="甲", 参数模型=None, 执行函数=None)
        新表.注册(定义)
        with pytest.raises(ValueError):
            新表.注册(定义)

    def test_未知工具名抛错(self):
        with pytest.raises(KeyError):
            注册表.取("no_such_tool")


class Test执行链路:
    @pytest.mark.asyncio
    async def test_未知工具中文提示(self):
        from app.agent.tools import 执行单个工具调用
        消息 = await 执行单个工具调用({"name": "no_such_tool", "args": {}, "id": "c1"})
        assert "未知" in 消息.content

    @pytest.mark.asyncio
    async def test_参数非法中文提示(self):
        from app.agent.tools import 执行单个工具调用
        消息 = await 执行单个工具调用({"name": "query_user_trend", "args": {"days": 999}, "id": "c2"})
        assert "工具" in 消息.content or "参数" in 消息.content
