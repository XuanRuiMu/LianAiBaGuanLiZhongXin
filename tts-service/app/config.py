from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    minimax_api_key: str = Field(..., alias="MINIMAX_API_KEY")
    minimax_tts_base_url: str = Field(
        "https://api.minimaxi.com/v1/t2a_v2", alias="MINIMAX_TTS_BASE_URL"
    )
    minimax_tts_model: str = Field("speech-2.8-turbo", alias="MINIMAX_TTS_MODEL")
    minimax_tts_default_voice: str = Field(
        "female-shaonv", alias="MINIMAX_TTS_DEFAULT_VOICE"
    )
    minimax_tts_timeout: int = Field(30, alias="MINIMAX_TTS_TIMEOUT")
    minimax_tts_max_retries: int = Field(3, alias="MINIMAX_TTS_MAX_RETRIES")

    host: str = Field("0.0.0.0", alias="HOST")
    port: int = Field(8000, alias="PORT")
    log_level: str = Field("info", alias="LOG_LEVEL")

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


settings = Settings()