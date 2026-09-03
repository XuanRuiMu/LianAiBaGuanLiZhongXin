import { 常量 } from '../常量'
import type { 登录数据 } from '../types/接口类型'
import { 提交 } from './http'

export async function 登录(用户名: string, 密码: string): Promise<登录数据> {
  return await 提交<登录数据>('/api/v1/auth/login', { username: 用户名, password: 密码 })
}

export function 保存令牌(令牌: string): void {
  localStorage.setItem(常量.本地存储键.令牌, 令牌)
}

export function 获取令牌(): string | null {
  return localStorage.getItem(常量.本地存储键.令牌)
}

export function 清除令牌(): void {
  localStorage.removeItem(常量.本地存储键.令牌)
}

export function 已登录(): boolean {
  return 获取令牌() !== null && 获取令牌() !== ''
}
