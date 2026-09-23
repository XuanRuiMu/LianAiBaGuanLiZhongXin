import { 通用文案 } from '../文案/通用';
import { 账号枚举文案 } from '../文案/账号枚举';
import type { 族定义 } from './基础';

export type 性别用户形态码 = 'male' | 'female';

export const 性别文案键表 = {
  male: 账号枚举文案.性别男,
  female: 账号枚举文案.性别女,
} as const satisfies Record<性别用户形态码, string>;

export const 性别族: 族定义 = {
  值域: 性别文案键表,
  空态名: 通用文案.未记录,
};
