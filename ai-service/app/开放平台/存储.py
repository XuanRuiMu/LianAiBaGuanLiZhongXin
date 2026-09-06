import hashlib
import hmac
import json
import secrets
import sqlite3
import threading
import time
from pathlib import Path


def _哈希(明文: str) -> str:
    return hashlib.sha256(明文.encode("utf-8")).hexdigest()


class 开放平台存储:
    def __init__(self, 路径: str = "./data/开放平台.db") -> None:
        Path(路径).parent.mkdir(parents=True, exist_ok=True)
        self._路径 = 路径
        self._锁 = threading.Lock()
        self._建表()

    def _连接(self) -> sqlite3.Connection:
        库 = sqlite3.connect(self._路径, check_same_thread=False)
        库.row_factory = sqlite3.Row
        return 库

    def _建表(self) -> None:
        with self._锁, self._连接() as 库:
            库.executescript("""
                CREATE TABLE IF NOT EXISTS 接口密钥 (
                    哈希 TEXT PRIMARY KEY, 名称 TEXT NOT NULL,
                    配额 INTEGER NOT NULL DEFAULT 1000, 已用 INTEGER NOT NULL DEFAULT 0,
                    启用 INTEGER NOT NULL DEFAULT 1, 创建时间 REAL NOT NULL);
                CREATE TABLE IF NOT EXISTS 投递记录 (
                    序号 INTEGER PRIMARY KEY AUTOINCREMENT, 事件 TEXT NOT NULL,
                    地址 TEXT NOT NULL, 状态 TEXT NOT NULL DEFAULT '待投递',
                    次数 INTEGER NOT NULL DEFAULT 0, 下次重试 REAL NOT NULL DEFAULT 0,
                    响应码 INTEGER, 创建时间 REAL NOT NULL);
                CREATE TABLE IF NOT EXISTS 幂等键 (
                    键 TEXT PRIMARY KEY, 响应 TEXT NOT NULL, 创建时间 REAL NOT NULL);
            """)

    def 创建密钥(self, 名称: str, 配额: int = 1000) -> str:
        明文 = f"lk-{secrets.token_urlsafe(32)}"
        with self._锁, self._连接() as 库:
            库.execute("INSERT INTO 接口密钥 (哈希, 名称, 配额, 已用, 启用, 创建时间) VALUES (?,?,?,?,?,?)",
                       (_哈希(明文), 名称, 配额, 0, 1, time.time()))
        return 明文

    def 校验并占用(self, 明文: str) -> str | None:
        摘要 = _哈希(明文)
        with self._锁, self._连接() as 库:
            行 = 库.execute("SELECT 名称, 配额, 已用, 启用 FROM 接口密钥 WHERE 哈希 = ?", (摘要,)).fetchone()
            if 行 is None or not 行["启用"] or 行["已用"] >= 行["配额"]:
                return None
            库.execute("UPDATE 接口密钥 SET 已用 = 已用 + 1 WHERE 哈希 = ?", (摘要,))
            return str(行["名称"])

    def 记录投递(self, 事件: str, 地址: str) -> int:
        with self._锁, self._连接() as 库:
            游标 = 库.execute("INSERT INTO 投递记录 (事件, 地址, 创建时间) VALUES (?,?,?)",
                              (事件, 地址, time.time()))
            return int(游标.lastrowid)

    def 更新投递(self, 序号: int, 状态: str, 响应码: int | None, 下次重试: float) -> None:
        with self._锁, self._连接() as 库:
            库.execute("UPDATE 投递记录 SET 状态=?, 次数=次数+1, 响应码=?, 下次重试=? WHERE 序号=?",
                       (状态, 响应码, 下次重试, 序号))

    def 待重试(self, 现在: float, 上限: int = 20) -> list[dict]:
        with self._锁, self._连接() as 库:
            行们 = 库.execute("SELECT 序号, 事件, 地址, 次数 FROM 投递记录 "
                              "WHERE 状态 IN ('待投递','重试中') AND 下次重试 <= ? "
                              "ORDER BY 序号 LIMIT ?", (现在, 上限)).fetchall()
            return [dict(行) for 行 in 行们]

    def 投递历史(self, 条数: int = 20) -> list[dict]:
        with self._锁, self._连接() as 库:
            行们 = 库.execute("SELECT 序号, 事件, 地址, 状态, 次数, 响应码, 创建时间 "
                              "FROM 投递记录 ORDER BY 序号 DESC LIMIT ?", (条数,)).fetchall()
            return [dict(行) for 行 in 行们]

    def 取幂等(self, 键: str) -> str | None:
        with self._锁, self._连接() as 库:
            行 = 库.execute("SELECT 响应 FROM 幂等键 WHERE 键 = ?", (键,)).fetchone()
            return None if 行 is None else str(行["响应"])

    def 存幂等(self, 键: str, 响应: dict) -> None:
        with self._锁, self._连接() as 库:
            库.execute("INSERT OR IGNORE INTO 幂等键 (键, 响应, 创建时间) VALUES (?,?,?)",
                       (键, json.dumps(响应, ensure_ascii=False), time.time()))


def 计算签名(密钥: str, 时间戳: str, 载荷: bytes) -> str:
    return hmac.new(密钥.encode("utf-8"), 时间戳.encode("utf-8") + b"." + 载荷,
                    hashlib.sha256).hexdigest()
