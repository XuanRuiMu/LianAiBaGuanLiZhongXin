import axios from 'axios'
import { 常量 } from '../常量'
import { 翻译 } from '../i18n/zh-CN'

export class 业务错误 extends Error {}

export const http = axios.create({
  baseURL: 常量.API基础地址,
  timeout: 常量.请求超时毫秒,
})

http.interceptors.request.use((配置) => {
  const 令牌 = localStorage.getItem(常量.本地存储键.令牌)
  if (令牌) 配置.headers.Authorization = `Bearer ${令牌}`
  return 配置
})

function 清令牌并跳登录(): void {
  localStorage.removeItem(常量.本地存储键.令牌)
  if (window.location.pathname !== '/login') {
    window.location.assign('/login')
  }
}

interface 响应信封 {
  code: number
  message: string
}

http.interceptors.response.use(
  (响应) => {
    const 信封 = 响应.data as 响应信封 | undefined
    if (信封 && typeof 信封 === 'object' && 'code' in 信封) {
      if (信封.code === 0) return 信封 as never
      if (信封.code === 401) {
        清令牌并跳登录()
        return Promise.reject(new 业务错误(翻译.通用.未授权提示))
      }
      return Promise.reject(new 业务错误(信封.message || 翻译.通用.业务错误))
    }
    return 响应.data as never
  },
  (错误: unknown) => {
    const axios错误 = 错误 as { response?: { status?: number } } | undefined
    const 状态码 = axios错误?.response?.status
    if (状态码 === 401) {
      清令牌并跳登录()
      return Promise.reject(new 业务错误(翻译.通用.未授权提示))
    }
    const 消息 = 状态码 ? `${翻译.通用.HTTP错误前缀}${状态码})` : 翻译.通用.网络错误
    return Promise.reject(new 业务错误(消息))
  },
)

export async function 获取<T>(路径: string, 参数?: Record<string, unknown>): Promise<T> {
  return (await http.get(路径, { params: 参数 })) as T
}

export async function 提交<T>(路径: string, 请求体?: unknown): Promise<T> {
  return (await http.post(路径, 请求体)) as T
}
