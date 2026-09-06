from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from typing import Any

from langchain_core.tools import StructuredTool
from pydantic import BaseModel


@dataclass(frozen=True)
class 工具定义:
    名称: str
    描述: str
    参数模型: type[BaseModel] | None
    执行函数: Callable[..., Awaitable[str]]
    标签: tuple[str, ...] = ()


class 工具注册表:
    def __init__(self) -> None:
        self._表: dict[str, 工具定义] = {}

    def 注册(self, 定义: 工具定义) -> None:
        if 定义.名称 in self._表:
            raise ValueError(f"工具重名：{定义.名称}")
        self._表[定义.名称] = 定义

    def 取(self, 名称: str) -> 工具定义:
        return self._表[名称]

    def 全部(self) -> list[工具定义]:
        return list(self._表.values())

    def __contains__(self, 名称: object) -> bool:
        return 名称 in self._表

    def langchain工具(self) -> list[StructuredTool]:
        列表 = []
        for 定义 in self.全部():
            列表.append(StructuredTool.from_function(
                coroutine=定义.执行函数,
                name=定义.名称,
                description=定义.描述,
                args_schema=定义.参数模型,
            ))
        return 列表

    def 编排节点类型(self) -> list[dict[str, Any]]:
        return [
            {"类型": 定义.名称, "描述": 定义.描述, "标签": list(定义.标签),
             "参数": 定义.参数模型.model_json_schema() if 定义.参数模型 else {"type": "object", "properties": {}}}
            for 定义 in self.全部()
        ]

    def 开放接口模型(self) -> dict[str, Any]:
        return {
            "openapi": "3.1.0",
            "info": {"title": "恋爱吧数据中心工具总线", "version": "1.0.0"},
            "tools": [
                {"name": 定义.名称, "description": 定义.描述,
                 "parameters": 定义.参数模型.model_json_schema() if 定义.参数模型 else {"type": "object"}}
                for 定义 in self.全部()
            ],
        }

    def n8n节点描述(self) -> list[dict[str, Any]]:
        return [
            {"displayName": f"恋爱吧：{定义.名称}", "name": f"liaolian{定义.名称}",
             "description": 定义.描述, "标签": list(定义.标签)}
            for 定义 in self.全部()
        ]


注册表 = 工具注册表()


def _注册工具(名称: str, 描述: str, 参数模型: type[BaseModel] | None,
             执行函数: Callable[..., Awaitable[str]], 标签: tuple[str, ...] = ()) -> None:
    注册表.注册(工具定义(名称=名称, 描述=描述, 参数模型=参数模型, 执行函数=执行函数, 标签=标签))


def 装载内置工具() -> None:
    from app.工具总线 import 逻辑 as 逻辑模块
    if "query_overview" in 注册表:
        return
    _注册工具("query_overview", "查询「和我恋爱吧」平台核心运营数据总量概览，包括累计用户数、角色卡总数、消息总数等汇总指标。",
             None, 逻辑模块.概览逻辑, ("统计",))
    _注册工具("query_user_trend", "查询最近 N 天每日新增注册用户的趋势数据。",
             逻辑模块.趋势天数入参, 逻辑模块.注册趋势逻辑, ("统计", "趋势"))
    _注册工具("query_message_trend", "查询最近 N 天平台内用户与 AI 角色每日聊天消息量的趋势数据。",
             逻辑模块.趋势天数入参, 逻辑模块.消息趋势逻辑, ("统计", "趋势"))
    _注册工具("query_favorability_distribution", "查询全平台用户与 AI 角色的关系阶段分布。",
             None, 逻辑模块.关系分布逻辑, ("统计",))
    _注册工具("query_retention", "查询最近 N 天各注册批次用户的次日/3日/7日留存率（同期群分析）。",
             逻辑模块.趋势天数入参, 逻辑模块.留存逻辑, ("统计", "留存"))
    _注册工具("search_knowledge", "从产品知识库检索资料，包含产品手册、平台架构说明、运营常见问题。",
             逻辑模块.检索入参, 逻辑模块.知识检索逻辑, ("知识库",))


装载内置工具()
