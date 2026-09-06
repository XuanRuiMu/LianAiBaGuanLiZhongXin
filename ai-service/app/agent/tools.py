from langchain_core.messages import ToolMessage
from langchain_core.tools import ToolException
from pydantic import ValidationError

import app.texts as texts
from app.工具总线.逻辑 import (
    关系分布逻辑,
    概览逻辑,
    注册趋势逻辑,
    留存逻辑,
    消息趋势逻辑,
    知识检索逻辑,
    请求内部接口,
    检索入参,
    趋势天数入参,
)
from app.工具总线.注册表 import 注册表

__all__ = [
    "关系分布逻辑", "概览逻辑", "注册趋势逻辑", "留存逻辑", "消息趋势逻辑",
    "知识检索逻辑", "请求内部接口", "检索入参", "趋势天数入参",
    "工具列表", "执行单个工具调用",
]

工具列表 = 注册表.langchain工具()


async def 执行单个工具调用(调用: dict) -> ToolMessage:
    工具名 = str(调用.get("name") or "")
    if 工具名 not in 注册表:
        内容 = texts.工具错误_未知工具.format(tool_name=工具名)
    else:
        定义 = 注册表.取(工具名)
        try:
            参数 = 调用.get("args") or {}
            if 定义.参数模型 is not None:
                已校验 = 定义.参数模型.model_validate(参数)
                内容 = await 定义.执行函数(**已校验.model_dump())
            else:
                内容 = await 定义.执行函数()
        except ToolException as 异常:
            内容 = f"{texts.标记_工具错误} {异常}"
        except ValidationError as 异常:
            内容 = f"{texts.标记_工具错误} {texts.工具错误_参数非法.format(detail=异常.errors()[0].get('msg', ''))}"
        except Exception:
            内容 = f"{texts.标记_工具错误} {texts.工具错误_通用}"
    return ToolMessage(content=内容, name=工具名, tool_call_id=str(调用.get("id") or ""))
