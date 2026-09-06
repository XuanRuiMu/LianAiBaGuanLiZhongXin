import asyncio
import logging
import time
import uuid
from typing import Any, Awaitable, Callable

from app.编排.存储 import 编排存储
from app.编排.模型 import 流程定义, 节点定义, 节点类型清单
from app.编排.求值器 import 取路径, 条件成立, 安全求值
from app.编排.追踪 import 追踪存储
from app.工具总线.注册表 import 工具注册表

logger = logging.getLogger(__name__)


class 编排错误(Exception):
    pass


class 审批挂起(Exception):
    def __init__(self, 审批单: dict) -> None:
        super().__init__("等待人工审批")
        self.审批单 = 审批单


def 拓扑分层(流程: 流程定义) -> list[list[str]]:
    入度: dict[str, int] = {节点.编号: 0 for 节点 in 流程.节点}
    后继: dict[str, list[str]] = {节点.编号: [] for 节点 in 流程.节点}
    for 边 in 流程.边:
        if 边.从 not in 入度 or 边.到 not in 入度:
            raise 编排错误(f"边引用未知节点：{边.从}->{边.到}")
        入度[边.到] += 1
        后继[边.从].append(边.到)
    就绪 = sorted([编号 for 编号, 度 in 入度.items() if 度 == 0])
    分层: list[list[str]] = []
    while 就绪:
        分层.append(就绪)
        下批 = []
        for 编号 in 就绪:
            for 后 in 后继[编号]:
                入度[后] -= 1
                if 入度[后] == 0:
                    下批.append(后)
        就绪 = sorted(下批)
    if sum(len(层) for 层 in 分层) != len(流程.节点):
        raise 编排错误("流程存在环形依赖")
    return 分层


