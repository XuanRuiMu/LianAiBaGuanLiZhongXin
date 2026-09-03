import { describe, expect, it } from 'vitest'
import { 格式化千分位, 格式化时间, 格式化万单位, 渲染气泡文本 } from './format'

describe('数字格式化', () => {
  it('千分位分组', () => {
    expect(格式化千分位(1234567)).toBe('1,234,567')
  })

  it('小数值原样输出', () => {
    expect(格式化千分位(999)).toBe('999')
  })

  it('非有限数返回占位符', () => {
    expect(格式化千分位(Number.NaN)).toBe('-')
    expect(格式化万单位(Number.POSITIVE_INFINITY)).toBe('-')
  })

  it('达到万级转换为万单位', () => {
    expect(格式化万单位(123456)).toBe('12.3万')
  })

  it('万单位整数去掉小数点', () => {
    expect(格式化万单位(10000)).toBe('1万')
  })

  it('负数保持符号', () => {
    expect(格式化千分位(-5000)).toBe('-5,000')
  })
})

describe('时间格式化', () => {
  it('ISO 文本转为 月-日 时:分', () => {
    expect(格式化时间('2026-08-01T09:05:00Z')).toMatch(/^\d{2}-\d{2} \d{2}:\d{2}$/)
  })

  it('非法文本原样返回', () => {
    expect(格式化时间('不是时间')).toBe('不是时间')
    expect(格式化时间('')).toBe('-')
  })
})

describe('气泡文本渲染', () => {
  it('HTML 特殊字符转义防注入', () => {
    expect(渲染气泡文本('<img src=x>')).toBe('&lt;img src=x&gt;')
  })

  it('加粗语法转为 strong 标签', () => {
    expect(渲染气泡文本('**重点**内容')).toBe('<strong>重点</strong>内容')
  })

  it('换行转为 br 标签', () => {
    expect(渲染气泡文本('第一行\n第二行')).toBe('第一行<br/>第二行')
  })
})
