import os
import time

from app.记忆.检索链 import 取嵌入模型
from app.记忆.记忆库 import 取记忆库
from app.config import 取配置


def 切分(文本: str, 来源: str, 块大小: int = 500, 重叠: int = 50) -> list[dict]:
    块们 = []
    步长 = max(1, 块大小 - 重叠)
    for 起 in range(0, len(文本), 步长):
        片段 = 文本[起:起 + 块大小].strip()
        if 片段:
            块们.append({"文本": 片段, "来源": 来源})
    return 块们


def 入库(知识目录: str = "./knowledge") -> int:
    配置 = 取配置()
    os.environ.setdefault("HF_ENDPOINT", 配置.HF_ENDPOINT)
    模型 = 取嵌入模型()
    库 = 取记忆库()
    总数 = 0
    for 文件 in sorted(os.listdir(知识目录)):
        if not 文件.endswith(".md"):
            continue
        文本 = open(os.path.join(知识目录, 文件), encoding="utf-8").read()
        块们 = 切分(文本, 文件)
        向量们 = 模型.encode([块["文本"] for 块 in 块们], normalize_embeddings=True)
        for 块, 向量 in zip(块们, 向量们):
            库.存语义(块["文本"], 块["来源"], [float(v) for v in 向量],
                       置信度=1.0, 有效天数=3650)
            总数 += 1
    return 总数


if __name__ == "__main__":
    print("入库块数:", 入库())
