import time
import uuid

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

import app.texts as texts
from app.api.鉴权 import 提取身份
from app.编排.存储 import 编排存储
from app.编排.模型 import 流程定义
from app.编排.追踪 import 追踪存储
from app.编排.引擎 import 编排引擎, 编排错误
from app.工具总线.注册表 import 注册表
from app.开放平台.投递器 import 取存储 as 取开放存储
from app.开放平台.投递器 import 发布事件

路由 = APIRouter()

_编排库: 编排存储 | None = None
_追踪库: 追踪存储 | None = None


def 取编排库() -> 编排存储:
    global _编排库
    if _编排库 is None:
        _编排库 = 编排存储()
    return _编排库


def 取追踪库() -> 追踪存储:
    global _追踪库
    if _追踪库 is None:
        _追踪库 = 追踪存储()
    return _追踪库


def 取引擎() -> 编排引擎:
    async def 大模型调用(提示词: str) -> str:
        from app.llm import 创建聊天模型
        return str((await 创建聊天模型().ainvoke(提示词)).content)
    return 编排引擎(取编排库(), 取追踪库(), 注册表, 大模型调用)


def _需登录(请求: Request):
    from app.api.鉴权 import 凭证异常
    try:
        return 提取身份(请求)
    except 凭证异常 as 异常:
        return JSONResponse(status_code=异常.状态码, content={"detail": 异常.文案})


@路由.get("/api/v1/编排/节点类型")
async def 节点类型(请求: Request):
    身份 = _需登录(请求)
    if isinstance(身份, JSONResponse):
        return 身份
    return {"code": 200, "data": 注册表.编排节点类型()}


class 保存请求(BaseModel):
    定义: dict


@路由.post("/api/v1/编排/流程")
async def 保存流程(请求: Request, 体: 保存请求):
    身份 = _需登录(请求)
    if isinstance(身份, JSONResponse):
        return 身份
    try:
        定义 = 流程定义.model_validate(体.定义)
        取引擎().校验(定义)
        版本 = 取编排库().保存版本(定义)
        try:
            发布事件("流程已保存", {"流程": 定义.名称, "版本": 版本})
        except Exception:
            pass
        return {"code": 200, "data": {"名称": 定义.名称, "版本": 版本}}
    except 编排错误 as 异常:
        return JSONResponse(status_code=400, content={"detail": str(异常)})
    except Exception:
        return JSONResponse(status_code=400, content={"detail": texts.编排_定义非法})


@路由.get("/api/v1/编排/流程")
async def 读取流程(请求: Request, 名称: str, 版本: int = 0):
    身份 = _需登录(请求)
    if isinstance(身份, JSONResponse):
        return 身份
    定义 = 取编排库().取版本(名称, 版本)
    if 定义 is None:
        return JSONResponse(status_code=404, content={"detail": "流程不存在"})
    return {"code": 200, "data": 定义.model_dump()}


@路由.get("/api/v1/编排/流程YAML")
async def 导出流程(请求: Request, 名称: str, 版本: int = 0):
    身份 = _需登录(请求)
    if isinstance(身份, JSONResponse):
        return 身份
    定义 = 取编排库().取版本(名称, 版本)
    if 定义 is None:
        return JSONResponse(status_code=404, content={"detail": "流程不存在"})
    return {"code": 200, "data": {"yaml": 取编排库().导出YAML(定义)}}


class 导入请求(BaseModel):
    文本: str


@路由.post("/api/v1/编排/导入YAML")
async def 导入流程(请求: Request, 体: 导入请求):
    身份 = _需登录(请求)
    if isinstance(身份, JSONResponse):
        return 身份
    try:
        定义 = 取编排库().从YAML导入(体.文本)
        取引擎().校验(定义)
        版本 = 取编排库().保存版本(定义)
        return {"code": 200, "data": {"名称": 定义.名称, "版本": 版本}}
    except (编排错误, ValueError) as 异常:
        return JSONResponse(status_code=400, content={"detail": str(异常)})


class 执行请求(BaseModel):
    名称: str
    版本: int = 0
    输入: dict = {}


@路由.post("/api/v1/编排/执行")
async def 执行流程(请求: Request, 体: 执行请求):
    身份 = _需登录(请求)
    if isinstance(身份, JSONResponse):
        return 身份
    定义 = 取编排库().取版本(体.名称, 体.版本)
    if 定义 is None:
        return JSONResponse(status_code=404, content={"detail": "流程不存在"})
    try:
        结果 = await 取引擎().运行(定义, 体.输入)
        try:
            发布事件("流程执行完成", {"流程": 体.名称, "状态": 结果["状态"]})
        except Exception:
            pass
        return {"code": 200, "data": 结果}
    except 编排错误 as 异常:
        return JSONResponse(status_code=400, content={"detail": str(异常)})


class 审批请求(BaseModel):
    执行号: str
    批准: bool = True
    意见: str = ""


@路由.post("/api/v1/编排/审批")
async def 审批回调(请求: Request, 体: 审批请求):
    身份 = _需登录(请求)
    if isinstance(身份, JSONResponse):
        return 身份
    try:
        结果 = await 取引擎().恢复(体.执行号, {"批准": 体.批准, "意见": 体.意见})
        return {"code": 200, "data": 结果}
    except 编排错误 as 异常:
        return JSONResponse(status_code=400, content={"detail": str(异常)})


@路由.get("/api/v1/编排/执行")
async def 查询执行(请求: Request, 执行号: str):
    身份 = _需登录(请求)
    if isinstance(身份, JSONResponse):
        return 身份
    快照 = 取编排库().取执行(执行号)
    if 快照 is None:
        return JSONResponse(status_code=404, content={"detail": "执行记录不存在"})
    return {"code": 200, "data": 快照}


@路由.get("/api/v1/编排/回放")
async def 执行回放(请求: Request, 跟踪号: str):
    身份 = _需登录(请求)
    if isinstance(身份, JSONResponse):
        return 身份
    return {"code": 200, "data": 取追踪库().按跟踪回放(跟踪号)}
