import type { Response } from 'express';

export interface 分页信息 {
  ye_ma: number;
  mei_ye_tiao_shu: number;
  zong_shu: number;
}

export function 成功响应(响应: Response, 数据: unknown, 分页?: 分页信息, 状态码 = 200): void {
  if (分页) {
    响应.status(状态码).json({ cheng_gong: true, shu_ju: 数据, fen_ye: 分页 });
  } else {
    响应.status(状态码).json({ cheng_gong: true, shu_ju: 数据 });
  }
}

export function 失败响应(响应: Response, 状态码: number, 提示: string, 代码: string): void {
  响应.status(状态码).json({ cheng_gong: false, shu_ju: null, ti_shi: 提示, cuo_wu_ma: 代码 });
}
