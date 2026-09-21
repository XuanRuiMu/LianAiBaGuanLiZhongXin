import { 通用文案 } from './通用';
import { 导航文案 } from './导航';
import { 登录文案 } from './登录';
import { 账号文案 } from './账号';
import { 聊天文案 } from './聊天';
import { 思考文案 } from './思考';
import { 封禁文案 } from './封禁';
import { 审计文案 } from './审计';
import { 统计文案 } from './统计';
import { 审核文案 } from './审核';

export const 文案 = {
  通用: 通用文案,
  导航: 导航文案,
  登录: 登录文案,
  账号: 账号文案,
  聊天: 聊天文案,
  思考: 思考文案,
  封禁: 封禁文案,
  审计: 审计文案,
  统计: 统计文案,
  审核: 审核文案,
} as const;

export type 文案分类 = keyof typeof 文案;

export function 取文案<分类 extends 文案分类>(分类: 分类, 键: keyof (typeof 文案)[分类]): string {
  const 值 = 文案[分类][键];
  return typeof 值 === 'string' ? 值 : '';
}
