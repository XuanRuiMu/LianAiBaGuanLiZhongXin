import pytest

from app.网关.网关 import 兜底模板提供者, 模型提供者, 模型网关, 网关答复


class 必败提供者(模型提供者):
    名称 = "必败"

    async def 问答(self, 提示词: str) -> 网关答复:
        raise RuntimeError("模拟故障")


class 回显提供者(模型提供者):
    名称 = "回显"

    async def 问答(self, 提示词: str) -> 网关答复:
        return 网关答复(文本=f"回显:{提示词}", 提供者=self.名称,
                        模型="echo-1", 输入Token=10, 输出Token=5)


class Test降级链:
    @pytest.mark.asyncio
    async def test_主败降备选再兜底(self):
        网关 = 模型网关(提供者列表=[必败提供者(), 回显提供者(), 兜底模板提供者()])
        答复 = await 网关.问答("你好")
        assert 答复.文本 == "回显:你好"
        assert 答复.降级 is False

    @pytest.mark.asyncio
    async def test_全败兜底模板(self):
        网关 = 模型网关(提供者列表=[必败提供者(), 兜底模板提供者()])
        答复 = await 网关.问答("你好")
        assert 答复.降级 is True
        assert 答复.提供者 == "兜底模板"

    @pytest.mark.asyncio
    async def test_熔断跳过故障者(self):
        网关 = 模型网关(熔断阈值=1, 熔断秒=3600,
                        提供者列表=[必败提供者(), 回显提供者()])
        assert (await 网关.问答("甲")).提供者 == "回显"
        assert (await 网关.问答("乙")).提供者 == "回显"
        assert 网关._状态["必败"].连续失败 == 1

    @pytest.mark.asyncio
    async def test_预算超限拒绝(self):
        网关 = 模型网关(累计金额上限元=0.0, 提供者列表=[回显提供者()])
        with pytest.raises(ValueError):
            await 网关.问答("你好")

    @pytest.mark.asyncio
    async def test_健康检查结构(self):
        网关 = 模型网关(提供者列表=[回显提供者(), 兜底模板提供者()])
        健康 = await 网关.健康检查()
        assert 健康 == {"回显": True, "兜底模板": True}
