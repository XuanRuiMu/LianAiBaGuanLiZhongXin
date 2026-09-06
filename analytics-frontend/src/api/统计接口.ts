import { 常量 } from '../常量'
import type {
  AI用量点,
  人设热度项,
  同步状态数据,
  挑战排行项,
  消息趋势点,
  注册趋势点,
  概览数据,
  留存趋势点,
  运营总览数据,
  阶段分布项,
} from '../types/接口类型'
import { 获取 } from './http'

export function 获取概览(): Promise<概览数据> {
  return 获取<概览数据>('/api/v1/stats/overview')
}

export function 获取注册趋势(天数: number = 常量.统计天数): Promise<注册趋势点[]> {
  return 获取<注册趋势点[]>('/api/v1/stats/users/trend', { days: 天数 })
}

export function 获取消息趋势(天数: number = 常量.统计天数): Promise<消息趋势点[]> {
  return 获取<消息趋势点[]>('/api/v1/stats/messages/trend', { days: 天数 })
}

export function 获取阶段分布(): Promise<阶段分布项[]> {
  return 获取<阶段分布项[]>('/api/v1/stats/favorability/distribution')
}

export function 获取人设热度(): Promise<人设热度项[]> {
  return 获取<人设热度项[]>('/api/v1/stats/persona/ranking')
}

export function 获取AI用量(天数: number = 常量.统计天数): Promise<AI用量点[]> {
  return 获取<AI用量点[]>('/api/v1/stats/ai-usage/trend', { days: 天数 })
}

export function 获取挑战排行(): Promise<挑战排行项[]> {
  return 获取<挑战排行项[]>('/api/v1/stats/challenge/rank')
}

export function 获取留存趋势(天数: number = 常量.统计天数): Promise<留存趋势点[]> {
  return 获取<留存趋势点[]>('/api/v1/stats/retention', { days: 天数 })
}

export function 获取同步状态(): Promise<同步状态数据> {
  return 获取<同步状态数据>('/api/v1/sync/status')
}

export function 获取运营总览(): Promise<运营总览数据> {
  return 获取<运营总览数据>('/api/v1/ops/overview')
}
