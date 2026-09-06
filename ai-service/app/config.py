from functools import lru_cache

from pydantic import Field

import app.texts as texts
from pydantic_settings import BaseSettings, SettingsConfigDict


class 配置(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore", populate_by_name=True)

    HOST: str = "0.0.0.0"
    PORT: int = 8000
    CORS_ORIGINS: list[str] = ["*"]

    JAVA_BASE_URL: str = "http://localhost:8080"
    INTERNAL_TOKEN: str = ""
    HTTP_TIMEOUT_SECONDS: float = 5.0

    DEEPSEEK_BASE_URL: str = "https://api.deepseek.com"
    DEEPSEEK_API_KEY: str = ""
    DEEPSEEK_MODEL: str = "deepseek-chat"
    LLM_TEMPERATURE: float = 0.3
    LLM_TIMEOUT_SECONDS: float = 60.0

    EMBEDDING_MODEL: str = "paraphrase-multilingual-MiniLM-L12-v2"
    HF_ENDPOINT: str = "https://hf-mirror.com"
    CHROMA_PERSIST_DIR: str = "./chroma_db"
    CHROMA_COLLECTION: str = "knowledge"
    KNOWLEDGE_DIR: str = "./knowledge"
    CHUNK_SIZE: int = 500
    CHUNK_OVERLAP: int = 50
    RETRIEVER_TOP_K: int = 4

    MAX_ITERATIONS: int = 6
    MAX_HISTORY_MESSAGES: int = 20
    TOOL_EVENT_SUMMARY_LENGTH: int = 300

    JWT密钥: str = Field(default="", alias="JWT_SECRET")
    聊天限流次数: int = Field(default=30, alias="CHAT_RATE_LIMIT")
    聊天限流窗口秒: int = Field(default=60, alias="CHAT_RATE_WINDOW_SECONDS")
    MCP挂载开关: bool = Field(default=True, alias="MCP_ENABLED")

    报表目录: str = Field(default="./reports", alias="REPORT_DIR")
    报表定时秒: int = Field(default=3600, alias="REPORT_INTERVAL_SECONDS")
    报表限流次数: int = Field(default=10, alias="REPORT_RATE_LIMIT")
    报表限流窗口秒: int = Field(default=60, alias="REPORT_RATE_WINDOW_SECONDS")


@lru_cache
def 取配置() -> 配置:
    实例 = 配置()
    if not 实例.INTERNAL_TOKEN or not 实例.INTERNAL_TOKEN.strip():
        raise RuntimeError(texts.配置错误_缺内部令牌)
    return 实例
