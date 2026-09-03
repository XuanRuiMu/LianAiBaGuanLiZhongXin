import { describe, expect, it } from 'vitest'
import { 创建SSE解析器 } from './sse-parser'

describe('SSE解析器', () => {
  it('解析单个完整 token 事件', () => {
    const 解析器 = 创建SSE解析器()
    const 事件 = 解析器.接收('data: {"type":"token","content":"你好"}\n\n')
    expect(事件).toEqual([{ 类型: 'token', 内容: '你好' }])
  })

  it('单 chunk 内多帧 data 全部解析', () => {
    const 解析器 = 创建SSE解析器()
    const 原文 =
      'data: {"type":"token","content":"第一"}\n\ndata: {"type":"token","content":"第二"}\n\ndata: {"type":"done"}\n\n'
    const 事件 = 解析器.接收(原文)
    expect(事件).toHaveLength(3)
    expect(事件[0]).toEqual({ 类型: 'token', 内容: '第一' })
    expect(事件[1]).toEqual({ 类型: 'token', 内容: '第二' })
    expect(事件[2]).toEqual({ 类型: 'done', 内容: '' })
  })

  it('跨 chunk 断句重组后正确解析', () => {
    const 解析器 = 创建SSE解析器()
    const 前半 = 'data: {"typ'
    const 后半 = 'e":"tool_end","content":"查询了用户数据"}\n\n'
    expect(解析器.接收(前半)).toEqual([])
    const 事件 = 解析器.接收(后半)
    expect(事件).toEqual([{ 类型: 'tool_end', 内容: '查询了用户数据' }])
  })

  it('忽略 event/id/注释等非 data 行', () => {
    const 解析器 = 创建SSE解析器()
    const 原文 = ': keep-alive\nid: 1\nevent: message\ndata: {"type":"error","content":"出错了"}\n\n'
    const 事件 = 解析器.接收(原文)
    expect(事件).toEqual([{ 类型: 'error', 内容: '出错了' }])
  })

  it('处理 [DONE] 结束标记', () => {
    const 解析器 = 创建SSE解析器()
    const 事件 = 解析器.接收('data: [DONE]\n\n')
    expect(事件).toEqual([{ 类型: 'done', 内容: '' }])
    expect(解析器.冲洗()).toEqual([])
  })

  it('忽略非法 JSON 行且不影响后续事件', () => {
    const 解析器 = 创建SSE解析器()
    const 原文 = 'data: {不是json}\n\ndata: {"type":"token","content":"正常"}\n\n'
    const 事件 = 解析器.接收(原文)
    expect(事件).toEqual([{ 类型: 'token', 内容: '正常' }])
  })

  it('冲洗处理无结尾换行的残留事件', () => {
    const 解析器 = 创建SSE解析器()
    expect(解析器.接收('data: {"type":"token","content":"结尾无空行"}')).toEqual([])
    const 残留 = 解析器.冲洗()
    expect(残留).toEqual([{ 类型: 'token', 内容: '结尾无空行' }])
    expect(解析器.冲洗()).toEqual([])
  })

  it('同一事件块内多行 data 按 SSE 规范拼接', () => {
    const 解析器 = 创建SSE解析器()
    const 原文 = 'data: {"type":"token",\ndata: "content":"跨行JSON"}\n\n'
    const 事件 = 解析器.接收(原文)
    expect(事件).toEqual([{ 类型: 'token', 内容: '跨行JSON' }])
  })
})
