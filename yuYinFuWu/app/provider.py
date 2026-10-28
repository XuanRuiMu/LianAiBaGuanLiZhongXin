"""语音合成Provider抽象：免费Edge-TTS主路 + 离线正弦WAV兜底，零Key可启动。"""

from __future__ import annotations

import asyncio
import io
import logging
import math
import struct
import wave
from abc import ABC, abstractmethod

from app import 文案
from app.cache import 合成缓存, 缓存键
from app.config import settings
from app.voices import 归一化音色

logger = logging.getLogger(__name__)

风格预设: dict[str, dict] = {
    "normal": {"语速偏移": 0.0, "音调偏移": 0.0},
    "cheerful": {"语速偏移": 0.10, "音调偏移": 4.0},
    "gentle": {"语速偏移": -0.08, "音调偏移": -2.0},
    "sad": {"语速偏移": -0.15, "音调偏移": -4.0},
    "angry": {"语速偏移": 0.12, "音调偏移": 6.0},
    "whisper": {"语速偏移": -0.10, "音调偏移": -3.0},
    "excited": {"语速偏移": 0.15, "音调偏移": 5.0},
    "calm": {"语速偏移": -0.05, "音调偏移": -1.0},
}


class 合成错误(Exception):
    def __init__(self, 错误码: int, 错误信息: str, 可重试: bool = False):
        self.错误码 = 错误码
        self.错误信息 = 错误信息
        self.可重试 = 可重试
        super().__init__(f"语音合成错误 {错误码}: {错误信息}")


def _限幅(x: float, lo: float, hi: float) -> float:
    return lo if x < lo else hi if x > hi else x


def 离线正弦波(文本: str, 语速: float = 1.0) -> bytes:
    采样率 = 16000
    时长秒 = max(0.5, len(文本) / (15.0 * max(0.5, 语速)))
    帧数 = int(采样率 * 时长秒)
    缓冲 = io.BytesIO()
    with wave.open(缓冲, "wb") as 波:
        波.setnchannels(1)
        波.setsampwidth(2)
        波.setframerate(采样率)
        帧 = bytearray()
        for i in range(帧数):
            t = i / 采样率
            包络 = min(1.0, i / (采样率 * 0.05), (帧数 - i) / (采样率 * 0.1))
            值 = int(12000 * 包络 * math.sin(2 * math.pi * 440 * t) * math.exp(-0.3 * (t % 1.0)))
            帧 += struct.pack("<h", max(-32768, min(32767, 值)))
        波.writeframes(bytes(帧))
    return 缓冲.getvalue()


class 语音Provider(ABC):
    名称: str = "base"

    @abstractmethod
    async def 合成(self, 文本: str, 音色: str, 语速: float, 音调: float, 音量: float, 风格: str) -> tuple[bytes, str]:
        raise NotImplementedError


class EdgeTTSProvider(语音Provider):
    名称 = "edge-tts"

    def __init__(self, 超时: int = 15, 最大重试: int = 2):
        self._超时 = 超时
        self._重试 = 最大重试

    @staticmethod
    def _调制(语速: float, 音调: float, 音量: float, 风格: str) -> tuple[str, str, str]:
        预设 = 风格预设.get(风格, 风格预设["normal"])
        语速比 = _限幅(语速 - 1.0 + 预设["语速偏移"], -0.5, 1.0)
        音调值 = _限幅(音调 + 预设["音调偏移"], -50.0, 50.0)
        音量比 = _限幅(音量 - 1.0, -1.0, 1.0)
        return f"{语速比:+.0%}", f"{音调值:+.0f}Hz", f"{音量比:+.0%}"

    async def 合成(self, 文本: str, 音色: str, 语速: float, 音调: float, 音量: float, 风格: str) -> tuple[bytes, str]:
        import edge_tts

        速率串, 音调串, 音量串 = self._调制(语速, 音调, 音量, 风格)
        最后错: Exception | None = None
        for 轮 in range(self._重试 + 1):
            try:
                通讯 = edge_tts.Communicate(文本, 音色, rate=速率串, volume=音量串, pitch=音调串)
                buf = io.BytesIO()
                async with asyncio.timeout(self._超时):
                    async for 块 in 通讯.stream():
                        if 块["type"] == "audio" and 块.get("data"):
                            buf.write(块["data"])
                数据 = buf.getvalue()
                if 数据:
                    return 数据, "mp3"
                raise 合成错误(500, 文案.边缘返回空音频, 可重试=True)
            except 合成错误:
                raise
            except (asyncio.TimeoutError, TimeoutError) as e:
                最后错 = e
                logger.warning(f"Edge TTS超时 第{轮 + 1}轮")
            except Exception as e:
                最后错 = e
                logger.warning(f"Edge TTS失败 第{轮 + 1}轮: {e}")
            if 轮 < self._重试:
                await asyncio.sleep((2 ** 轮) * 0.4)
        raise 合成错误(502, 文案.边缘不可用.format(次数=self._重试 + 1), 可重试=True)


