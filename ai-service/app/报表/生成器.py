import io
import os

from openpyxl import Workbook
from openpyxl.styles import Font
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib import colors

import app.texts as texts

_中文字体名 = "Helvetica"

for _候选 in (
    r"C:\Windows\Fonts\msyh.ttc",
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
):
    if os.path.exists(_候选):
        try:
            pdfmetrics.registerFont(TTFont("报表中文", _候选, subfontIndex=0))
            _中文字体名 = "报表中文"
        except Exception:
            _中文字体名 = "Helvetica"
        break


def 生成Excel(概览: dict, 趋势: list[dict]) -> bytes:
    簿 = Workbook()
    页 = 簿.active
    页.title = "运营日报"
    页.append([texts.报表_标题])
    页["A1"].font = Font(bold=True, size=14)
    页.append([])
    页.append(texts.报表_概览表头)
    for 键, 值 in 概览.items():
        页.append([键, 值])
    页.append([])
    页.append(texts.报表_趋势表头)
    for 点 in 趋势:
        页.append([点.get("date"), 点.get("newUsers"), 点.get("totalUsers")])
    for 列 in ("A", "B", "C"):
        页.column_dimensions[列].width = 22
    缓冲 = io.BytesIO()
    簿.save(缓冲)
    return 缓冲.getvalue()


def 生成PDF(概览: dict, 趋势: list[dict]) -> bytes:
    缓冲 = io.BytesIO()
    文档 = SimpleDocTemplate(缓冲, pagesize=A4)
    样式 = getSampleStyleSheet()
    标题样式 = 样式["Title"]
    标题样式.fontName = _中文字体名
    正文样式 = 样式["Normal"]
    正文样式.fontName = _中文字体名
    元素 = [Paragraph(texts.报表_标题, 标题样式), Spacer(1, 12)]
    概览数据 = [["指标", "数值"]] + [[str(键), str(值)] for 键, 值 in 概览.items()]
    趋势数据 = [["日期", "新增用户", "累计用户"]] + [
        [str(点.get("date")), str(点.get("newUsers")), str(点.get("totalUsers"))] for 点 in 趋势
    ]
    表格样式 = TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), _中文字体名),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1f2937")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
    ])
    for 表格数据 in (概览数据, 趋势数据):
        表格 = Table(表格数据, repeatRows=1)
        表格.setStyle(表格样式)
        元素 += [表格, Spacer(1, 12)]
    文档.build(元素)
    return 缓冲.getvalue()
