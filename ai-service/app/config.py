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

    开放平台库路径: str = Field(default="./data/开放平台.db", alias="OPEN_DB_PATH")

    飞书地址: str = Field(default="", alias="FEISHU_WEBHOOK")
    企微地址: str = Field(default="", alias="WEWORK_WEBHOOK")
    钉钉地址: str = Field(default="", alias="DINGTALK_WEBHOOK")
    邮件服务: str = Field(default="", alias="SMTP_HOST")
    邮件端口: int = Field(default=25, alias="SMTP_PORT")
    邮件发件人: str = Field(default="", alias="SMTP_FROM")
    邮件收件人: str = Field(default="", alias="SMTP_TO")
    邮件用户名: str = Field(default="", alias="SMTP_USER")
    邮件密码: str = Field(default="", alias="SMTP_PASS")

    事件订阅地址: str = Field(default="", alias="EVENT_SUBSCRIBERS")
    事件密钥: str = Field(default="", alias="EVENT_SECRET")

    TTS服务地址: str = Field(default="http://localhost:8001", alias="TTS_BASE_URL")


@lru_cache
def 取配置() -> 配置:
    实例 = 配置()
    if not 实例.INTERNAL_TOKEN or not 实例.INTERNAL_TOKEN.strip():
        raise RuntimeError(texts.配置错误_缺内部令牌)
    return 实例
