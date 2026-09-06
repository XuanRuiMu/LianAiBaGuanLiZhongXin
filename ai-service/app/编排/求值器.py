import ast
from typing import Any


def 取路径(上下文: dict, 路径: str) -> Any:
    if not 路径.startswith("$."):
        raise ValueError(f"路径须以 $. 开头：{路径}")
    当前: Any = 上下文
    for 段 in 路径[2:].split("."):
        if isinstance(当前, dict) and 段 in 当前:
            当前 = 当前[段]
        elif isinstance(当前, list) and 段.isdigit() and int(段) < len(当前):
            当前 = 当前[int(段)]
        else:
            return None
    return 当前


class _安全求值(ast.NodeVisitor):
    def __init__(self, 上下文: dict) -> None:
        self._上下文 = 上下文

    def visit_Expression(self, 节点: ast.Expression) -> Any:
        return self.visit(节点.body)

    def visit_Constant(self, 节点: ast.Constant) -> Any:
        if isinstance(节点.value, (str, int, float, bool)) or 节点.value is None:
            return 节点.value
        raise ValueError("仅支持字面量")

    def visit_Name(self, 节点: ast.Name) -> Any:
        if 节点.id in ("True", "False", "None"):
            return {"True": True, "False": False, "None": None}[节点.id]
        raise ValueError(f"未知变量：{节点.id}")

    def visit_Attribute(self, 节点: ast.Attribute) -> Any:
        宿主 = self.visit(节点.value)
        if isinstance(宿主, dict) and 节点.attr in 宿主:
            return 宿主[节点.attr]
        raise ValueError(f"未知属性：{节点.attr}")

    def visit_Subscript(self, 节点: ast.Subscript) -> Any:
        宿主 = self.visit(节点.value)
        键 = self.visit(节点.slice)
        if isinstance(宿主, dict) and 键 in 宿主:
            return 宿主[键]
        if isinstance(宿主, list) and isinstance(键, int) and 0 <= 键 < len(宿主):
            return 宿主[键]
        raise ValueError("下标越界或缺失")

    def visit_Compare(self, 节点: ast.Compare) -> Any:
        左 = self.visit(节点.left)
        for 算子, 右节点 in zip(节点.ops, 节点.comparators):
            右 = self.visit(右节点)
            if isinstance(算子, ast.Eq):
                结果 = 左 == 右
            elif isinstance(算子, ast.NotEq):
                结果 = 左 != 右
            elif isinstance(算子, ast.Gt):
                结果 = 左 > 右
            elif isinstance(算子, ast.GtE):
                结果 = 左 >= 右
            elif isinstance(算子, ast.Lt):
                结果 = 左 < 右
            elif isinstance(算子, ast.LtE):
                结果 = 左 <= 右
            elif isinstance(算子, ast.In):
                结果 = 左 in 右
            elif isinstance(算子, ast.NotIn):
                结果 = 左 not in 右
            else:
                raise ValueError("不支持的比较算子")
            if not 结果:
                return False
            左 = 右
        return True

    def visit_BoolOp(self, 节点: ast.BoolOp) -> Any:
        值们 = [self.visit(v) for v in 节点.values]
        if isinstance(节点.op, ast.And):
            return all(值们)
        if isinstance(节点.op, ast.Or):
            return any(值们)
        raise ValueError("不支持的布尔算子")

    def visit_UnaryOp(self, 节点: ast.UnaryOp) -> Any:
        if isinstance(节点.op, ast.Not):
            return not self.visit(节点.operand)
        raise ValueError("不支持的一元算子")

    def visit_BinOp(self, 节点: ast.BinOp) -> Any:
        左 = self.visit(节点.left)
        右 = self.visit(节点.right)
        if not isinstance(左, (int, float)) or not isinstance(右, (int, float)):
            raise ValueError("算术运算仅支持数字")
        if isinstance(节点.op, ast.Add):
            return 左 + 右
        if isinstance(节点.op, ast.Sub):
            return 左 - 右
        if isinstance(节点.op, ast.Mult):
            return 左 * 右
        if isinstance(节点.op, ast.Div):
            if 右 == 0:
                raise ValueError("除数不能为零")
            return 左 / 右
        if isinstance(节点.op, ast.FloorDiv):
            if 右 == 0:
                raise ValueError("除数不能为零")
            return 左 // 右
        if isinstance(节点.op, ast.Mod):
            if 右 == 0:
                raise ValueError("除数不能为零")
            return 左 % 右
        raise ValueError("不支持的算术算子")

    def generic_visit(self, 节点: ast.AST) -> Any:
        raise ValueError(f"不支持的表达式：{type(节点).__name__}")


def 安全求值(表达式: str, 上下文: dict) -> Any:
    树 = ast.parse(表达式, mode="eval")
    return _安全求值(上下文).visit(树)


def 条件成立(左值: Any, 算子: str, 右值: Any) -> bool:
    if 算子 == "==":
        return 左值 == 右值
    if 算子 == "!=":
        return 左值 != 右值
    if 算子 == ">":
        return 左值 > 右值
    if 算子 == ">=":
        return 左值 >= 右值
    if 算子 == "<":
        return 左值 < 右值
    if 算子 == "<=":
        return 左值 <= 右值
    if 算子 == "包含":
        return 右值 in 左值 if 左值 is not None else False
    if 算子 == "不包含":
        return 右值 not in 左值 if 左值 is not None else True
    raise ValueError(f"未知算子：{算子}")
