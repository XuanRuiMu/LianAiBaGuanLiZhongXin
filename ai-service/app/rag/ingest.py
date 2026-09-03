import os
from pathlib import Path

import chromadb

from app.config import 取配置


def 构建嵌入函数():
    配置 = 取配置()
    os.environ.setdefault("HF_ENDPOINT", 配置.HF_ENDPOINT)
    from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction

    return SentenceTransformerEmbeddingFunction(model_name=配置.EMBEDDING_MODEL, device="cpu")


def 滑动切块(正文: str, 大小: int, 重叠: int) -> list[str]:
    步长 = max(1, 大小 - 重叠)
    块们: list[str] = []
    起点 = 0
    while 起点 < len(正文):
        块 = 正文[起点 : 起点 + 大小].strip()
        if 块:
            块们.append(块)
        if 起点 + 大小 >= len(正文):
            break
        起点 += 步长
    return 块们


def 入库() -> int:
    配置 = 取配置()
    客户端 = chromadb.PersistentClient(path=配置.CHROMA_PERSIST_DIR)
    集合 = 客户端.get_or_create_collection(配置.CHROMA_COLLECTION, embedding_function=构建嵌入函数())
    ids: list[str] = []
    documents: list[str] = []
    metadatas: list[list] = []
    for 文件 in sorted(Path(配置.KNOWLEDGE_DIR).glob("*.md")):
        正文 = 文件.read_text(encoding="utf-8")
        for 序号, 块 in enumerate(滑动切块(正文, 配置.CHUNK_SIZE, 配置.CHUNK_OVERLAP)):
            ids.append(f"{文件.stem}-{序号}")
            documents.append(块)
            metadatas.append({"source": 文件.name})
    if ids:
        集合.upsert(ids=ids, documents=documents, metadatas=metadatas)
    return len(ids)


if __name__ == "__main__":
    print(f"知识入库完成，共写入 {入库()} 个知识块。")
