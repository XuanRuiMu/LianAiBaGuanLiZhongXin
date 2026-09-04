import { describe, expect, it } from 'vitest'
import type { 留存趋势点, 注册趋势点 } from '../types/接口类型'
import { 构建注册趋势选项, 构建留存趋势选项 } from './图表选项'

const 留存样例: 留存趋势点[] = [
  { date: '2026-08-28', cohortSize: 20, day1Rate: 55.5, day3Rate: 30.0, day7Rate: 15.0 },
  { date: '2026-08-29', cohortSize: 12, day1Rate: 41.67, day3Rate: 25.0, day7Rate: 0 },
]

describe('留存趋势图表组装', () => {
  it('三条留存曲线齐全且数据对齐日期轴', () => {
    const 选项 = 构建留存趋势选项(留存样例) as unknown as {
      legend: { data: string[] }
      xAxis: { data: string[] }
      yAxis: { max: number }
      series: { name: string; data: number[] }[]
    }
    expect(选项.legend.data).toHaveLength(3)
    expect(选项.xAxis.data).toEqual(['2026-08-28', '2026-08-29'])
    expect(选项.yAxis.max).toBe(100)
    expect(选项.series).toHaveLength(3)
    expect(选项.series[0].data).toEqual([55.5, 41.67])
    expect(选项.series[1].data).toEqual([30.0, 25.0])
    expect(选项.series[2].data).toEqual([15.0, 0])
  })

  it('空数据不崩溃', () => {
    const 选项 = 构建留存趋势选项([]) as unknown as { series: { data: number[] }[] }
    expect(选项.series).toHaveLength(3)
    expect(选项.series[0].data).toEqual([])
  })
})

describe('注册趋势图表回归', () => {
  it('双轴双系列保持不变', () => {
    const 数据: 注册趋势点[] = [{ date: '2026-08-29', newUsers: 5, totalUsers: 120 }]
    const 选项 = 构建注册趋势选项(数据) as unknown as { series: { data: number[] }[] }
    expect(选项.series).toHaveLength(2)
    expect(选项.series[0].data).toEqual([5])
    expect(选项.series[1].data).toEqual([120])
  })
})
