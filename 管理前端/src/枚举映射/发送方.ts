import { 通用文案 } from '../文案/通用';
import { 聊天枚举文案 } from '../文案/聊天枚举';
import { 取选项, type 枚举选项, type 族定义 } from './基础';

export type 发送方码 = 'yonghu' | 'jiaose' | 'xitong';

export const 发送方文案键表 = {
  yonghu: 聊天枚举文案.发送方用户,
  jiaose: 聊天枚举文案.发送方角色,
  xitong: 聊天枚举文案.发送方系统,
} as const satisfies Record<发送方码, string>;

export const 发送方族: 族定义 = {
  值域: 发送方文案键表,
  空态名: 通用文案.未记录,
};

export const 发送方选项: ReadonlyArray<枚举选项> = 取选项(
  Object.keys(发送方文案键表) as readonly 发送方码[],
  发送方文案键表,
);

export function 取发送方码(值: unknown): 发送方码 | null {
  if (typeof 值 !== 'string' || !Object.prototype.hasOwnProperty.call(发送方文案键表, 值)) {
    return null;
  }
  return 值 as 发送方码;
}