class 离线Provider(语音Provider):
    名称 = "offline-sine"

    async def 合成(self, 文本: str, 音色: str, 语速: float, 音调: float, 音量: float, 风格: str) -> tuple[bytes, str]:
        return 离线正弦波(文本, 语速), "wav"


class 合成服务:
    def __init__(self):
        self._缓存 = 合成缓存(settings.缓存上限)
        self._边缘 = EdgeTTSProvider(settings.边缘超时秒, settings.边缘最大重试)
        self._离线 = 离线Provider()
        self._模式 = (settings.提供者 or "auto").lower()

    @property
    def 缓存(self) -> 合成缓存:
        return self._缓存

    def 提供者名(self) -> str:
        if self._模式 == "offline":
            return self._离线.名称
        if self._模式 == "edge":
            return self._边缘.名称
        return f"{self._边缘.名称}+{self._离线.名称}(auto)"

    async def 合成(self, 文本: str, 音色: str | None, 语速: float = 1.0, 音调: float = 0.0, 音量: float = 1.0, 风格: str = "normal") -> tuple[bytes, str, bool, str]:
        正文 = (文本 or "").strip()
        if not 正文:
            raise 合成错误(400, 文案.文本不能为空, 可重试=False)
        if len(正文) > settings.单次上限字数:
            raise 合成错误(400, 文案.文本超长.format(上限=settings.单次上限字数), 可重试=False)
        语速 = _限幅(float(语速), 0.5, 2.0)
        音调 = _限幅(float(音调), -50.0, 50.0)
        音量 = _限幅(float(音量), 0.0, 2.0)
        风格名 = 风格 if 风格 in 风格预设 else "normal"
        真音色 = 归一化音色(音色, settings.默认音色)
        键 = 缓存键(正文, 真音色, 语速, 音调, 音量, 风格名)
        命中, 未来 = await self._缓存.单飞(键)
        if 命中:
            assert 未来 is not None
            数据 = await 未来
            return 数据, ("mp3" if 数据[:3] == b"ID3" or 数据[:2] == b"\xff\xfb" else "wav"), True, 真音色
        try:
            if self._模式 == "offline":
                数据, 格式 = await self._离线.合成(正文, 真音色, 语速, 音调, 音量, 风格名)
                用名 = self._离线.名称
            elif self._模式 == "edge":
                数据, 格式 = await self._边缘.合成(正文, 真音色, 语速, 音调, 音量, 风格名)
                用名 = self._边缘.名称
            else:
                try:
                    数据, 格式 = await self._边缘.合成(正文, 真音色, 语速, 音调, 音量, 风格名)
                    用名 = self._边缘.名称
                except 合成错误 as e:
                    if e.可重试:
                        logger.warning(f"边缘失败降级离线: {e.错误信息}")
                        数据, 格式 = await self._离线.合成(正文, 真音色, 语速, 音调, 音量, 风格名)
                        用名 = f"{self._离线.名称}(fallback)"
                    else:
                        raise
            await self._缓存.单飞完成(键, 数据)
            return 数据, 格式, False, 真音色
        except BaseException as e:
            await self._缓存.单飞完成(键, None, e if isinstance(e, BaseException) else Exception(str(e)))
            raise

合成服务单例 = 合成服务()
