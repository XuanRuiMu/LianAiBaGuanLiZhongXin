import { 深度思考, 构建过程, 隐藏信息, 好感度变化 } from '../术语/思考';

export type 思考枚举键清单 = {
  事件深度思考: string;
  事件构建过程: string;
  事件隐藏信息: string;
  事件好感度变化: string;
};

export const 思考枚举文案 = {
  事件深度思考: 深度思考,
  事件构建过程: 构建过程,
  事件隐藏信息: 隐藏信息,
  事件好感度变化: 好感度变化,
} as const satisfies 思考枚举键清单;
