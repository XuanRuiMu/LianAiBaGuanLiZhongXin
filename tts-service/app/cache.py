"""合成缓存：SHA256键 + 有界LRU + 单飞去重，O(1)命中，零外部依赖。"""

from __future__ import annotations

import asyncio
import hashlib
from collections import OrderedDict


def 缓存键(text: str, voice: str, rate: float, pitch: float, volume: float, style: str) -> str:
    原料 = f"{text}\x00{voice}\x00{rate:.3f}\x00{pitch:.3f}\x00{volume:.3f}\x00{style}"
    return hashlib.sha256(原料.encode("utf-8")).hexdigest()


class 合成缓存:
    def __init__(self, 最大条目: int = 200):
        self._表: OrderedDict[str, bytes] = OrderedDict()
        self._最大 = max(1, 最大条目)
        self._锁 = asyncio.Lock()
        self._在途: dict[str, asyncio.Future] = {}
        self.命中 = 0
        self.未命中 = 0

    async def 取(self, 键: str) -> bytes | None:
        async with self._锁:
            数据 = self._表.get(键)
            if 数据 is None:
                return None
            self._表.move_to_end(键)
            self.命中 += 1
            return 数据

    async def 存(self, 键: str, 数据: bytes) -> None:
        async with self._锁:
            self._表[键] = 数据
            self._表.move_to_end(键)
            while len(self._表) > self._最大:
                self._表.popitem(last=False)
            self.未命中 += 1

    async def 单飞(self, 键: str) -> tuple[bool, asyncio.Future | None]:
        async with self._锁:
            现有 = self._表.get(键)
            if 现有 is not None:
                self._表.move_to_end(键)
                self.命中 += 1
                完成 = asyncio.get_running_loop().create_future()
                完成.set_result(现有)
                return True, 完成
            在途 = self._在途.get(键)
            if 在途 is not None:
                return True, 在途
            未来: asyncio.Future = asyncio.get_running_loop().create_future()
            self._在途[键] = 未来
            return False, 未来

    async def 单飞完成(self, 键: str, 数据: bytes | None, 异常: BaseException | None = None) -> None:
        async with self._锁:
            未来 = self._在途.pop(键, None)
            if 数据 is not None:
                self._表[键] = 数据
                self._表.move_to_end(键)
                while len(self._表) > self._最大:
                    self._表.popitem(last=False)
                self.未命中 += 1
            if 未来 is not None and not 未来.done():
                if 异常 is not None:
                    未来.set_exception(异常)
                else:
                    未来.set_result(data if (data := 数据) is not None else b"")

    def 状态(self) -> dict:
        return {"条目": len(self._表), "上限": self._最大, "命中": self.命中, "未命中": self.未命中}
