import os

os.environ.setdefault("INTERNAL_TOKEN", "test-token")
os.environ.setdefault("JAVA_BASE_URL", "http://localhost:8080")
os.environ.setdefault("DEEPSEEK_API_KEY", "test-key")
os.environ.setdefault("CHROMA_PERSIST_DIR", "./.test-chroma")