class 编排引擎:
    def __init__(self, 存储: 编排存储, 追踪: 追踪存储, 注册表: 工具注册表,
                 大模型调用: Callable[[str], Awaitable[str]] | None = None,
                 循环上限: int = 100, 退避基数: float = 0.2) -> None:
        self._存储 = 存储
        self._追踪 = 追踪
        self._注册表 = 注册表
        self._大模型调用 = 大模型调用
        self._循环上限 = 循环上限
        self._退避基数 = 退避基数

    def 校验(self, 流程: 流程定义) -> None:
        编号集 = {节点.编号 for 节点 in 流程.节点}
        if len(编号集) != len(流程.节点):
            raise 编排错误("节点编号重复")
        开始数 = sum(1 for 节点 in 流程.节点 if 节点.类型 == "开始")
        if 开始数 != 1:
            raise 编排错误("流程须有且仅有一个开始节点")
        for 节点 in 流程.节点:
            if 节点.类型 not in 节点类型清单:
                raise 编排错误(f"未知节点类型：{节点.类型}")
            if 节点.出错跳到 and 节点.出错跳到 not in 编号集:
                raise 编排错误(f"错误分支指向未知节点：{节点.出错跳到}")
        拓扑分层(流程)

    async def 运行(self, 流程: 流程定义, 输入: dict | None = None) -> dict:
        self.校验(流程)
        self._存储.保存版本(流程)
        执行号 = uuid.uuid4().hex[:16]
        跟踪号 = uuid.uuid4().hex[:16]
        上下文: dict = dict(输入 or {})
        self._存储.新建执行(执行号, 流程.名称, 流程.版本, 上下文)
        try:
            结果 = await asyncio.wait_for(
                self._跑图(流程, 上下文, set(), 跟踪号, 执行号), timeout=流程.超时秒)
        except asyncio.TimeoutError as 异常:
            self._存储.更新执行(执行号, "失败", 上下文, "")
            raise 编排错误("流程执行超时") from 异常
        return {"执行号": 执行号, "跟踪号": 跟踪号, **结果}

    async def 恢复(self, 执行号: str, 审批结果: dict) -> dict:
        快照 = self._存储.取执行(执行号)
        if 快照 is None:
            raise 编排错误("执行记录不存在")
        if 快照["状态"] != "挂起":
            raise 编排错误("执行不在挂起态")
        流程 = self._存储.取版本(快照["流程名"], 快照["版本"])
        if 流程 is None:
            raise 编排错误("流程版本不存在")
        上下文 = dict(快照["上下文"])
        已完成 = set(上下文.pop("__已完成__", []))
        失败集 = set(上下文.pop("__失败集__", []))
        分支出 = dict(上下文.pop("__分支__", {}))
        跟踪号 = uuid.uuid4().hex[:16]
        当前 = str(快照.get("当前节点") or "")
        if 当前:
            上下文[当前] = {"批准": bool(审批结果.get("批准", False)),
                           "意见": str(审批结果.get("意见", ""))}
            已完成.add(当前)
        try:
            结果 = await asyncio.wait_for(
                self._跑图(流程, 上下文, 已完成, 跟踪号, 执行号, 失败集, 分支出), timeout=流程.超时秒)
        except asyncio.TimeoutError as 异常:
            self._存储.更新执行(执行号, "失败", 上下文, "")
            raise 编排错误("流程执行超时") from 异常
        return {"执行号": 执行号, "跟踪号": 跟踪号, **结果}

    async def _跑图(self, 流程: 流程定义, 上下文: dict, 已完成: set[str],
                   跟踪号: str, 执行号: str, 失败集: set[str] | None = None,
                   分支产出: dict[str, str] | None = None) -> dict:
        节点表 = {节点.编号: 节点 for 节点 in 流程.节点}
        前驱: dict[str, list[tuple[str, str]]] = {编号: [] for 编号 in 节点表}
        for 边 in 流程.边:
            前驱[边.到].append((边.从, 边.分支))
        节点状态: dict[str, dict] = {}
        if 分支产出 is None:
            分支产出 = {}
        if 失败集 is None:
            失败集 = set()

        while len(已完成) < len(节点表):
            就绪 = []
            for 编号, 节点 in 节点表.items():
                if 编号 in 已完成:
                    continue
                可跑 = True
                for 从, 分支 in 前驱[编号]:
                    if 从 not in 已完成 or 从 in 失败集:
                        可跑 = False
                        break
                    if 分支 and 分支产出.get(从, "") != 分支:
                        可跑 = False
                        break
                if 可跑:
                    就绪.append(编号)
            if not 就绪:
                for 编号 in sorted(set(节点表) - 已完成):
                    节点状态[编号] = {"状态": "跳过", "耗时毫秒": 0, "输出摘要": ""}
                    已完成.add(编号)
                    self._追踪.记跨度(跟踪号, 编号, "跳过", 0,
                                      {"节点": 编号}, None, "前驱失败或分支未命中")
                self._存储.更新执行(执行号, "成功", 上下文, "")
                return {"状态": "成功", "上下文": 上下文, "节点状态": 节点状态}
            try:
                本批 = await asyncio.gather(*(
                    self._跑节点(流程, 节点表[编号], 上下文, 跟踪号) for 编号 in sorted(就绪)
                ))
            except 审批挂起 as 挂起:
                self._存储.更新执行(执行号, "挂起",
                                    {**上下文, "__已完成__": sorted(已完成),
                                     "__失败集__": sorted(失败集),
                                     "__分支__": dict(分支产出)},
                                    挂起.审批单.get("节点", ""))
                return {"状态": "挂起", "上下文": 上下文, "节点状态": 节点状态,
                        "审批单": 挂起.审批单}
            for 编号, (状态, 输出, 耗时毫秒, 分支) in zip(sorted(就绪), 本批):
                已完成.add(编号)
                节点状态[编号] = {"状态": 状态, "耗时毫秒": 耗时毫秒,
                                 "输出摘要": str(输出)[:200]}
                if 分支:
                    分支产出[编号] = 分支
                if 状态 == "失败":
                    失败集.add(编号)
                    跳到 = 节点表[编号].出错跳到
                    if 跳到 and 跳到 not in 已完成:
                        前驱[跳到] = []
                    else:
                        self._存储.更新执行(执行号, "失败",
                                            {**上下文, "__已完成__": sorted(已完成)}, 编号)
                        return {"状态": "失败", "上下文": 上下文,
                                "节点状态": 节点状态, "错误": f"节点失败：{编号}"}
        self._存储.更新执行(执行号, "成功", 上下文, "")
        return {"状态": "成功", "上下文": 上下文, "节点状态": 节点状态}

    async def _跑节点(self, 流程: 流程定义, 节点: 节点定义,
                     上下文: dict, 跟踪号: str) -> tuple[str, Any, int, str]:
        开始 = time.monotonic()
        尝试 = 0
        while True:
            try:
                输出, 分支 = await asyncio.wait_for(
                    self._执行节点(节点, 上下文), timeout=节点.超时秒)
                耗时 = int((time.monotonic() - 开始) * 1000)
                self._追踪.记跨度(跟踪号, 节点.编号, "成功", 耗时,
                                  {"节点": 节点.编号, "类型": 节点.类型}, 输出)
                return "成功", 输出, 耗时, 分支
            except 审批挂起:
                raise
            except (asyncio.TimeoutError, TimeoutError) as 异常:
                错误 = f"节点超时（{节点.超时秒}秒）"
                最后 = 尝试 >= 节点.最大重试
            except Exception as 异常:
                错误 = str(异常) or type(异常).__name__
                最后 = 尝试 >= 节点.最大重试
            if 最后:
                耗时 = int((time.monotonic() - 开始) * 1000)
                self._追踪.记跨度(跟踪号, 节点.编号, "失败", 耗时,
                                  {"节点": 节点.编号, "类型": 节点.类型}, None, 错误)
                return "失败", 错误, 耗时, ""
            尝试 += 1
            await asyncio.sleep(min(self._退避基数 * (2 ** (尝试 - 1)), 5))

    async def _执行节点(self, 节点: 节点定义, 上下文: dict) -> tuple[Any, str]:
        类型 = 节点.类型
        参数 = 节点.参数
        if 类型 == "开始":
            return {"已开始": True}, ""
        if 类型 == "结束":
            return {"已结束": True}, ""
        if 类型 == "工具调用":
            工具名 = str(参数.get("工具", ""))
            if 工具名 not in self._注册表:
                raise 编排错误(f"未知工具：{工具名}")
            定义 = self._注册表.取(工具名)
            入参 = dict(参数.get("参数", {}))
            if 定义.参数模型 is not None:
                已校验 = 定义.参数模型.model_validate(入参)
                输出 = await 定义.执行函数(**已校验.model_dump())
            else:
                输出 = await 定义.执行函数()
            上下文[节点.编号] = 输出
            return 输出, ""
        if 类型 == "大模型":
            if self._大模型调用 is None:
                raise 编排错误("未配置大模型调用")
            模板 = str(参数.get("提示词", ""))
            提示词 = self._渲染模板(模板, 上下文)
            输出 = await self._大模型调用(提示词)
            上下文[节点.编号] = 输出
            return 输出, ""
        if 类型 == "条件分支":
            if 节点.条件 is None:
                表达式 = str(参数.get("表达式", ""))
                成立 = bool(安全求值(表达式, 上下文)) if 表达式 else False
            else:
                左值 = 取路径(上下文, 节点.条件.左)
                成立 = 条件成立(左值, 节点.条件.算子, 节点.条件.右)
            分支 = "真" if 成立 else "假"
            上下文[节点.编号] = {"分支": 分支}
            return {"分支": 分支}, 分支
        if 类型 == "循环":
            列表 = 取路径(上下文, str(参数.get("列表", "$")))
            if not isinstance(列表, list):
                raise 编排错误("循环输入须为列表")
            if len(列表) > self._循环上限:
                raise 编排错误(f"循环长度超限（>{self._循环上限}）")
            工具名 = str(参数.get("工具", ""))
            参数名 = str(参数.get("参数名", ""))
            if 工具名 not in self._注册表:
                raise 编排错误(f"未知工具：{工具名}")
            定义 = self._注册表.取(工具名)
            结果们 = []
            for 项 in 列表:
                if 定义.参数模型 is not None:
                    已校验 = 定义.参数模型.model_validate({参数名: 项})
                    结果们.append(await 定义.执行函数(**已校验.model_dump()))
                else:
                    结果们.append(await 定义.执行函数())
            上下文[节点.编号] = 结果们
            return 结果们, ""
        if 类型 == "代码":
            输出 = 安全求值(str(参数.get("表达式", "None")), 上下文)
            上下文[节点.编号] = 输出
            return 输出, ""
        if 类型 == "人工审批":
            raise 审批挂起({"节点": 节点.编号, "标题": 节点.名称 or 节点.编号,
                            "参数": 参数})
        raise 编排错误(f"未知节点类型：{类型}")

    @staticmethod
    def _渲染模板(模板: str, 上下文: dict) -> str:
        结果 = []
        光标 = 0
        while True:
            起 = 模板.find("{$.", 光标)
            if 起 < 0:
                结果.append(模板[光标:])
                break
            止 = 模板.find("}", 起)
            if 止 < 0:
                结果.append(模板[光标:])
                break
            结果.append(模板[光标:起])
            值 = 取路径(上下文, 模板[起 + 1:止])
            结果.append("" if 值 is None else str(值))
            光标 = 止 + 1
        return "".join(结果)
