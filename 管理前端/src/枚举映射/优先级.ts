import { 通用文案 } from '../文案/通用';
import { 审核枚举文案 } from '../文案/审核枚举';
import type { 族定义 } from './基础';

export type 优先级码 = 'di' | 'zhong' | 'gao' | 'jin_ji';

export const 优先级文案键表 = {
  di: 审核枚举文案.优先级低,
  zhong: 审核枚举文案.优先级中,
  gao: 审核枚举文案.优先级高,
  jin_ji: 审核枚举文案.优先级紧急,
} as const satisfies Record<优先级码, string>;

export const 优先级族: 族定义 = {
  值域: 优先级文案键表,
  空态名: 通用文案.未记录,
};
