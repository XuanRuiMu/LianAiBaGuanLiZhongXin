from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
import logging

from app import 文案
from app.config import settings
from app.provider import 合成服务单例, 合成错误, 风格预设
from app.voices import 音色目录, 归一化音色, 是否已知音色
from app.鉴权 import 凭证异常, 凭证异常响应, 守卫合成请求

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/tts", tags=["TTS"])


class 合成请求(BaseModel):
    model_config = {"populate_by_name": True}

    文本: str = Field(..., min_length=1, max_length=5000, alias="text", description="要合成的文本")
    音色: str | None = Field(default=None, alias="voice", description="边缘音色编号")
    旧音色别名: str | None = Field(default=None, alias="voice_id", description="兼容旧别名")
    语速旧字段: float = Field(1.0, ge=0.5, le=2.0, alias="speed", description="语速（兼容旧字段）")
    语速: float | None = Field(default=None, ge=0.5, le=2.0, alias="rate", description="语速，覆盖旧字段")
    音调: float = Field(0.0, ge=-50.0, le=50.0, alias="pitch", description="音调Hz")
    音量: float = Field(1.0, ge=0.0, le=2.0, alias="volume", description="音量")
    风格: str = Field("normal", alias="style", description="风格")


class 合成响应(BaseModel):
    model_config = {"populate_by_name": True}

    音频十六进制: str = Field(..., alias="audio_hex", description="音频二进制十六进制")
    时长毫秒: int = Field(..., alias="duration_ms", description="估算时长毫秒")
    格式: str = Field(..., alias="format", description="mp3或wav")
    实际音色: str = Field(..., alias="voice", description="实际使用的音色")
    命中缓存: bool = Field(False, alias="cached", description="是否命中缓存")
    实际提供者: str = Field(..., alias="provider", description="实际提供者")


def 估算时长毫秒(文本: str, 语速: float = 1.0) -> int:
    字数 = len(文本)
    每秒字数 = 15 * max(0.5, 语速)
    return int((字数 / 每秒字数) * 1000)


estimate_duration_ms = 估算时长毫秒


@router.post("/synthesize", response_model=合成响应, response_model_by_alias=True)
async def 合成接口(请求: 合成请求, 原始请求: Request):
    try:
        守卫合成请求(原始请求)
    except 凭证异常 as 异常:
        return 凭证异常响应(异常)
    音色 = 归一化音色(请求.音色 or 请求.旧音色别名, settings.默认音色)
    if not 是否已知音色(音色):
        raise HTTPException(status_code=400, detail=文案.未知音色.format(音色=音色))
    try:
        真速 = 请求.语速 if 请求.语速 is not None else 请求.语速旧字段
        风格 = 请求.风格 if 请求.风格 in 风格预设 else "normal"
        音频, 格式, 命中, 真音色 = await 合成服务单例.合成(
            文本=请求.文本, 音色=音色, 语速=真速,
            音调=请求.音调, 音量=请求.音量, 风格=风格,
        )
        return 合成响应(
            音频十六进制=音频.hex(), 时长毫秒=估算时长毫秒(请求.文本, 真速),
            格式=格式, 实际音色=真音色, 命中缓存=命中, 实际提供者=合成服务单例.提供者名(),
        )
    except 合成错误 as e:
        logger.error(f"合成失败: 错误码={e.错误码} 信息={e.错误信息}")
        状态 = 400 if not e.可重试 else 502
        raise HTTPException(status_code=状态, detail=e.错误信息)
    except Exception:
        logger.exception("合成未知错误")
        raise HTTPException(status_code=500, detail=文案.服务内部错误)


@router.get("/voices")
async def 音色列表():
    return {"音色列表": 音色目录, "总数": len(音色目录), "风格列表": sorted(风格预设)}


@router.get("/health")
async def 健康检查():
    return {"状态": "正常", "服务": "tts-service", "提供者": 合成服务单例.提供者名(), "缓存": 合成服务单例.缓存.状态()}
