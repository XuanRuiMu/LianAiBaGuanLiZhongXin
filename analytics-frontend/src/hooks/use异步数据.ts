import { useCallback, useEffect, useState } from 'react'
import { 翻译 } from '../i18n/zh-CN'

export interface 异步数据状态<T> {
  数据: T | null
  加载中: boolean
  错误信息: string | null
  重试: () => void
}

function 提取错误消息(err: unknown): string {
  if (err instanceof Error && err.message) return err.message
  return 翻译.通用.网络错误
}

export function use异步数据<T>(获取函数: () => Promise<T>): 异步数据状态<T> {
  const [数据, 设置数据] = useState<T | null>(null)
  const [加载中, 设置加载中] = useState(true)
  const [错误信息, 设置错误信息] = useState<string | null>(null)

  const 执行 = useCallback(async () => {
    设置加载中(true)
    设置错误信息(null)
    try {
      const 结果 = await 获取函数()
      设置数据(结果)
    } catch (err) {
      设置错误信息(提取错误消息(err))
    } finally {
      设置加载中(false)
    }
  }, [获取函数])

  useEffect(() => {
    void 执行()
  }, [执行])

  return { 数据, 加载中, 错误信息, 重试: 执行 }
}
