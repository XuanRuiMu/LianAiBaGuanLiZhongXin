import difflib
import json
import sqlite3
import threading
import time
from pathlib import Path

import yaml

from app.编排.模型 import 流程定义


class 编排存储:
    def __init__(self, 路径: str = "./data/编排.db") -> None:
        Path(路径).parent.mkdir(parents=True, exist_ok=True)
        self._路径 = 路径
        self._锁 = threading.Lock()
        with self._锁, self._连接() as 库:
            库.executescript("""
                CREATE TABLE IF NOT EXISTS 流程 (
                    名称 TEXT NOT NULL, 版本 INTEGER NOT NULL,
                    定义 TEXT NOT NULL, 创建时间 REAL NOT NULL,
                    PRIMARY KEY (名称, 版本));
                CREATE TABLE IF NOT EXISTS 执行 (
                    执行号 TEXT PRIMARY KEY, 流程名 TEXT NOT NULL,
                    版本 INTEGER NOT NULL, 状态 TEXT NOT NULL,
                    上下文 TEXT NOT NULL DEFAULT '{}',
                    当前节点 TEXT NOT NULL DEFAULT '',
                    创建时间 REAL NOT NULL, 更新时间 REAL NOT NULL);
            """)

    def _连接(self) -> sqlite3.Connection:
        库 = sqlite3.connect(self._路径, check_same_thread=False)
        库.row_factory = sqlite3.Row
        return 库

    def 保存版本(self, 定义: 流程定义) -> int:
        with self._锁, self._连接() as 库:
            行 = 库.execute("SELECT MAX(版本) AS 最大 FROM 流程 WHERE 名称 = ?",
                            (定义.名称,)).fetchone()
            新版 = (行["最大"] or 0) + 1
            定义.版本 = 新版
            库.execute("INSERT INTO 流程 (名称, 版本, 定义, 创建时间) VALUES (?,?,?,?)",
                       (定义.名称, 新版, 定义.model_dump_json(), time.time()))
            return 新版

    def 取版本(self, 名称: str, 版本: int = 0) -> 流程定义 | None:
        with self._锁, self._连接() as 库:
            if 版本 <= 0:
                行 = 库.execute("SELECT 定义 FROM 流程 WHERE 名称 = ? ORDER BY 版本 DESC LIMIT 1",
                                (名称,)).fetchone()
            else:
                行 = 库.execute("SELECT 定义 FROM 流程 WHERE 名称 = ? AND 版本 = ?",
                                (名称, 版本)).fetchone()
            return None if 行 is None else 流程定义.model_validate_json(行["定义"])

    def 版本差异(self, 名称: str, 旧版: int, 新版: int) -> list[str]:
        旧 = self.取版本(名称, 旧版)
        新 = self.取版本(名称, 新版)
        if 旧 is None or 新 is None:
            raise ValueError("版本不存在")
        旧文 = 旧.model_dump_json(indent=2).splitlines()
        新文 = 新.model_dump_json(indent=2).splitlines()
        return list(difflib.unified_diff(旧文, 新文, f"v{旧版}", f"v{新版}", lineterm=""))

    def 导出YAML(self, 定义: 流程定义) -> str:
        return yaml.safe_dump(json.loads(定义.model_dump_json()),
                              allow_unicode=True, sort_keys=False)

    def 从YAML导入(self, 文本: str) -> 流程定义:
        数据 = yaml.safe_load(文本)
        if not isinstance(数据, dict):
            raise ValueError("YAML 顶层须为映射")
        return 流程定义.model_validate(数据)

    def 新建执行(self, 执行号: str, 流程名: str, 版本: int, 上下文: dict) -> None:
        with self._锁, self._连接() as 库:
            库.execute("INSERT INTO 执行 (执行号, 流程名, 版本, 状态, 上下文, 创建时间, 更新时间)"
                       " VALUES (?,?,?,?,?,?,?)",
                       (执行号, 流程名, 版本, "运行中",
                        json.dumps(上下文, ensure_ascii=False, default=str),
                        time.time(), time.time()))

    def 更新执行(self, 执行号: str, 状态: str, 上下文: dict, 当前节点: str = "") -> None:
        with self._锁, self._连接() as 库:
            库.execute("UPDATE 执行 SET 状态=?, 上下文=?, 当前节点=?, 更新时间=? WHERE 执行号=?",
                       (状态, json.dumps(上下文, ensure_ascii=False, default=str),
                        当前节点, time.time(), 执行号))

    def 取执行(self, 执行号: str) -> dict | None:
        with self._锁, self._连接() as 库:
            行 = 库.execute("SELECT 执行号, 流程名, 版本, 状态, 上下文, 当前节点 FROM 执行 WHERE 执行号 = ?",
                            (执行号,)).fetchone()
            if 行 is None:
                return None
            结果 = dict(行)
            结果["上下文"] = json.loads(结果["上下文"])
            return 结果
