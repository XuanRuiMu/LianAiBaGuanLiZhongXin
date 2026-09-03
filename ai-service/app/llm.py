from langchain_openai import ChatOpenAI

from app.config import 取配置


def 创建聊天模型() -> ChatOpenAI:
    配置 = 取配置()
    return ChatOpenAI(
        model=配置.DEEPSEEK_MODEL,
        base_url=配置.DEEPSEEK_BASE_URL,
        api_key=配置.DEEPSEEK_API_KEY or "EMPTY",
        temperature=配置.LLM_TEMPERATURE,
        timeout=配置.LLM_TIMEOUT_SECONDS,
        streaming=True,
    )
