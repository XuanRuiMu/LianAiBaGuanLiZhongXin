from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
import logging

from app.config import settings
from app.provider import 合成服务单例, 合成错误, 风格预设
from app.voices import 音色目录, 归一化音色, 是否已知音色

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/tts", tags=["TTS"])


class SynthesizeRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000, description="要合成的文本")
    voice: str | None = Field(default=None, description="Edge音色ID，如zh-CN-XiaoxiaoNeural")
    voice_id: str | None = Field(default=None, description="兼容旧别名，如female-shaonv")
    speed: float = Field(1.0, ge=0.5, le=2.0, description="语速（兼容旧字段）")
    rate: float | None = Field(default=None, ge=0.5, le=2.0, description="语速，覆盖speed")
    pitch: float = Field(0.0, ge=-50.0, le=50.0, description="音调Hz")
    volume: float = Field(1.0, ge=0.0, le=2.0, description="音量")
    style: str = Field("normal", description="风格：normal/cheerful/gentle/sad/angry/whisper/excited/calm")


class SynthesizeResponse(BaseModel):
    audio_hex: str = Field(..., description="音频二进制十六进制")
    duration_ms: int = Field(..., description="估算时长毫秒")
    format: str = Field(..., description="mp3或wav")
    voice: str = Field(..., description="实际使用的音色")
    cached: bool = Field(False, description="是否命中缓存")
    provider: str = Field(..., description="实际提供者")


def estimate_duration_ms(text: str, speed: float = 1.0) -> int:
    char_count = len(text)
    chars_per_second = 15 * max(0.5, speed)
    return int((char_count / chars_per_second) * 1000)


@router.post("/synthesize", response_model=SynthesizeResponse)
async def synthesize(request: SynthesizeRequest):
    音色 = 归一化音色(request.voice or request.voice_id, settings.edge_default_voice)
    if not 是否已知音色(音色):
        raise HTTPException(status_code=400, detail=f"未知音色：{音色}")
    try:
        真速 = request.rate if request.rate is not None else request.speed
        风格 = request.style if request.style in 风格预设 else "normal"
        音频, 格式, 命中, 真音色 = await 合成服务单例.合成(
            文本=request.text, 音色=音色, 语速=真速,
            音调=request.pitch, 音量=request.volume, 风格=风格,
        )
        return SynthesizeResponse(
            audio_hex=音频.hex(), duration_ms=estimate_duration_ms(request.text, 真速),
            format=格式, voice=真音色, cached=命中, provider=合成服务单例.提供者名(),
        )
    except 合成错误 as e:
        logger.error(f"TTS合成错误: code={e.code} msg={e.message}")
        状态 = 400 if not e.retryable else 502
        raise HTTPException(status_code=状态, detail=e.message)
    except Exception:
        logger.exception("TTS未知错误")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/voices")
async def list_voices():
    return {"voices": 音色目录, "count": len(音色目录), "styles": sorted(风格预设)}


@router.get("/health")
async def health_check():
    return {"status": "ok", "service": "tts-service", "provider": 合成服务单例.提供者名(), "cache": 合成服务单例.缓存.状态()}
