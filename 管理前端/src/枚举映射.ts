import { 审核状态族 } from './枚举映射/审核状态';
import { 审计事件族 } from './枚举映射/审计事件';
import { 审计分类族 } from './枚举映射/审计分类';
import { 封禁级别族 } from './枚举映射/封禁级别';
import { 申诉状态族 } from './枚举映射/申诉状态';
import { 优先级族 } from './枚举映射/优先级';
import { 关系阶段族 } from './枚举映射/关系阶段';
import { 发送方族 } from './枚举映射/发送方';
import { 审验结论族 } from './枚举映射/审验结论';
import { 思考事件族 } from './枚举映射/思考事件';
import { 模型类型族 } from './枚举映射/模型类型';
import { 消息类型族 } from './枚举映射/消息类型';
import { 严重程度族 } from './枚举映射/严重程度';
import { 管理角色族 } from './枚举映射/管理角色';
import { 取族文案, 取族色调, type 枚举选项, type 族定义, type 徽标色调 } from './枚举映射/基础';

export type { 徽标色调, 枚举选项 };
export * from './枚举映射/管理角色';
export * from './枚举映射/封禁级别';
export * from './枚举映射/申诉状态';
export * from './枚举映射/严重程度';
export * from './枚举映射/审核状态';
export * from './枚举映射/优先级';
export * from './枚举映射/审验结论';
export * from './枚举映射/审计事件';
export * from './枚举映射/审计分类';
export * from './枚举映射/发送方';
export * from './枚举映射/消息类型';
export * from './枚举映射/关系阶段';
export * from './枚举映射/思考事件';
export * from './枚举映射/模型类型';

export type 徽标族 =
  | '管理角色'
  | '封禁级别'
  | '申诉状态'
  | '审核状态'
  | '优先级'
  | '审验结论'
  | '审计事件'
  | '审计分类'
  | '发送方'
  | '消息类型'
  | '思考事件'
  | '严重程度'
  | '模型类型'
  | '关系阶段';

const 族登记: Record<徽标族, 族定义> = {
  管理角色: 管理角色族,
  封禁级别: 封禁级别族,
  申诉状态: 申诉状态族,
  审核状态: 审核状态族,
  优先级: 优先级族,
  审验结论: 审验结论族,
  审计事件: 审计事件族,
  审计分类: 审计分类族,
  发送方: 发送方族,
  消息类型: 消息类型族,
  思考事件: 思考事件族,
  严重程度: 严重程度族,
  模型类型: 模型类型族,
  关系阶段: 关系阶段族,
};

export function 取徽标文案(族: 徽标族, 原始: unknown): string {
  return 取族文案(族登记[族], 原始);
}

export function 取徽标色调(族: 徽标族, 原始: unknown): 徽标色调 {
  return 取族色调(族登记[族], 原始);
}
