import { 通用文案 } from '../文案/通用';
import { 审核枚举文案 } from '../文案/审核枚举';
import type { 族定义 } from './基础';

export type 审验结论码 = 'wu' | 'tong_guo' | 'bo_hui';

export const 审验结论文案键表 = {
  wu: 审核枚举文案.结论无,
  tong_guo: 审核枚举文案.结论通过,
  bo_hui: 审核枚举文案.结论驳回,
} as const satisfies Record<审验结论码, string>;

export const 审验结论族: 族定义 = {
  值域: 审验结论文案键表,
  空态名: 通用文案.未记录,
};
