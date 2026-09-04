from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", case_sensitive=False, extra="ignore")

    tts_provider: str = Field("auto", alias="TTS_PROVIDER")
    edge_default_voice: str = Field("zh-CN-XiaoxiaoNeural", alias="EDGE_TTS_DEFAULT_VOICE")
    edge_timeout: int = Field(15, alias="EDGE_TTS_TIMEOUT")
    edge_max_retries: int = Field(2, alias="EDGE_TTS_MAX_RETRIES")
    cache_size: int = Field(200, alias="TTS_CACHE_SIZE")
    max_chars: int = Field(5000, alias="TTS_MAX_CHARS")

    host: str = Field("0.0.0.0", alias="HOST")
    port: int = Field(8000, alias="PORT")
    log_level: str = Field("info", alias="LOG_LEVEL")


settings = Settings()
