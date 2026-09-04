import json

from app.api.sse import 格式化sse事件
from app.texts import 提取文本


async def 测试_token事件格式正确():
    文本 = 格式化sse事件("token", {"content": "你好"})
    assert 文本.endswith("\n\n")
    assert 文本.startswith("data: ")
    体 = json.loads(文本[len("data: ") :].strip())
    assert 体 == {"type": "token", "content": "你好"}


async def 测试_中文不做unicode转义():
    assert "你好" in 格式化sse事件("token", {"content": "你好"})


async def 测试_done事件无附加字段():
    体 = json.loads(格式化sse事件("done")[len("data: ") :].strip())
    assert 体 == {"type": "done"}


async def 测试_error事件携带消息():
    体 = json.loads(格式化sse事件("error", {"message": "服务异常"})[len("data: ") :].strip())
    assert 体["type"] == "error"
    assert 体["message"] == "服务异常"


async def 测试_提取文本兼容str与list():
    assert 提取文本("abc") == "abc"
    assert 提取文本([{"text": "a"}, {"text": "b"}, {"foo": 1}, "忽略"]) == "ab"
    assert 提取文本(None) == ""
    assert 提取文本(123) == ""
