import json

import httpx
import pytest
import respx
from langchain_core.tools import ToolException
from pydantic import ValidationError

from app.agent import tools as 工具模块
from app.config import 取配置


@respx.mock
async def 测试_概览接口成功解包data():
    路由 = respx.get("http://localhost:8080/api/internal/stats/overview").respond(
        json={"code": 200, "message": "ok", "data": {"total_users": 100, "total_messages": 500}}
    )
    结果 = await 工具模块.概览逻辑()
    断言体 = json.loads(结果)
    assert 断言体["total_users"] == 100
    assert 路由.called
    assert 路由.calls.last.request.headers["X-Internal-Token"] == 取配置().INTERNAL_TOKEN


@respx.mock
async def 测试_趋势接口透传days参数():
    路由 = respx.get("http://localhost:8080/api/internal/stats/users/trend").respond(
        json={"code": 200, "message": "ok", "data": [{"date": "2026-08-25", "count": 12}]}
    )
    await 工具模块.注册趋势逻辑(14)
    assert dict(路由.calls.last.request.url.params)["days"] == "14"


@respx.mock
async def 测试_非200抛友好异常():
    respx.get("http://localhost:8080/api/internal/stats/overview").respond(status_code=500)
    with pytest.raises(ToolException) as 异常信息:
        await 工具模块.概览逻辑()
    assert "HTTP 500" in str(异常信息.value)


@respx.mock
async def 测试_超时转友好提示():
    respx.get("http://localhost:8080/api/internal/stats/overview").mock(
        side_effect=httpx.ConnectTimeout("timeout")
    )
    with pytest.raises(ToolException) as 异常信息:
        await 工具模块.概览逻辑()
    assert str(异常信息.value) == "运营数据服务响应超时，请稍后再试。"


@respx.mock
async def 测试_连接失败转友好提示():
    respx.get("http://localhost:8080/api/internal/stats/overview").mock(
        side_effect=httpx.ConnectError("refused")
    )
    with pytest.raises(ToolException):
        await 工具模块.概览逻辑()


@respx.mock
async def 测试_业务失败结构原样透出():
    respx.get("http://localhost:8080/api/internal/stats/overview").respond(
        json={"code": 500, "message": "db error"}
    )
    结果 = json.loads(await 工具模块.概览逻辑())
    assert 结果["message"] == "db error"


async def 测试_天数范围校验_下限():
    with pytest.raises(ValidationError):
        工具模块.趋势天数入参(days=6)


async def 测试_天数范围校验_上限():
    with pytest.raises(ValidationError):
        工具模块.趋势天数入参(days=31)


async def 测试_天数范围校验_边界内合法():
    assert 工具模块.趋势天数入参(days=7).days == 7
    assert 工具模块.趋势天数入参(days=30).days == 30


async def 测试_检索词长度校验():
    with pytest.raises(ValidationError):
        工具模块.检索入参(query="短")
    with pytest.raises(ValidationError):
        工具模块.检索入参(query="长" * 51)
    assert 工具模块.检索入参(query="好感度五维体系").query == "好感度五维体系"


@respx.mock
async def 测试_留存接口透传days参数():
    路由 = respx.get("http://localhost:8080/api/internal/stats/retention").respond(
        json={"code": 200, "message": "ok", "data": [{"date": "2026-08-25", "cohortSize": 10, "day1Rate": 50.0, "day3Rate": 30.0, "day7Rate": 20.0}]}
    )
    结果 = json.loads(await 工具模块.留存逻辑(7))
    assert 结果[0]["day1Rate"] == 50.0
    assert dict(路由.calls.last.request.url.params)["days"] == "7"


@respx.mock
async def 测试_留存工具注册进工具列表():
    名称们 = [t.name for t in 工具模块.工具列表]
    assert "query_retention" in 名称们
    消息 = await 工具模块.执行单个工具调用({"name": "query_retention", "args": {"days": 999}, "id": "c9"})
    assert 消息.content.startswith("[TOOL_ERROR]")


@respx.mock
async def 测试_执行兜底_未知工具():
    消息 = await 工具模块.执行单个工具调用({"name": "no_such_tool", "args": {}, "id": "c1"})
    assert 消息.content == "未知的工具：no_such_tool。"
    assert 消息.tool_call_id == "c1"


@respx.mock
async def 测试_执行兜底_参数非法():
    消息 = await 工具模块.执行单个工具调用({"name": "query_user_trend", "args": {"days": 999}, "id": "c2"})
    assert 消息.content.startswith("[TOOL_ERROR]")
    assert 消息.name == "query_user_trend"


@respx.mock
async def 测试_执行兜底_接口异常转错误标记():
    respx.get("http://localhost:8080/api/internal/stats/favorability/distribution").respond(status_code=503)
    消息 = await 工具模块.执行单个工具调用(
        {"name": "query_favorability_distribution", "args": {}, "id": "c3"}
    )
    assert 消息.content.startswith("[TOOL_ERROR]")
    assert "HTTP 503" in 消息.content
