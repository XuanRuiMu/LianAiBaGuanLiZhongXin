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
  totalRoles: number
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
  persona: string
  count: number
}

export interface 挑战排行项 {
  rankNo: number
  userName: string
  score: number
  chatDays: number
}

export interface AI用量点 {
  date: string
  aiCount: number
  activeUsers: number
  total: number
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

export interface 运营类型状态 {
  类型: string
  运行次数: number
  成功次数: number
  失败次数: number
  成功率: number
  总行数: number
  平均耗时毫秒: number
  迟到: boolean
}

export interface 运营总览数据 {
  血缘: string[]
  类型状态: 运营类型状态[]
  质量告警: Record<string, unknown>[]
}

export type 对话角色 = 'user' | 'assistant'

export interface 对话历史项 {
  role: 对话角色
  content: string
}
