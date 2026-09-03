import type { EChartsCoreOption } from 'echarts/core'
import { 配色 } from '../theme/theme'
import { 翻译 } from '../i18n/zh-CN'
import type {
  AI用量点,
  人设热度项,
  消息趋势点,
  注册趋势点,
  阶段分布项,
} from '../types/接口类型'

const 系列名 = {
  新增用户: 翻译.大屏.新增用户,
  累计用户: 翻译.大屏.累计用户,
  用户消息: 翻译.大屏.用户消息,
  AI消息: 翻译.大屏.AI消息,
  请求次数: 翻译.大屏.请求次数,
  Token消耗: 翻译.大屏.Token消耗,
}

function 轴通用() {
  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'line', lineStyle: { color: 配色.轴线 } },
    },
    grid: { left: 8, right: 8, top: 36, bottom: 0, containLabel: true },
  }
}

export function 构建注册趋势选项(数据: 注册趋势点[]): EChartsCoreOption {
  return {
    ...轴通用(),
    legend: { data: [系列名.新增用户, 系列名.累计用户], top: 0, right: 0 },
    xAxis: { type: 'category', data: 数据.map((点) => 点.date) },
    yAxis: [
      { type: 'value', name: 系列名.新增用户 },
      { type: 'value', name: 系列名.累计用户 },
    ],
    series: [
      {
        name: 系列名.新增用户,
        type: 'line',
        smooth: true,
        showSymbol: false,
        data: 数据.map((点) => 点.newUsers),
        lineStyle: { width: 2, color: 配色.主蓝 },
        itemStyle: { color: 配色.主蓝 },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 配色.面积蓝起 },
              { offset: 1, color: 配色.面积蓝止 },
            ],
          },
        },
      },
      {
        name: 系列名.累计用户,
        type: 'line',
        smooth: true,
        showSymbol: false,
        yAxisIndex: 1,
        data: 数据.map((点) => 点.totalUsers),
        lineStyle: { width: 2, type: 'dashed', color: 配色.次紫 },
        itemStyle: { color: 配色.次紫 },
      },
    ],
  }
}

export function 构建消息趋势选项(数据: 消息趋势点[]): EChartsCoreOption {
  return {
    ...轴通用(),
    legend: { data: [系列名.用户消息, 系列名.AI消息], top: 0, right: 0 },
    xAxis: { type: 'category', data: 数据.map((点) => 点.date) },
    yAxis: { type: 'value' },
    series: [
      {
        name: 系列名.用户消息,
        type: 'line',
        stack: 'messages-stack',
        smooth: true,
        showSymbol: false,
        data: 数据.map((点) => 点.userCount),
        lineStyle: { width: 1, color: 配色.主蓝 },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 配色.面积蓝起 },
              { offset: 1, color: 配色.面积蓝止 },
            ],
          },
        },
      },
      {
        name: 系列名.AI消息,
        type: 'line',
        stack: 'messages-stack',
        smooth: true,
        showSymbol: false,
        data: 数据.map((点) => 点.aiCount),
        lineStyle: { width: 1, color: 配色.翠绿 },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 配色.面积绿起 },
              { offset: 1, color: 配色.面积绿止 },
            ],
          },
        },
      },
    ],
  }
}

export function 构建阶段分布选项(数据: 阶段分布项[]): EChartsCoreOption {
  return {
    tooltip: { trigger: 'item' },
    legend: { orient: 'vertical', right: 0, top: 'middle', icon: 'circle' },
    series: [
      {
        type: 'pie',
        radius: ['48%', '72%'],
        center: ['38%', '52%'],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: 'rgba(11,17,32,0.9)', borderWidth: 2 },
        label: { show: false },
        emphasis: {
          label: { show: true, formatter: '{b}\n{c}', color: 配色.文字主 },
        },
        data: 数据.map((项) => ({ name: 项.label, value: 项.count })),
      },
    ],
  }
}

export function 构建人设热度选项(数据: 人设热度项[]): EChartsCoreOption {
  const 排序后 = [...数据].sort((甲, 乙) => 乙.userCount - 甲.userCount)
  return {
    ...轴通用(),
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 8, right: 24, top: 8, bottom: 0, containLabel: true },
    xAxis: { type: 'value' },
    yAxis: {
      type: 'category',
      inverse: true,
      data: 排序后.map((项) => 项.personaTag),
      axisLabel: { color: 配色.文字主, width: 90, overflow: 'truncate' },
    },
    series: [
      {
        type: 'bar',
        barMaxWidth: 14,
        data: 排序后.map((项) => 项.userCount),
        itemStyle: {
          borderRadius: [0, 7, 7, 0],
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 1,
            y2: 0,
            colorStops: [
              { offset: 0, color: 配色.次紫 },
              { offset: 1, color: 配色.主蓝 },
            ],
          },
        },
        label: { show: true, position: 'right', color: 配色.文字次 },
      },
    ],
  }
}

export function 构建AI用量选项(数据: AI用量点[]): EChartsCoreOption {
  return {
    ...轴通用(),
    legend: { data: [系列名.请求次数, 系列名.Token消耗], top: 0, right: 0 },
    xAxis: { type: 'category', data: 数据.map((点) => 点.date) },
    yAxis: [
      { type: 'value', name: 系列名.请求次数 },
      { type: 'value', name: 系列名.Token消耗 },
    ],
    series: [
      {
        name: 系列名.请求次数,
        type: 'bar',
        barMaxWidth: 14,
        data: 数据.map((点) => 点.requestCount),
        itemStyle: {
          borderRadius: [4, 4, 0, 0],
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 配色.主蓝 },
              { offset: 1, color: 'rgba(56,189,248,0.15)' },
            ],
          },
        },
      },
      {
        name: 系列名.Token消耗,
        type: 'line',
        smooth: true,
        showSymbol: false,
        yAxisIndex: 1,
        data: 数据.map((点) => 点.totalTokens),
        lineStyle: { width: 2, color: 配色.琥珀 },
        itemStyle: { color: 配色.琥珀 },
      },
    ],
  }
}
