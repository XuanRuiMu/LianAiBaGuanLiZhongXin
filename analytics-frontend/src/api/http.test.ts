import { describe, expect, it } from 'vitest'
import { 解析响应信封 } from './http'
import { 翻译 } from '../i18n/zh-CN'

describe('解析响应信封（与后端统一响应口径一致）', () => {
  it('code 200 解包 data', () => {
    const 解析 = 解析响应信封<{ token: string }>({
      code: 200,
      message: '操作成功',
      data: { token: '甲' },
    })
    expect(解析).toEqual({ 成功: true, 数据: { token: '甲' } })
  })

  it('code 401 标记需重新登录', () => {
    const 解析 = 解析响应信封({ code: 401, message: '未登录', data: null })
    expect(解析).toEqual({ 成功: false, 错误: 翻译.通用.未授权提示, 需重新登录: true })
  })

  it('业务失败透出后端 message', () => {
    const 解析 = 解析响应信封({ code: 400, message: '参数不合法', data: null })
    expect(解析).toEqual({ 成功: false, 错误: '参数不合法', 需重新登录: false })
  })

  it('无 message 时用默认文案', () => {
    const 解析 = 解析响应信封({ code: 500, message: '', data: null })
    expect(解析).toEqual({ 成功: false, 错误: 翻译.通用.业务错误, 需重新登录: false })
  })

  it('非信封原样透传标记', () => {
    expect(解析响应信封(null)).toBeNull()
    expect(解析响应信封('纯文本')).toBeNull()
    expect(解析响应信封([1, 2])).toBeNull()
  })
})
