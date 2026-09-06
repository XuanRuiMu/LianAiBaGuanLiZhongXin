import json
import sqlite3
import threading
import time
import uuid
from pathlib import Path


class 追踪存储:
    def __init__(self, 路径: str = "./data/追踪.db") -> None:
        Path(路径).parent.mkdir(parents=True, exist_ok=True)
        self._路径 = 路径
        self._锁 = threading.Lock()
        with self._锁, self._连接() as 库:
            库.executescript("""
                CREATE TABLE IF NOT EXISTS 跨度 (
                    跟踪号 TEXT NOT NULL, 跨度号 TEXT PRIMARY KEY,
                    节点 TEXT NOT NULL, 状态 TEXT NOT NULL,
                    耗时毫秒 INTEGER NOT NULL DEFAULT 0,
                    输入快照 TEXT NOT NULL DEFAULT '{}',
                    输出快照 TEXT NOT NULL DEFAULT '{}',
                    错误 TEXT NOT NULL DEFAULT '',
                    创建时间 REAL NOT NULL);
                CREATE INDEX IF NOT EXISTS 索引跟踪号 ON 跨度 (跟踪号);
            """)

    def _连接(self) -> sqlite3.Connection:
        库 = sqlite3.connect(self._路径, check_same_thread=False)
        库.row_factory = sqlite3.Row
        return 库

    def 记跨度(self, 跟踪号: str, 节点: str, 状态: str, 耗时毫秒: int,
               输入: object, 输出: object, 错误: str = "") -> str:
        跨度号 = uuid.uuid4().hex[:16]
        with self._锁, self._连接() as 库:
            库.execute("INSERT INTO 跨度 (跟踪号, 跨度号, 节点, 状态, 耗时毫秒, 输入快照, 输出快照, 错误, 创建时间)"
                       " VALUES (?,?,?,?,?,?,?,?,?)",
                       (跟踪号, 跨度号, 节点, 状态, 耗时毫秒,
                        json.dumps(输入, ensure_ascii=False, default=str)[:4000],
                        json.dumps(输出, ensure_ascii=False, default=str)[:4000],
                        错误[:2000], time.time()))
        return 跨度号

    def 按跟踪回放(self, 跟踪号: str) -> list[dict]:
        with self._锁, self._连接() as 库:
            行们 = 库.execute("SELECT 跟踪号, 跨度号, 节点, 状态, 耗时毫秒, 输入快照, 输出快照, 错误, 创建时间"
                              " FROM 跨度 WHERE 跟踪号 = ? ORDER BY 创建时间", (跟踪号,)).fetchall()
            return [dict(行) for 行 in 行们]
