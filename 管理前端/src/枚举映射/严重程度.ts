import { 通用文案 } from '../文案/通用';
import { 封禁枚举文案 } from '../文案/封禁枚举';
import { 取选项, type 枚举选项, type 族定义 } from './基础';

export type 严重程度码 = '轻微' | '中等' | '严重';

export const 严重程度文案键表 = {
  轻微: 封禁枚举文案.严重程度轻微,
  中等: 封禁枚举文案.严重程度中等,
  严重: 封禁枚举文案.严重程度严重,
} as const satisfies Record<严重程度码, string>;

export const 严重程度族: 族定义 = {
  值域: 严重程度文案键表,
  空态名: 通用文案.未记录,
  底色: '危',
};

export const 严重程度选项: ReadonlyArray<枚举选项> = 取选项(
  Object.keys(严重程度文案键表) as readonly 严重程度码[],
  严重程度文案键表,
);

export const 严重程度默认: 严重程度码 = '中等';
