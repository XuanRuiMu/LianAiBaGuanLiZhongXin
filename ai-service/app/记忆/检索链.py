import functools
import logging
import os
import threading

import app.texts as texts
from app.config import 取配置
from app.记忆.记忆库 import 取记忆库

logger = logging.getLogger(__name__)

_锁 = threading.Lock()
_嵌入模型 = None
_重排模型 = None


def 取嵌入模型():
    global _嵌入模型
    with _锁:
        if _嵌入模型 is None:
            配置 = 取配置()
            os.environ.setdefault("HF_ENDPOINT", 配置.HF_ENDPOINT)
            from sentence_transformers import SentenceTransformer
            _嵌入模型 = SentenceTransformer(配置.EMBEDDING_MODEL, device="cpu")
        return _嵌入模型


def 取重排模型():
    global _重排模型
    with _锁:
        if _重排模型 is None:
            配置 = 取配置()
            os.environ.setdefault("HF_ENDPOINT", 配置.HF_ENDPOINT)
            from sentence_transformers import CrossEncoder
            _重排模型 = CrossEncoder(配置.RERANK_MODEL, device="cpu")
        return _重排模型


def 嵌入文本(文本: str) -> list[float]:
    return [float(v) for v in 取嵌入模型().encode(文本, normalize_embeddings=True)]


def RRF融合(多路排名: list[list[int]], 融合常数: int = 60) -> list[tuple[int, float]]:
    分数: dict[int, float] = {}
    for 排名 in 多路排名:
        for 位置, 编号 in enumerate(排名):
            分数[编号] = 分数.get(编号, 0.0) + 1.0 / (融合常数 + 位置 + 1)
    return sorted(分数.items(), key=lambda 项: 项[1], reverse=True)


def 混合检索(查询词: str, 条数: int = 5, 候选倍数: int = 4) -> list[dict]:
    记忆库 = 取记忆库()
    候选数 = max(条数 * 候选倍数, 10)
    try:
        向量 = 嵌入文本(查询词)
        向量命中 = 记忆库.向量召回(向量, 候选数)
    except Exception as 异常:
        logger.warning("向量召回不可用，降级纯全文：%s", 异常)
        向量命中 = []
    全文命中 = 记忆库.全文召回(查询词, 候选数)
    向量序 = [行["编号"] for 行 in 向量命中]
    全文序 = [行["编号"] for 行 in 全文命中]
    内容表 = {行["编号"]: 行 for 行 in 向量命中 + 全文命中}
    融合 = RRF融合([向量序, 全文序])[:候选数]
    候选 = [(编号, 内容表[编号]) for 编号, _ in 融合 if 编号 in 内容表]
    if not 候选:
        return []
    try:
        重排器 = 取重排模型()
        分数 = 重排器.predict([(查询词, 文本) for _, 文本 in
                              [(编号, 行["文本"]) for 编号, 行 in 候选]])
        排序 = sorted(zip([行 for _, 行 in 候选], 分数),
                      key=lambda 对: float(对[1]), reverse=True)
        return [{**行, "重排分": float(分)} for 行, 分 in 排序[:条数]]
    except Exception as 异常:
        logger.warning("精排不可用，降级RRF排序：%s", 异常)
        return [行 for _, 行 in 候选[:条数]]


def 带溯源回答(查询词: str, 条数: int = 5) -> str:
    命中 = 混合检索(查询词, 条数)
    if not 命中:
        return f"{texts.标记_检索无结果} {texts.知识库_无结果}"
    return "\n\n".join(f"【来源：{项['来源']}】\n{项['文本']}" for 项 in 命中)
