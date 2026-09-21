import { 封禁枚举文案 } from '../文案/封禁枚举';
import { 取族文案, type 族定义, type 徽标色调 } from './基础';

export type 申诉状态码 = 'wu' | 'shen_su_zhong' | 'bo_hui' | 'yi_jie_chu';

export const 申诉状态文案键表 = {
  wu: 封禁枚举文案.申诉无,
  shen_su_zhong: 封禁枚举文案.申诉中,
  bo_hui: 封禁枚举文案.申诉已驳回,
  yi_jie_chu: 封禁枚举文案.申诉已解除,
} as const satisfies Record<申诉状态码, string>;

const 色调表: Record<申诉状态码, 徽标色调> = { wu: '安', shen_su_zhong: '警', bo_hui: '墨', yi_jie_chu: '安' };

export const 申诉状态族: 族定义 = {
  值域: 申诉状态文案键表,
  空态名: 封禁枚举文案.申诉无,
  色调表,
  底色: '安',
};

export const 取申诉状态文案 = (状态: unknown): string => 取族文案(申诉状态族, 状态);
