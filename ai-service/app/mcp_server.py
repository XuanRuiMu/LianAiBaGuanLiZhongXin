import inspect

from mcp.server.fastmcp import FastMCP

from app.工具总线.注册表 import 注册表

服务器 = FastMCP("liaolian-datacenter")


def _包装(定义) -> object:
    模型 = 定义.参数模型
    if 模型 is None:
        async def 无参调用() -> str:
            return await 定义.执行函数()
        无参调用.__name__ = 定义.名称
        无参调用.__doc__ = 定义.描述
        return 无参调用

    async def 有参调用(**参数) -> str:
        已校验 = 模型.model_validate(参数)
        return await 定义.执行函数(**已校验.model_dump())

    有参调用.__name__ = 定义.名称
    参数行 = "\n".join(
        f"        {名}: {字段.description or 名}。"
        for 名, 字段 in 模型.model_fields.items()
    )
    有参调用.__doc__ = f"{定义.描述}\n\n    Args:\n{参数行}\n    "
    有参调用.__signature__ = inspect.Signature(
        parameters=[
            inspect.Parameter(名, inspect.Parameter.POSITIONAL_OR_KEYWORD,
                              annotation=字段.annotation)
            for 名, 字段 in 模型.model_fields.items()
        ]
    )
    return 有参调用


for _定义 in 注册表.全部():
    服务器.tool()(_包装(_定义))


if __name__ == "__main__":
    服务器.run(transport="stdio")
