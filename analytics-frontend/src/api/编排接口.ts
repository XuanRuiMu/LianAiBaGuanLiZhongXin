import { 常量 } from '../常量'
import { 获取令牌 } from './认证接口'

export interface 编排节点 {
  编号: string
  类型: string
  名称?: string
  参数?: Record<string, unknown>
  超时秒?: number
  最大重试?: number
  出错跳到?: string
  条件?: { 左: string; 算子: string; 右: unknown } | null
}

export interface 编排边 {
  从: string
  到: string
  分支?: string
}

export interface 编排流程 {
  名称: string
  版本?: number
  节点: 编排节点[]
  边: 编排边[]
}

function 头(): Record<string, string> {
  const 令牌 = 获取令牌()
  return 令牌 ? { Authorization: `Bearer ${令牌}` } : {}
}

async function 调用AI<T>(路径: string, 选项?: RequestInit): Promise<T> {
  const 响应 = await fetch(`${常量.AI基础地址}${路径}`, {
    ...选项,
    headers: { 'Content-Type': 'application/json', ...头(), ...(选项?.headers ?? {}) },
  })
  const 信封 = (await 响应.json()) as { code: number; data: T; message?: string }
  if (信封.code !== 200) throw new Error(信封.message ?? '请求失败')
  return 信封.data
}

async function 获取AI<T>(路径: string, 参数?: Record<string, unknown>): Promise<T> {
  const 查询 = 参数
    ? `?${new URLSearchParams(Object.entries(参数).map(([键, 值]) => [键, String(值)]))}`
    : ''
  return 调用AI<T>(`${路径}${查询}`)
}

async function 提交AI<T>(路径: string, 请求体?: unknown): Promise<T> {
  return 调用AI<T>(路径, { method: 'POST', body: JSON.stringify(请求体 ?? {}) })
}

export async function 获取节点类型(): Promise<unknown[]> {
  return 调用AI<unknown[]>('/api/v1/编排/节点类型')
}

export function 保存编排流程(定义: 编排流程): Promise<{ 名称: string; 版本: number }> {
  return 提交AI('/api/v1/编排/流程', { 定义 })
}

export function 读取编排流程(名称: string): Promise<编排流程> {
  return 获取AI<编排流程>('/api/v1/编排/流程', { 名称 })
}

export function 运行编排流程(名称: string, 输入: Record<string, unknown>): Promise<{
  执行号: string
  跟踪号: string
  状态: string
  上下文: Record<string, unknown>
  节点状态: Record<string, { 状态: string }>
}> {
  return 提交AI('/api/v1/编排/执行', { 名称, 输入 })
}

export function 审批编排(执行号: string, 批准: boolean): Promise<unknown> {
  return 提交AI('/api/v1/编排/审批', { 执行号, 批准 })
}

export function 查询回放(跟踪号: string): Promise<
  { 节点: string; 状态: string }[]
> {
  return 获取AI('/api/v1/编排/回放', { 跟踪号 })
}

export function 导出流程YAML(名称: string): Promise<{ yaml: string }> {
  return 获取AI('/api/v1/编排/流程YAML', { 名称 })
}

export function 导入流程YAML(文本: string): Promise<{ 名称: string; 版本: number }> {
  return 提交AI('/api/v1/编排/导入YAML', { 文本 })
}
