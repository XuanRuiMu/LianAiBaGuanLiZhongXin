import httpx
import logging
from typing import Optional
from app.config import settings

logger = logging.getLogger(__name__)


class MiniMaxTTSError(Exception):
    def __init__(self, code: int, message: str, retryable: bool = False):
        self.code = code
        self.message = message
        self.retryable = retryable
        super().__init__(f"MiniMax TTS Error {code}: {message}")


class MiniMaxClient:
    def __init__(self):
        self._client: Optional[httpx.AsyncClient] = None
        self._base_url = settings.minimax_tts_base_url.rstrip("/")
        self._api_key = settings.minimax_api_key
        self._model = settings.minimax_tts_model
        self._timeout = settings.minimax_tts_timeout
        self._max_retries = settings.minimax_tts_max_retries

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                timeout=httpx.Timeout(self._timeout),
                limits=httpx.Limits(max_connections=10, max_keepalive_connections=5),
            )
        return self._client

    async def close(self):
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            self._client = None

    async def synthesize(
        self, text: str, voice_id: str, speed: float = 1.0
    ) -> bytes:
        if not text or not text.strip():
            raise MiniMaxTTSError(400, "Text cannot be empty", retryable=False)

        if len(text) > 5000:
            raise MiniMaxTTSError(400, "Text too long (max 5000 chars)", retryable=False)

        url = f"{self._base_url}/audio/generate"
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self._model,
            "text": text.strip(),
            "voice_id": voice_id,
            "speed": speed,
            "vol": 1.0,
            "pitch": 0,
            "format": "mp3",
            "sample_rate": 32000,
            "bitrate": 128000,
        }

        last_error = None
        for attempt in range(self._max_retries + 1):
            try:
                client = await self._get_client()
                response = await client.post(url, headers=headers, json=payload)

                if response.status_code == 200:
                    data = response.json()
                    if "data" in data and "audio" in data["data"]:
                        audio_hex = data["data"]["audio"]
                        return bytes.fromhex(audio_hex)
                    else:
                        raise MiniMaxTTSError(
                            500,
                            f"Unexpected response format: {data}",
                            retryable=False,
                        )

                error_data = {}
                try:
                    error_data = response.json()
                except Exception:
                    pass

                error_code = error_data.get("base_resp", {}).get("status_code", response.status_code)
                error_msg = error_data.get("base_resp", {}).get("status_msg", response.text)

                retryable_codes = {1002, 1039, 429, 500, 502, 503, 504}
                retryable = error_code in retryable_codes

                if attempt < self._max_retries and retryable:
                    wait_time = (2 ** attempt) * 0.5
                    logger.warning(
                        f"MiniMax TTS attempt {attempt + 1} failed (code={error_code}), "
                        f"retrying in {wait_time}s: {error_msg}"
                    )
                    import asyncio
                    await asyncio.sleep(wait_time)
                    last_error = MiniMaxTTSError(error_code, error_msg, retryable=True)
                    continue

                raise MiniMaxTTSError(error_code, error_msg, retryable=retryable)

            except httpx.TimeoutException as e:
                last_error = MiniMaxTTSError(504, f"Request timeout: {e}", retryable=True)
                if attempt < self._max_retries:
                    wait_time = (2 ** attempt) * 0.5
                    logger.warning(f"MiniMax TTS timeout, retrying in {wait_time}s")
                    import asyncio
                    await asyncio.sleep(wait_time)
                    continue
                raise

            except httpx.RequestError as e:
                last_error = MiniMaxTTSError(502, f"Request error: {e}", retryable=True)
                if attempt < self._max_retries:
                    wait_time = (2 ** attempt) * 0.5
                    logger.warning(f"MiniMax TTS request error, retrying in {wait_time}s")
                    import asyncio
                    await asyncio.sleep(wait_time)
                    continue
                raise

            except MiniMaxTTSError:
                raise

            except Exception as e:
                logger.exception("Unexpected error in MiniMax TTS")
                raise MiniMaxTTSError(500, f"Internal error: {e}", retryable=False)

        raise last_error or MiniMaxTTSError(500, "Max retries exceeded", retryable=False)


minimax_client = MiniMaxClient()