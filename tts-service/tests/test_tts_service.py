import pytest
from unittest.mock import AsyncMock, patch, MagicMock
import httpx

from app.config import Settings
from app.minimax_client import MiniMaxClient, MiniMaxTTSError
from app.router import estimate_duration_ms


class TestEstimateDuration:
    def test_basic_estimation(self):
        duration = estimate_duration_ms("你好世界", 1.0)
        assert duration > 0
        assert isinstance(duration, int)

    def test_speed_adjustment(self):
        duration_normal = estimate_duration_ms("测试文本", 1.0)
        duration_fast = estimate_duration_ms("测试文本", 2.0)
        duration_slow = estimate_duration_ms("测试文本", 0.5)
        assert duration_fast < duration_normal < duration_slow

    def test_longer_text_longer_duration(self):
        short = estimate_duration_ms("短", 1.0)
        long = estimate_duration_ms("这是一段很长的测试文本用来验证时长估算是否正确", 1.0)
        assert long > short


class TestMiniMaxClient:
    @pytest.fixture
    def client(self):
        with patch("app.minimax_client.settings") as mock_settings:
            mock_settings.minimax_tts_base_url = "https://api.test.com/v1/t2a_v2"
            mock_settings.minimax_api_key = "test-key"
            mock_settings.minimax_tts_model = "speech-2.8-turbo"
            mock_settings.minimax_tts_timeout = 30
            mock_settings.minimax_tts_max_retries = 3
            client = MiniMaxClient()
            yield client

    @pytest.mark.asyncio
    async def test_empty_text_raises_error(self, client):
        with pytest.raises(MiniMaxTTSError) as exc:
            await client.synthesize("", "female-shaonv")
        assert exc.value.code == 400
        assert not exc.value.retryable

    @pytest.mark.asyncio
    async def test_text_too_long_raises_error(self, client):
        long_text = "x" * 5001
        with pytest.raises(MiniMaxTTSError) as exc:
            await client.synthesize(long_text, "female-shaonv")
        assert exc.value.code == 400
        assert not exc.value.retryable

    @pytest.mark.asyncio
    async def test_successful_synthesis(self, client):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "data": {"audio": "fffb906400"}  # 简单的 MP3 hex
        }

        with patch.object(client, "_get_client", new_callable=AsyncMock) as mock_get_client:
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(return_value=mock_response)
            mock_get_client.return_value = mock_client

            audio_bytes = await client.synthesize("你好", "female-shaonv")
            assert isinstance(audio_bytes, bytes)
            assert len(audio_bytes) > 0

    @pytest.mark.asyncio
    async def test_invalid_response_format(self, client):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"data": {}}

        with patch.object(client, "_get_client", new_callable=AsyncMock) as mock_get_client:
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(return_value=mock_response)
            mock_get_client.return_value = mock_client

            with pytest.raises(MiniMaxTTSError) as exc:
                await client.synthesize("测试", "female-shaonv")
            assert exc.value.code == 500
            assert not exc.value.retryable

    @pytest.mark.asyncio
    async def test_rate_limit_retry(self, client):
        mock_response_429 = MagicMock()
        mock_response_429.status_code = 429
        mock_response_429.json.return_value = {
            "base_resp": {"status_code": 1002, "status_msg": "Rate limited"}
        }

        mock_response_200 = MagicMock()
        mock_response_200.status_code = 200
        mock_response_200.json.return_value = {
            "data": {"audio": "fffb906400"}
        }

        call_count = 0

        async def mock_post(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return mock_response_429
            return mock_response_200

        with patch.object(client, "_get_client", new_callable=AsyncMock) as mock_get_client:
            mock_client = AsyncMock()
            mock_client.post = mock_post
            mock_get_client.return_value = mock_client

            with patch("asyncio.sleep", new_callable=AsyncMock):
                audio_bytes = await client.synthesize("测试", "female-shaonv")
                assert isinstance(audio_bytes, bytes)
                assert call_count == 2

    @pytest.mark.asyncio
    async def test_auth_failure_no_retry(self, client):
        mock_response = MagicMock()
        mock_response.status_code = 401
        mock_response.json.return_value = {
            "base_resp": {"status_code": 1004, "status_msg": "Invalid API Key"}
        }

        with patch.object(client, "_get_client", new_callable=AsyncMock) as mock_get_client:
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(return_value=mock_response)
            mock_get_client.return_value = mock_client

            with pytest.raises(MiniMaxTTSError) as exc:
                await client.synthesize("测试", "female-shaonv")
            assert exc.value.code == 1004
            assert not exc.value.retryable

    @pytest.mark.asyncio
    async def test_timeout_retry_then_fail(self, client):
        with patch.object(client, "_get_client", new_callable=AsyncMock) as mock_get_client:
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(side_effect=httpx.TimeoutException("Timeout"))
            mock_get_client.return_value = mock_client

            with patch("asyncio.sleep", new_callable=AsyncMock):
                with pytest.raises(MiniMaxTTSError) as exc:
                    await client.synthesize("测试", "female-shaonv")
                assert exc.value.code == 504
                assert exc.value.retryable

    @pytest.mark.asyncio
    async def test_max_retries_exceeded(self, client):
        mock_response = MagicMock()
        mock_response.status_code = 500
        mock_response.json.return_value = {
            "base_resp": {"status_code": 500, "status_msg": "Internal Server Error"}
        }

        with patch.object(client, "_get_client", new_callable=AsyncMock) as mock_get_client:
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(return_value=mock_response)
            mock_get_client.return_value = mock_client

            with patch("asyncio.sleep", new_callable=AsyncMock):
                with pytest.raises(MiniMaxTTSError) as exc:
                    await client.synthesize("测试", "female-shaonv")
                assert exc.value.retryable


class TestRouterValidation:
    def test_valid_request(self):
        from app.router import SynthesizeRequest
        req = SynthesizeRequest(text="测试", voice_id="female-shaonv", speed=1.0)
        assert req.text == "测试"
        assert req.voice_id == "female-shaonv"
        assert req.speed == 1.0

    def test_speed_bounds(self):
        from app.router import SynthesizeRequest
        from pydantic import ValidationError

        with pytest.raises(ValidationError):
            SynthesizeRequest(text="测试", voice_id="v", speed=0.4)
        with pytest.raises(ValidationError):
            SynthesizeRequest(text="测试", voice_id="v", speed=2.1)

    def test_text_length_bounds(self):
        from app.router import SynthesizeRequest
        from pydantic import ValidationError

        with pytest.raises(ValidationError):
            SynthesizeRequest(text="", voice_id="v")
        with pytest.raises(ValidationError):
            SynthesizeRequest(text="x" * 5001, voice_id="v")