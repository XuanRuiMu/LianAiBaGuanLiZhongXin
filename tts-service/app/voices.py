"""免费音色目录：Edge TTS 中文音色精选 + 旧别名兼容。"""

from __future__ import annotations

音色目录: list[dict] = [
    {"编号": "zh-CN-XiaoxiaoNeural", "性别": "女", "人设": "少女甜美", "场景": "恋爱陪伴主力", "年龄段": "青年"},
    {"编号": "zh-CN-XiaoyiNeural", "性别": "女", "人设": "萝莉活泼", "场景": "可爱撒娇", "年龄段": "少女"},
    {"编号": "zh-CN-XiaomengNeural", "性别": "女", "人设": "少女可爱", "场景": "日常问候", "年龄段": "少女"},
    {"编号": "zh-CN-XiaochenNeural", "性别": "女", "人设": "御姐成熟", "场景": "知性安慰", "年龄段": "成年"},
    {"编号": "zh-CN-XiaomoNeural", "性别": "女", "人设": "御姐冷艳", "场景": "高冷角色", "年龄段": "成年"},
    {"编号": "zh-CN-XiaohanNeural", "性别": "女", "人设": "温柔知性", "场景": "睡前哄睡", "年龄段": "青年"},
    {"编号": "zh-CN-XiaoruiNeural", "性别": "女", "人设": "活泼运动", "场景": "元气互动", "年龄段": "青年"},
    {"编号": "zh-CN-XiaoshuangNeural", "性别": "女", "人设": "爽朗大方", "场景": "开朗角色", "年龄段": "青年"},
    {"编号": "zh-CN-YunjianNeural", "性别": "男", "人设": "少年阳光", "场景": "校园恋爱", "年龄段": "少年"},
    {"编号": "zh-CN-YunxiNeural", "性别": "男", "人设": "少年活泼", "场景": "弟弟系角色", "年龄段": "少年"},
    {"编号": "zh-CN-YunxiaNeural", "性别": "男", "人设": "青年磁性", "场景": "通用男主", "年龄段": "青年"},
    {"编号": "zh-CN-YunyangNeural", "性别": "男", "人设": "深情低沉", "场景": "霸总深情", "年龄段": "成年"},
    {"编号": "zh-CN-YunyeNeural", "性别": "男", "人设": "沉稳大叔", "场景": "成熟守护", "年龄段": "中年"},
    {"编号": "zh-CN-XiaoyanNeural", "性别": "女", "人设": "知性新闻腔", "场景": "播报通知", "年龄段": "成年"},
]

旧别名映射: dict[str, str] = {
    "female-shaonv": "zh-CN-XiaoxiaoNeural",
    "female-loli": "zh-CN-XiaoyiNeural",
    "female-chengshu": "zh-CN-XiaochenNeural",
    "female-yujie": "zh-CN-XiaomoNeural",
    "female-wenrou": "zh-CN-XiaohanNeural",
    "male-qn-qingse": "zh-CN-YunjianNeural",
    "male-qn-chenqing": "zh-CN-YunyangNeural",
    "male-shenchen": "zh-CN-YunyeNeural",
}

可用音色集合 = {v["编号"] for v in 音色目录} | set(旧别名映射) | set(旧别名映射.values())


def 归一化音色(音色名: str | None, 默认音色: str) -> str:
    if not 音色名 or not 音色名.strip():
        return 默认音色
    v = 音色名.strip()
    if v in 旧别名映射:
        return 旧别名映射[v]
    return v


def 是否已知音色(音色名: str) -> bool:
    return 音色名 in 可用音色集合
