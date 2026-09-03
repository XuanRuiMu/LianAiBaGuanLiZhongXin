import json
from typing import Any


def 格式化sse事件(事件类型: str, 数据: dict[str, Any] | None = None) -> str:
    体 = {"type": 事件类型, **(数据 or {})}
    return f"data: {json.dumps(体, ensure_ascii=False)}\n\n"


def 提取文本(内容: Any) -> str:
    if isinstance(内容, str):
        return 内容
    if isinstance(内容, list):
        return "".join(
            片段.get("text", "")
            for 片段 in 内容
            if isinstance(片段, dict) and isinstance(片段.get("text"), str)
        )
    return ""
