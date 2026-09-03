export type SSE事件类型 = 'token' | 'tool_end' | 'done' | 'error'

export interface SSE事件 {
  类型: SSE事件类型
  内容: string
  工具名?: string
}

export interface SSE解析器 {
  接收(chunk: string): SSE事件[]
  冲洗(): SSE事件[]
}

const 合法类型: ReadonlySet<string> = new Set(['token', 'tool_end', 'done', 'error'])

function 处理事件块(块: string, 产出: SSE事件[]): void {
  const 数据行列表: string[] = []
  for (const 行 of 块.split('\n')) {
    if (行.startsWith('data:')) {
      数据行列表.push(行.slice(5).replace(/^ /, ''))
    }
  }
  if (数据行列表.length === 0) return
  const 载荷 = 数据行列表.join('\n')
  if (载荷.trim() === '[DONE]') {
    产出.push({ 类型: 'done', 内容: '' })
    return
  }
  try {
    const 解析结果: unknown = JSON.parse(载荷)
    if (
      解析结果 &&
      typeof 解析结果 === 'object' &&
      'type' in 解析结果 &&
      typeof (解析结果 as { type: unknown }).type === 'string'
    ) {
      const 对象 = 解析结果 as { type: string; content?: unknown; message?: unknown; name?: unknown }
      if (合法类型.has(对象.type)) {
        const 工具名 = typeof 对象.name === 'string' ? 对象.name : undefined
        let 内容 = ''
        if (typeof 对象.content === 'string') {
          内容 = 对象.content
        } else if (对象.type === 'error' && typeof 对象.message === 'string') {
          内容 = 对象.message
        }
        产出.push({ 类型: 对象.type as SSE事件类型, 内容, 工具名 })
      }
    }
  } catch {
    return
  }
}

export function 创建SSE解析器(): SSE解析器 {
  let 缓冲 = ''

  function 接收(chunk: string): SSE事件[] {
    缓冲 = (缓冲 + chunk).replace(/\r\n/g, '\n')
    const 产出: SSE事件[] = []
    let 边界 = 缓冲.indexOf('\n\n')
    while (边界 >= 0) {
      处理事件块(缓冲.slice(0, 边界), 产出)
      缓冲 = 缓冲.slice(边界 + 2)
      边界 = 缓冲.indexOf('\n\n')
    }
    return 产出
  }

  function 冲洗(): SSE事件[] {
    const 产出: SSE事件[] = []
    if (缓冲.trim().length > 0) {
      处理事件块(缓冲, 产出)
    }
    缓冲 = ''
    return 产出
  }

  return { 接收, 冲洗 }
}
