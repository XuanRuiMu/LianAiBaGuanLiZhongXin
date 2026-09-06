import logging
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field

from langchain_core.messages import HumanMessage

import app.texts as texts
from app.config import 取配置

logger = logging.getLogger(__name__)


@dataclass
class 网关答复:
    文本: str
    提供者: str
    模型: str
    输入Token: int = 0
    输出Token: int = 0
    降级: bool = False


class 模型提供者(ABC):
    名称: str = "base"
    模型名: str = ""
    能力: tuple[str, ...] = ("问答",)

    @abstractmethod
    async def 问答(self, 提示词: str) -> 网关答复:
        raise NotImplementedError

    async def 健康(self) -> bool:
        try:
            await self.问答("ping")
            return True
        except Exception:
            return False


class DeepSeek提供者(模型提供者):
    def __init__(self, 名称: str, 模型名: str, 密钥: str, 温度: float) -> None:
        self.名称 = 名称
        self.模型名 = 模型名
        self._密钥 = 密钥
        self._温度 = 温度

    def _模型(self):
        from langchain_openai import ChatOpenAI
        配置 = 取配置()
        return ChatOpenAI(model=self.模型名, base_url=配置.DEEPSEEK_BASE_URL,
                          api_key=self._密钥, temperature=self._温度,
                          timeout=配置.LLM_TIMEOUT_SECONDS)

    async def 问答(self, 提示词: str) -> 网关答复:
        if not self._密钥:
            raise RuntimeError("缺少模型密钥")
        响应 = await self._模型().ainvoke([HumanMessage(提示词)])
        用量 = getattr(响应, "usage_metadata", None) or {}
        输入Token = int(用量.get("input_tokens", 0))
        输出Token = int(用量.get("output_tokens", 0))
        return 网关答复(文本=texts.提取文本(响应.content), 提供者=self.名称,
                        模型=self.模型名, 输入Token=输入Token, 输出Token=输出Token)


class 兜底模板提供者(模型提供者):
    名称 = "兜底模板"
    模型名 = "template-fallback"

    async def 问答(self, 提示词: str) -> 网关答复:
        return 网关答复(文本="当前模型服务不可用，已记录您的需求，请稍后再试。",
                        提供者=self.名称, 模型=self.模型名, 降级=True)

    async def 健康(self) -> bool:
        return True


@dataclass
class 提供者状态:
    连续失败: int = 0
    熔断至: float = 0.0


class 模型网关:
    def __init__(self, 单价每千Token元: float = 0.002,
                 单轮Token上限: int = 8000, 累计金额上限元: float = 10.0,
                 熔断阈值: int = 3, 熔断秒: int = 300,
                 提供者列表: list[模型提供者] | None = None) -> None:
        配置 = 取配置()
        self._提供者 = 提供者列表 if 提供者列表 is not None else [
            DeepSeek提供者("主模型", 配置.DEEPSEEK_MODEL,
                           配置.DEEPSEEK_API_KEY, 配置.LLM_TEMPERATURE),
            DeepSeek提供者("备选模型", 配置.DEEPSEEK_MODEL,
                           配置.DEEPSEEK_API_KEY, min(1.0, 配置.LLM_TEMPERATURE + 0.2)),
            兜底模板提供者(),
        ]
        self._状态: dict[str, 提供者状态] = {}
        self._单价 = 单价每千Token元
        self._单轮上限 = 单轮Token上限
        self._金额上限 = 累计金额上限元
        self._累计金额 = 0.0
        self._熔断阈值 = 熔断阈值
        self._熔断秒 = 熔断秒

    def _可用(self, 提供者: 模型提供者) -> bool:
        状态 = self._状态.setdefault(提供者.名称, 提供者状态())
        return 状态.连续失败 < self._熔断阈值 or time.time() >= 状态.熔断至

    def _记成功(self, 提供者: 模型提供者) -> None:
        self._状态.setdefault(提供者.名称, 提供者状态()).连续失败 = 0

    def _记失败(self, 提供者: 模型提供者) -> None:
        状态 = self._状态.setdefault(提供者.名称, 提供者状态())
        状态.连续失败 += 1
        if 状态.连续失败 >= self._熔断阈值:
            状态.熔断至 = time.time() + self._熔断秒
            logger.warning("模型提供者熔断: %s", 提供者.名称)

    async def 问答(self, 提示词: str, 跟踪号: str = "") -> 网关答复:
        if len(提示词) // 2 > self._单轮上限:
            raise ValueError("输入超限")
        if self._累计金额 >= self._金额上限:
            raise ValueError("累计金额超限")
        最后异常: Exception | None = None
        for 提供者 in self._提供者:
            if not self._可用(提供者):
                continue
            try:
                答复 = await 提供者.问答(提示词)
                花费 = (答复.输入Token + 答复.输出Token) / 1000 * self._单价
                self._累计金额 += 花费
                self._记成功(提供者)
                try:
                    from app.记忆.记忆库 import 取记忆库
                    取记忆库().记账本(跟踪号, 答复.提供者, 答复.模型,
                                      答复.输入Token, 答复.输出Token, 花费)
                except Exception:
                    pass
                return 答复
            except Exception as 异常:
                最后异常 = 异常
                self._记失败(提供者)
                logger.warning("模型调用失败 %s: %s", 提供者.名称, 异常)
        raise RuntimeError("全部模型提供者不可用") from 最后异常

    async def 健康检查(self) -> dict[str, bool]:
        结果 = {}
        for 提供者 in self._提供者:
            try:
                结果[提供者.名称] = await 提供者.健康()
            except Exception:
                结果[提供者.名称] = False
        return 结果
