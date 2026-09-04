import json
from typing import Any


def 格式化sse事件(事件类型: str, 数据: dict[str, Any] | None = None) -> str:
    体 = {"type": 事件类型, **(数据 or {})}
    return f"data: {json.dumps(体, ensure_ascii=False)}\n\n"
