from mcp.server.fastmcp import FastMCP

from app.agent.tools import 关系分布逻辑, 概览逻辑, 注册趋势逻辑, 知识检索逻辑

服务器 = FastMCP("liaolian-datacenter")


@服务器.tool()
async def query_overview() -> str:
    """获取「和我恋爱吧」平台核心运营总量概览（累计用户数、角色卡总数、消息总数等汇总指标）。"""
    return await 概览逻辑()


@服务器.tool()
async def query_user_trend(days: int) -> str:
    """查询最近 N 天每日新增注册用户趋势。

    Args:
        days: 统计回溯天数，7~30 之间的整数。
    """
    return await 注册趋势逻辑(days)


@服务器.tool()
async def query_favorability() -> str:
    """查询好感度关系阶段（冷淡/疏远/认识/熟悉/朋友/好友/暧昧/心动/热恋/深爱）分布。"""
    return await 关系分布逻辑()


@服务器.tool()
async def search_knowledge(query: str) -> str:
    """检索恋爱吧产品知识库（产品手册、平台架构说明、运营常见问题）。

    Args:
        query: 检索词，2~50 个字的中文短语。
    """
    return await 知识检索逻辑(query)


if __name__ == "__main__":
    服务器.run(transport="stdio")
