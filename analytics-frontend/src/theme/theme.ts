import * as echarts from 'echarts/core'

export const 配色 = {
  主蓝: '#38bdf8',
  次紫: '#a78bfa',
  翠绿: '#34d399',
  玫粉: '#f472b6',
  琥珀: '#fbbf24',
  青碧: '#2dd4bf',
  橙红: '#fb7185',
  文字主: '#e2e8f0',
  文字次: '#94a3b8',
  轴线: 'rgba(148,163,184,0.35)',
  分割线: 'rgba(148,163,184,0.12)',
  提示框背景: 'rgba(13,20,36,0.92)',
  面积蓝起: 'rgba(56,189,248,0.35)',
  面积蓝止: 'rgba(56,189,248,0.02)',
  面积紫起: 'rgba(167,139,250,0.35)',
  面积紫止: 'rgba(167,139,250,0.02)',
  面积绿起: 'rgba(52,211,153,0.30)',
  面积绿止: 'rgba(52,211,153,0.02)',
}

export const 主题名 = '暗色科技风'

export function 注册暗色主题(): void {
  echarts.registerTheme(主题名, {
    backgroundColor: 'transparent',
    textStyle: { color: 配色.文字主 },
    color: [配色.主蓝, 配色.次紫, 配色.翠绿, 配色.玫粉, 配色.琥珀, 配色.青碧, 配色.橙红],
    legend: {
      textStyle: { color: 配色.文字次 },
      pageTextStyle: { color: 配色.文字次 },
      pageIconColor: 配色.主蓝,
      pageIconInactiveColor: 配色.轴线,
    },
    tooltip: {
      backgroundColor: 配色.提示框背景,
      borderColor: 配色.轴线,
      textStyle: { color: 配色.文字主 },
    },
    categoryAxis: {
      axisLine: { lineStyle: { color: 配色.轴线 } },
      axisTick: { show: false },
      axisLabel: { color: 配色.文字次 },
      splitLine: { show: false },
    },
    valueAxis: {
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: 配色.文字次 },
      splitLine: { lineStyle: { color: 配色.分割线 } },
    },
  })
}
