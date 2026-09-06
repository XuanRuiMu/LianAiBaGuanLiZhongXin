import re

import app.texts as texts

注入模式 = [
    r"忽略(之前|上面|所有).{0,10}(指令|提示|规则)",
    r"ignore\s+(all\s+)?(previous|prior|above)\s+instructions",
    r"system\s*:\s*你",
    r"越狱|jailbreak|dan\s+mode",
    r"输出(你的|系统|内部).{0,8}(提示词|密钥|密码)",
]

手机号模式 = re.compile(r"(?<!\d)1[3-9]\d{9}(?!\d)")
身份证模式 = re.compile(r"(?<!\d)\d{17}[\dXx](?!\d)")
邮箱模式 = re.compile(r"[\w.+-]+@[\w-]+\.[\w.]+")

敏感词表 = ["密码", "密钥", "令牌", "身份证", "银行卡"]


def 检测注入(文本: str) -> str:
    for 模式 in 注入模式:
        if re.search(模式, 文本, re.IGNORECASE):
            return 模式
    return ""


def 脱敏(文本: str) -> str:
    文本 = 手机号模式.sub("138****0000", 文本)
    文本 = 身份证模式.sub("******************", 文本)
    文本 = 邮箱模式.sub("***@***", 文本)
    return 文本


def 输出过滤(文本: str) -> str:
    for 词 in 敏感词表:
        if 词 in 文本 and ("我的" + 词 in 文本 or "你的" + 词 in 文本):
            return texts.服务错误_通用
    return 文本


def 输入护栏(文本: str) -> str:
    命中 = 检测注入(文本)
    if 命中:
        raise ValueError("输入包含注入特征，已拦截")
    return 脱敏(文本)
