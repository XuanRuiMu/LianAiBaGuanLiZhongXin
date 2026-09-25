import type { Response } from 'express';
import { 取错误定义, type 错误码值 } from './错误码';
import { 取请求编号 } from './日志';

export interface 分页信息 {
  ye_ma: number;
  mei_ye_tiao_shu: number;
  zong_shu: number;
}

export interface 失败响应选项 {
  retryAfterMs?: number;
  fieldErrors?: Record<string, string>;
}

function 取追踪编号(响应: Response): string {
  const 当前 = 响应.getHeader('X-Trace-Id');
  if (typeof 当前 === 'string' && /^[A-Za-z0-9._:-]{1,64}$/.test(当前)) {
    return 当前;
  }
  const 请求编号 = 取请求编号({});
  响应.setHeader('X-Request-Id', 请求编号);
  响应.setHeader('X-Trace-Id', 请求编号);
  return 请求编号;
}

function 取字段错误(字段错误: Record<string, string> | undefined): Record<string, string> | undefined {
  if (字段错误 === undefined) {
    return undefined;
  }
  return Object.fromEntries(
    Object.entries(字段错误).filter(([, 值]) => typeof 值 === 'string' && 值.length > 0),
  );
}

export function 成功响应(响应: Response, 数据: unknown, 分页?: 分页信息, 状态码 = 200): void {
  if (分页) {
    响应.status(状态码).json({ cheng_gong: true, shu_ju: 数据, fen_ye: 分页 });
  } else {
    响应.status(状态码).json({ cheng_gong: true, shu_ju: 数据 });
  }
}

export function 失败响应(
  响应: Response,
  状态码: number,
  提示: string,
  代码: 错误码值,
  选项: 失败响应选项 = {},
): void {
  const 定义 = 取错误定义(代码);
  if (定义 === undefined) {
    throw new Error('失败响应收到未注册错误码');
  }
  if (定义.状态码 !== 状态码) {
    throw new Error('失败响应状态码与错误注册表不一致');
  }
  if (提示.length === 0) {
    throw new Error('失败响应消息不能为空');
  }
  const traceId = 取追踪编号(响应);
  const fieldErrors = 取字段错误(选项.fieldErrors);
  const 包络: Record<string, unknown> = {
    cheng_gong: false,
    shu_ju: null,
    ti_shi: 提示,
    cuo_wu_ma: 代码,
    code: 代码,
    message: 提示,
    traceId,
    retryable: 定义.可重试,
  };
  if (Number.isInteger(选项.retryAfterMs) && (选项.retryAfterMs ?? -1) >= 0) {
    包络['retryAfterMs'] = 选项.retryAfterMs;
  }
  if (fieldErrors !== undefined && Object.keys(fieldErrors).length > 0) {
    包络['fieldErrors'] = fieldErrors;
  }
  响应.status(状态码).json(包络);
}
