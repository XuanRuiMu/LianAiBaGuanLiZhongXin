from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class 运行配置(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", case_sensitive=False,
                                      extra="ignore", populate_by_name=True)

    提供者: str = Field("auto", alias="TTS_PROVIDER")
    默认音色: str = Field("zh-CN-XiaoxiaoNeural", alias="EDGE_TTS_DEFAULT_VOICE")
    边缘超时秒: int = Field(15, alias="EDGE_TTS_TIMEOUT")
    边缘最大重试: int = Field(2, alias="EDGE_TTS_MAX_RETRIES")
    缓存上限: int = Field(200, alias="TTS_CACHE_SIZE")
    单次上限字数: int = Field(5000, alias="TTS_MAX_CHARS")

    监听地址: str = Field("0.0.0.0", alias="HOST")
    监听端口: int = Field(8000, alias="PORT")
    日志级别: str = Field("info", alias="LOG_LEVEL")

    令牌密钥: str = Field("", alias="JWT_SECRET")
    内部令牌: str = Field("", alias="INTERNAL_TOKEN")
    合成限流次数: int = Field(60, alias="TTS_RATE_LIMIT")
    合成限流窗口秒: int = Field(60, alias="TTS_RATE_WINDOW_SECONDS")


settings = 运行配置()
