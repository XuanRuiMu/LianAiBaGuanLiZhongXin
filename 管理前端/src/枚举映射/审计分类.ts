import { 通用文案 } from '../文案/通用';
import { 审计枚举文案 } from '../文案/审计枚举';
import { 取选项, type 枚举选项, type 族定义 } from './基础';

export type 审计分类码 = 'guan_li';

export const 审计分类文案键表 = {
  guan_li: 审计枚举文案.分类管理,
} as const satisfies Record<审计分类码, string>;

export const 审计分类族: 族定义 = {
  值域: 审计分类文案键表,
  空态名: 通用文案.未记录,
};

export const 审计分类选项: ReadonlyArray<枚举选项> = 取选项(
  Object.keys(审计分类文案键表) as readonly 审计分类码[],
  审计分类文案键表,
);
