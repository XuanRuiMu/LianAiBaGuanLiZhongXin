import { 账号枚举文案 } from '../文案/账号枚举';
import { 取选项, 取族文案, 取族色调, type 枚举选项, type 族定义, type 徽标色调 } from './基础';

export type 管理角色码 = 'chao_guan' | 'yun_ying' | 'shen_he_yuan';

export const 管理角色文案键表 = {
  chao_guan: 账号枚举文案.角色超级管理员,
  yun_ying: 账号枚举文案.角色运营,
  shen_he_yuan: 账号枚举文案.角色审核员,
} as const satisfies Record<管理角色码, string>;

const 色调表: Record<管理角色码, 徽标色调> = { chao_guan: '警', yun_ying: '警', shen_he_yuan: '警' };

export const 管理角色族: 族定义 = {
  值域: 管理角色文案键表,
  空态名: 账号枚举文案.角色无,
  色调表,
};

export const 取管理角色文案 = (角色: unknown): string => 取族文案(管理角色族, 角色);

export const 取管理角色色调 = (角色: unknown): 徽标色调 => 取族色调(管理角色族, 角色);

export const 管理角色选项: ReadonlyArray<枚举选项> = 取选项(
  Object.keys(管理角色文案键表) as readonly 管理角色码[],
  管理角色文案键表,
);
