import { 通用文案 } from '../文案/通用';
import { 聊天枚举文案 } from '../文案/聊天枚举';
import type { 族定义 } from './基础';

export type 消息类型码 = 'wenben' | 'tuPian' | 'biaoQingBao' | 'yuYin' | 'wenJian' | 'neiXinHuoDong';

export const 消息类型文案键表 = {
  wenben: 聊天枚举文案.消息类型文本,
  tuPian: 聊天枚举文案.消息类型图片,
  biaoQingBao: 聊天枚举文案.消息类型表情包,
  yuYin: 聊天枚举文案.消息类型语音,
  wenJian: 聊天枚举文案.消息类型文件,
  neiXinHuoDong: 聊天枚举文案.消息类型内心活动,
} as const satisfies Record<消息类型码, string>;

export const 消息类型族: 族定义 = {
  值域: 消息类型文案键表,
  空态名: 通用文案.未记录,
};
