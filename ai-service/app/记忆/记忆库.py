import threading
import time

import psycopg
from pgvector.psycopg import register_vector

from app.config import 取配置


class 记忆库不可用异常(RuntimeError):
    pass


class 记忆库:
    def __init__(self, 连接串: str = "") -> None:
        配置 = 取配置()
        self._连接串 = 连接串 or 配置.记忆库地址
        self._锁 = threading.Lock()

    def _连接(self):
        try:
            库 = psycopg.connect(self._连接串, connect_timeout=5)
        except Exception as 异常:
            raise 记忆库不可用异常("记忆库连接失败") from 异常
        register_vector(库)
        return 库

    def 存语义(self, 文本: str, 来源: str, 向量: list[float],
               置信度: float = 1.0, 有效天数: int = 90) -> int:
        with self._锁, self._连接() as 库:
            行 = 库.execute(
                'INSERT INTO "语义记忆" ("文本", "来源", "向量", "置信度", "过期时间")'
                " VALUES (%s,%s,%s::vector,%s,NOW() + make_interval(days => %s)) RETURNING \"编号\"",
                (文本, 来源, 向量, 置信度, 有效天数)).fetchone()
            assert 行 is not None
            return int(行[0])

    def 向量召回(self, 向量: list[float], 条数: int = 20) -> list[dict]:
        with self._锁, self._连接() as 库:
            行们 = 库.execute(
                'SELECT "编号", "文本", "来源", "置信度",'
                ' "向量" <=> %s::vector AS 距离 FROM "语义记忆"'
                ' WHERE ("过期时间" IS NULL OR "过期时间" > NOW())'
                " ORDER BY 距离 LIMIT %s", (向量, 条数)).fetchall()
            return [{"编号": r[0], "文本": r[1], "来源": r[2], "置信度": r[3],
                     "距离": float(r[4])} for r in 行们]

    def 全文召回(self, 查询词: str, 条数: int = 20) -> list[dict]:
        模糊 = f"%{查询词}%"
        with self._锁, self._连接() as 库:
            行们 = 库.execute(
                'SELECT "编号", "文本", "来源", "置信度",'
                ' (ts_rank("全文", plainto_tsquery(\'simple\', %s))'
                '  + CASE WHEN "文本" ILIKE %s THEN 1.0 ELSE 0 END) AS 评分'
                ' FROM "语义记忆"'
                " WHERE (\"全文\" @@ plainto_tsquery('simple', %s)"
                '  OR "文本" ILIKE %s)'
                ' AND ("过期时间" IS NULL OR "过期时间" > NOW())'
                " ORDER BY 评分 DESC LIMIT %s",
                (查询词, 模糊, 查询词, 模糊, 条数)).fetchall()
            return [{"编号": r[0], "文本": r[1], "来源": r[2], "置信度": r[3],
                     "评分": float(r[4])} for r in 行们]

    def 读情景(self, 会话号: str) -> dict:
        with self._锁, self._连接() as 库:
            行 = 库.execute('SELECT "摘要", "轮数" FROM "情景记忆" WHERE "会话号" = %s',
                            (会话号,)).fetchone()
            if 行 is None:
                return {"摘要": "", "轮数": 0}
            return {"摘要": 行[0], "轮数": int(行[1])}

    def 写情景(self, 会话号: str, 摘要: str, 轮数: int) -> None:
        with self._锁, self._连接() as 库:
            库.execute('INSERT INTO "情景记忆" ("会话号", "摘要", "轮数", "更新时间")'
                       " VALUES (%s,%s,%s,NOW())"
                       ' ON CONFLICT ("会话号") DO UPDATE SET "摘要"=EXCLUDED."摘要",'
                       ' "轮数"=EXCLUDED."轮数", "更新时间"=NOW()',
                       (会话号, 摘要, 轮数))

    def 记账本(self, 跟踪号: str, 提供者: str, 模型: str,
               输入Token: int, 输出Token: int, 花费元: float) -> None:
        try:
            with self._锁, self._连接() as 库:
                库.execute('INSERT INTO "模型调用账本"'
                           ' ("跟踪号","提供者","模型","输入Token","输出Token","花费元")'
                           " VALUES (%s,%s,%s,%s,%s,%s)",
                           (跟踪号, 提供者, 模型, 输入Token, 输出Token, 花费元))
        except 记忆库不可用异常:
            pass

    def 记跨度(self, 跟踪号: str, 跨度号: str, 节点: str, 状态: str,
               耗时毫秒: int, 输入: str, 输出: str, 错误: str = "") -> None:
        try:
            with self._锁, self._连接() as 库:
                库.execute('INSERT INTO "跟踪跨度"'
                           ' ("跟踪号","跨度号","服务","节点","状态","耗时毫秒",'
                           '"输入快照","输出快照","错误")'
                           " VALUES (%s,%s,'ai-service',%s,%s,%s,%s,%s,%s)",
                           (跟踪号, 跨度号, 节点, 状态, 耗时毫秒,
                            输入[:4000], 输出[:4000], 错误[:2000]))
        except 记忆库不可用异常:
            pass

    def 按跟踪回放(self, 跟踪号: str) -> list[dict]:
        with self._锁, self._连接() as 库:
            行们 = 库.execute(
                'SELECT "跟踪号","跨度号","节点","状态","耗时毫秒",'
                '"输入快照","输出快照","错误","创建时间" FROM "跟踪跨度"'
                ' WHERE "跟踪号"=%s ORDER BY "创建时间"', (跟踪号,)).fetchall()
            列 = ["跟踪号", "跨度号", "节点", "状态", "耗时毫秒",
                  "输入快照", "输出快照", "错误", "创建时间"]
            return [dict(zip(列, [str(v) for v in r])) for r in 行们]


_实例锁 = threading.Lock()
_实例: 记忆库 | None = None


def 取记忆库() -> 记忆库:
    global _实例
    with _实例锁:
        if _实例 is None:
            _实例 = 记忆库()
        return _实例


def 健康探针() -> bool:
    try:
        取记忆库().读情景("__探针__")
        return True
    except Exception:
        return False
