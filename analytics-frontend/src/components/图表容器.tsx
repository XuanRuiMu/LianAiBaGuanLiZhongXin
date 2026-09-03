import { useEffect, useRef } from 'react'
import { init, use as 注册模块 } from 'echarts/core'
import { BarChart, LineChart, PieChart } from 'echarts/charts'
import {
  GridComponent,
  LegendComponent,
  TooltipComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { EChartsCoreOption } from 'echarts/core'
import { 注册暗色主题, 主题名 } from '../theme/theme'

注册模块([
  BarChart,
  LineChart,
  PieChart,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  CanvasRenderer,
])

interface 图表容器属性 {
  选项: EChartsCoreOption
}

export function 图表容器({ 选项 }: 图表容器属性) {
  const 容器引用 = useRef<HTMLDivElement>(null)
  const 实例引用 = useRef<ReturnType<typeof init> | null>(null)

  useEffect(() => {
    if (!容器引用.current) return
    注册暗色主题()
    const 实例 = init(容器引用.current, 主题名)
    实例引用.current = 实例
    const 触发重绘 = () => 实例.resize()
    window.addEventListener('resize', 触发重绘)
    const 观察器 = new ResizeObserver(触发重绘)
    观察器.observe(容器引用.current)
    return () => {
      window.removeEventListener('resize', 触发重绘)
      观察器.disconnect()
      实例.dispose()
      实例引用.current = null
    }
  }, [])

  useEffect(() => {
    实例引用.current?.setOption(选项, true)
  }, [选项])

  return <div ref={容器引用} className="h-full w-full min-h-0" />
}
