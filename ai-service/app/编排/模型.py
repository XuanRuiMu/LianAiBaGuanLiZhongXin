from typing import Any, Literal

from pydantic import BaseModel, Field

节点类型 = Literal["开始", "结束", "大模型", "工具调用", "条件分支", "循环", "代码", "人工审批"]

节点类型清单: tuple[str, ...] = ("开始", "结束", "大模型", "工具调用", "条件分支", "循环", "代码", "人工审批")


class 条件表达式(BaseModel):
    左: str = Field(description="JSON路径，如 $.概览.totalUsers")
    算子: Literal["==", "!=", ">", ">=", "<", "<=", "包含", "不包含"] = "=="
    右: Any = None


class 节点定义(BaseModel):
    编号: str = Field(min_length=1, max_length=64)
    类型: str
    名称: str = ""
    参数: dict[str, Any] = Field(default_factory=dict)
    超时秒: float = Field(default=30, ge=1, le=600)
    最大重试: int = Field(default=1, ge=0, le=5)
    出错跳到: str = ""
    条件: 条件表达式 | None = None


class 边定义(BaseModel):
    从: str
    到: str
    分支: str = ""


class 流程定义(BaseModel):
    名称: str = Field(min_length=1, max_length=128)
    版本: int = Field(default=1, ge=1)
    节点: list[节点定义]
    边: list[边定义] = Field(default_factory=list)
    超时秒: float = Field(default=300, ge=10, le=3600)
