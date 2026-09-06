import os

os.environ.setdefault("HF_ENDPOINT", "https://hf-mirror.com")
from sentence_transformers import SentenceTransformer, CrossEncoder

with open(r"D:\xuanr\Desktop\燃烧之陨我的世界服务端\恋爱吧数据中心\ai-service\模型预载.log", "a", encoding="utf-8") as 日志:
    日志.write("开始嵌入模型\n")
    嵌入 = SentenceTransformer("paraphrase-multilingual-MiniLM-L12-v2", device="cpu")
    日志.write(f"嵌入维度={嵌入.get_sentence_embedding_dimension()}\n")
    日志.write("开始重排模型\n")
    重排 = CrossEncoder("BAAI/bge-reranker-v2-m3", device="cpu")
    日志.write("重排就绪\n")
print("预载完成")
