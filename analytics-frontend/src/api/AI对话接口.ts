import { 常量 } from '../常量'
import { 业务错误 } from './http'
import { 翻译 } from '../i18n/zh-CN'
import { 创建SSE解析器 } from '../utils/sse-parser'
import type { SSE事件 } from '../utils/sse-parser'
import type { 对话历史项 } from '../types/接口类型'

interface 流式对话参数 {
  question: string
  history: 对话历史项[]
}

export async function 流式对话(
  问题: string,
  历史: 对话历史项[],
  事件回调: (事件: SSE事件) => void,
): Promise<void> {
  const 请求体: 流式对话参数 = { question: 问题, history: 历史 }
  const 令牌 = localStorage.getItem(常量.本地存储键.令牌)
  const 响应 = await fetch(`${常量.AI基础地址}/api/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(令牌 ? { Authorization: `Bearer ${令牌}` } : {}),
    },
    body: JSON.stringify(请求体),
  })
  if (响应.status === 401) {
    throw new 业务错误(翻译.通用.未授权提示)
  }
  if (!响应.ok || !响应.body) {
    throw new 业务错误(`${翻译.通用.HTTP错误前缀}${响应.status})`)
  }
  const 解析器 = 创建SSE解析器()
  const 解码器 = new TextDecoder('utf-8')
  const 读取器 = 响应.body.getReader()
  for (;;) {
    const { done, value } = await 读取器.read()
    if (done) break
    for (const 事件 of 解析器.接收(解码器.decode(value, { stream: true }))) {
      事件回调(事件)
    }
  }
  for (const 事件 of 解析器.接收(解码器.decode())) {
    事件回调(事件)
  }
  for (const 事件 of 解析器.冲洗()) {
    事件回调(事件)
  }
}
