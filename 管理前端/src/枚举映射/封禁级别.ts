import { 封禁枚举文案 } from '../文案/封禁枚举';
import { 取选项, 取族文案, type 枚举选项, type 族定义, type 徽标色调 } from './基础';

export type 封禁级别码 = 'zheng_chang' | 'feng_jin_1_fen' | 'feng_jin_1_tian' | 'yong_feng';
export type 写入封禁级别码 = Exclude<封禁级别码, 'zheng_chang'>;

export const 封禁级别文案键表 = {
  zheng_chang: 封禁枚举文案.级别正常,
  feng_jin_1_fen: 封禁枚举文案.级别1分钟,
  feng_jin_1_tian: 封禁枚举文案.级别1天,
  yong_feng: 封禁枚举文案.级别永久,
} as const satisfies Record<封禁级别码, string>;

const 色调表: Record<封禁级别码, 徽标色调> = {
  zheng_chang: '安',
  feng_jin_1_fen: '危',
  feng_jin_1_tian: '危',
  yong_feng: '危',
};

export const 封禁级别族: 族定义 = {
  值域: 封禁级别文案键表,
  空态名: 封禁枚举文案.级别正常,
  色调表,
  底色: '安',
};

export const 取封禁级别文案 = (级别: unknown): string => 取族文案(封禁级别族, 级别);

export function 是正常封禁级别(级别: unknown): boolean {
  return 取封禁级别文案(级别) === 封禁枚举文案.级别正常;
}

export const 封禁级别选项: ReadonlyArray<枚举选项> = 取选项(
  Object.keys(封禁级别文案键表).filter((码) => 码 !== 'zheng_chang') as readonly 写入封禁级别码[],
  封禁级别文案键表,
);

export const 封禁级别默认: 写入封禁级别码 = 'feng_jin_1_tian';
