import { describe, expect, it } from 'vitest'
import { 翻译 } from './zh-CN'

function 收集叶子值(节点: unknown): string[] {
  if (typeof 节点 === 'string') return [节点]
  if (typeof 节点 === 'function') return []
  if (节点 && typeof 节点 === 'object') {
    return Object.values(节点).flatMap((子) => 收集叶子值(子))
  }
  return []
}

describe('翻译文件完整性', () => {
  it('核心分组存在', () => {
    expect(翻译.产品名).toBeTruthy()
    expect(翻译.登录).toBeTruthy()
    expect(翻译.大屏).toBeTruthy()
    expect(翻译.助手).toBeTruthy()
    expect(翻译.运营).toBeTruthy()
    expect(翻译.通用).toBeTruthy()
  })

  it('页面关键文案键齐全', () => {
    expect(typeof 翻译.登录.提交按钮).toBe('string')
    expect(typeof 翻译.大屏.总用户).toBe('string')
    expect(typeof 翻译.助手.发送按钮).toBe('string')
    expect(typeof 翻译.通用.退出登录).toBe('string')
    expect(typeof 翻译.通用.重试).toBe('string')
    expect(typeof 翻译.通用.加载失败).toBe('string')
  })

  it('所有字符串叶值非空', () => {
    const 叶子列表 = 收集叶子值(翻译)
    expect(叶子列表.length).toBeGreaterThan(30)
    for (const 叶值 of 叶子列表) {
      expect(叶值.trim().length).toBeGreaterThan(0)
    }
  })

  it('趋势标题为可调用模板函数', () => {
    expect(typeof 翻译.大屏.注册趋势).toBe('function')
    expect(翻译.大屏.注册趋势(30)).toContain('30')
    expect(翻译.大屏.AI用量(30)).toContain('AI')
  })
})
