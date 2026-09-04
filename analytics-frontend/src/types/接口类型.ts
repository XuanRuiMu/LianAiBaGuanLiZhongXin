export interface 通用响应<T> {
  code: number
  message: string
  data: T
}

export interface 登录数据 {
  token: string
  [字段: string]: unknown
}

export interface 概览数据 {
  totalUsers: number
  totalCharacters: number
  totalMessages: number
  newUsers24h: number
  newMessages24h: number
}

export interface 注册趋势点 {
  date: string
  newUsers: number
  totalUsers: number
}

export interface 消息趋势点 {
  date: string
  userCount: number
  aiCount: number
  total: number
}

export interface 阶段分布项 {
  stage: number | string
  label: string
  count: number
}

export interface 人设热度项 {
  personaTag: string
  userCount: number
}

export interface 挑战排行项 {
  rankNo: number
  userName: string
  score: number
  chatDays: number
}

export interface AI用量点 {
  date: string
  requestCount: number
  totalTokens: number
  activeUsers: number
}

export interface 留存趋势点 {
  date: string
  cohortSize: number
  day1Rate: number
  day3Rate: number
  day7Rate: number
}

export interface 同步日志项 {
  status: string
  rowsSynced: number
  createdAt: string
  errorMsg?: string | null
}

export interface 同步状态数据 {
  recentLogs: 同步日志项[]
  lastSyncTimes: Record<string, string>
}

export type 对话角色 = 'user' | 'assistant'

export interface 对话历史项 {
  role: 对话角色
  content: string
}
