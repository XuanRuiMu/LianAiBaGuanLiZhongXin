import os
import threading

import chromadb

import app.texts as texts
from app.config import 取配置


class 知识库未就绪异常(RuntimeError):
    pass


def 构建嵌入函数():
    配置 = 取配置()
    os.environ.setdefault("HF_ENDPOINT", 配置.HF_ENDPOINT)
    from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction

    return SentenceTransformerEmbeddingFunction(model_name=配置.EMBEDDING_MODEL, device="cpu")


class 检索器:
    def __init__(self):
        配置 = 取配置()
        客户端 = chromadb.PersistentClient(path=配置.CHROMA_PERSIST_DIR)
        try:
            self._集合 = 客户端.get_collection(配置.CHROMA_COLLECTION, embedding_function=构建嵌入函数())
        except Exception as 异常:
            raise 知识库未就绪异常(texts.知识库_未初始化) from 异常

    def 检索(self, 查询词: str, top_k: int | None = None) -> list[dict]:
        k = top_k or 取配置().RETRIEVER_TOP_K
        结果 = self._集合.query(query_texts=[查询词], n_results=k)
        文档们 = (结果.get("documents") or [[]])[0]
        元数据们 = (结果.get("metadatas") or [[]])[0]
        return [
            {"text": 文档, "source": (元数据 or {}).get("source", "")}
            for 文档, 元数据 in zip(文档们, 元数据们)
        ]


_锁 = threading.Lock()
_实例: 检索器 | None = None


def 获取检索器() -> 检索器:
    global _实例
    with _锁:
        if _实例 is None:
            _实例 = 检索器()
        return _实例
