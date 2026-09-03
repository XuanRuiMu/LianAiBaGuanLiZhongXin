from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
import logging

from app.minimax_client import minimax_client, MiniMaxTTSError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/tts", tags=["TTS"])


class SynthesizeRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000, description="要合成的文本")
    voice_id: str = Field(..., min_length=1, description="音色 ID")
    speed: float = Field(1.0, ge=0.5, le=2.0, description="语速")


class SynthesizeResponse(BaseModel):
    audio_hex: str = Field(..., description="音频数据的十六进制字符串")
    duration_ms: int = Field(..., description="音频时长（毫秒），估算值")
    format: str = Field("mp3", description="音频格式")


def estimate_duration_ms(text: str, speed: float = 1.0) -> int:
    char_count = len(text)
    chars_per_second = 15 * speed
    return int((char_count / chars_per_second) * 1000)


@router.post("/synthesize", response_model=SynthesizeResponse)
async def synthesize(request: SynthesizeRequest):
    try:
        audio_bytes = await minimax_client.synthesize(
            text=request.text, voice_id=request.voice_id, speed=request.speed
        )

        audio_hex = audio_bytes.hex()
        duration_ms = estimate_duration_ms(request.text, request.speed)

        logger.info(
            f"TTS synthesis successful: voice={request.voice_id}, "
            f"chars={len(request.text)}, size={len(audio_bytes)} bytes, "
            f"est_duration={duration_ms}ms"
        )

        return SynthesizeResponse(
            audio_hex=audio_hex, duration_ms=duration_ms, format="mp3"
        )

    except MiniMaxTTSError as e:
        logger.error(f"MiniMax TTS error: code={e.code}, msg={e.message}, retryable={e.retryable}")
        status_code = 502 if e.retryable else 400
        if e.code == 1004:
            status_code = 401
        elif e.code in (1002, 1039):
            status_code = 429
        raise HTTPException(status_code=status_code, detail=e.message)

    except Exception as e:
        logger.exception("Unexpected error in TTS synthesize")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/health")
async def health_check():
    return {"status": "ok", "service": "tts-service"}