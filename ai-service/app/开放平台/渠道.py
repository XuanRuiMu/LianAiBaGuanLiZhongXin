from abc import ABC, abstractmethod
import logging
import smtplib
from email.mime.text import MIMEText

import httpx

from app.config import 取配置

logger = logging.getLogger(__name__)


class 通知渠道(ABC):
    名称: str = "base"

    @abstractmethod
    async def 发送(self, 标题: str, 内容: str) -> bool:
        raise NotImplementedError

    def 可用(self) -> bool:
        return True


class 飞书渠道(通知渠道):
    名称 = "飞书"

    def 可用(self) -> bool:
        return bool(取配置().飞书地址.strip())

    async def 发送(self, 标题: str, 内容: str) -> bool:
        地址 = 取配置().飞书地址.strip()
        async with httpx.AsyncClient(timeout=10) as 客户端:
            响应 = await 客户端.post(地址, json={"msg_type": "text",
                "content": {"text": f"{标题}\n{内容}"}})
        return 响应.status_code == 200


class 企微渠道(通知渠道):
    名称 = "企微"

    def 可用(self) -> bool:
        return bool(取配置().企微地址.strip())

    async def 发送(self, 标题: str, 内容: str) -> bool:
        地址 = 取配置().企微地址.strip()
        async with httpx.AsyncClient(timeout=10) as 客户端:
            响应 = await 客户端.post(地址, json={"msgtype": "text",
                "text": {"content": f"{标题}\n{内容}"}})
        return 响应.status_code == 200


class 钉钉渠道(通知渠道):
    名称 = "钉钉"

    def 可用(self) -> bool:
        return bool(取配置().钉钉地址.strip())

    async def 发送(self, 标题: str, 内容: str) -> bool:
        地址 = 取配置().钉钉地址.strip()
        async with httpx.AsyncClient(timeout=10) as 客户端:
            响应 = await 客户端.post(地址, json={"msgtype": "text",
                "text": {"content": f"{标题}\n{内容}"}})
        return 响应.status_code == 200


class 邮件渠道(通知渠道):
    名称 = "邮件"

    def 可用(self) -> bool:
        配置 = 取配置()
        return bool(配置.邮件服务.strip() and 配置.邮件发件人.strip())

    async def 发送(self, 标题: str, 内容: str) -> bool:
        配置 = 取配置()
        消息 = MIMEText(内容, "plain", "utf-8")
        消息["Subject"] = 标题
        消息["From"] = 配置.邮件发件人
        消息["To"] = 配置.邮件收件人
        with smtplib.SMTP(配置.邮件服务, 配置.邮件端口, timeout=10) as 服务:
            if 配置.邮件用户名:
                服务.login(配置.邮件用户名, 配置.邮件密码)
            服务.send_message(消息)
        return True


渠道表: list[通知渠道] = [飞书渠道(), 企微渠道(), 钉钉渠道(), 邮件渠道()]


async def 广播通知(标题: str, 内容: str) -> dict[str, bool]:
    结果 = {}
    for 渠道 in 渠道表:
        if not 渠道.可用():
            continue
        try:
            结果[渠道.名称] = await 渠道.发送(标题, 内容)
        except Exception as 异常:
            logger.warning("渠道 %s 发送失败，已跳过: %s", 渠道.名称, 异常)
            结果[渠道.名称] = False
    return 结果
