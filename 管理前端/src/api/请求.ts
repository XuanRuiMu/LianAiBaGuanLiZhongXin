import axios, { type AxiosInstance, type AxiosResponse } from 'axios';
import { 接口基地址 } from '../配置';
import { 清除令牌 } from '../stores/登录';
import { 通用文案 } from '../文案/通用';

export type 分页信息 = {
  ye_ma: number;
  mei_ye_tiao_shu: number;
  zong_shu: number;
};

export type 包络成功<数据类型> = {
  cheng_gong: true;
  shu_ju: 数据类型;
  fen_ye?: 分页信息;
};

export type 包络失败 = {
  cheng_gong: false;
  shu_ju: null;
  ti_shi: string;
  cuo_wu_ma: string;
};

export type 包络<数据类型> = 包络成功<数据类型> | 包络失败;

export type 解析结果<数据类型> = {
  数据: 数据类型;
  分页?: 分页信息;
};

export class 业务错误 extends Error {
  readonly cuo_wu_ma: string;

  constructor(提示: string, 错误码: string) {
    super(提示);
    this.name = 业务错误.name;
    this.cuo_wu_ma = 错误码;
  }
}

export type 错误展示 = {
  提示: string;
  错误码: string;
};

const 可见拉丁词元 = new Set(['IP', 'AI']);

function 是中文提示(文本: string): boolean {
  return [...文本.matchAll(/[A-Za-z][A-Za-z0-9_]*/g)].every((词元) => 可见拉丁词元.has(词元[0]));
}

function 记原始错误(来源: string, 原文: string, 状态码?: number): void {
  console.error(`[请求] ${来源}：${原文}`, 状态码 === undefined ? '' : `HTTP ${状态码}`);
}

function 错误原文(错误: unknown): string {
  if (错误 instanceof Error) {
    return 错误.message;
  }
  const 带消息 = 错误 as { message?: unknown } | null;
  return typeof 带消息?.message === 'string' ? 带消息.message : String(错误);
}

export function 取错误展示(错误: unknown): 错误展示 {
  const 错误码 = 错误 instanceof 业务错误 ? 错误.cuo_wu_ma : '';
  const 原文 = 错误 instanceof Error ? 错误.message : '';
  if (原文.length > 0 && 是中文提示(原文)) {
    return { 提示: 原文, 错误码 };
  }
  if (原文.length > 0) {
    记原始错误('非中文错误原文已改走标准提示', 原文);
  }
  return { 提示: 通用文案.请求失败, 错误码 };
}

function 是否失败包络(响应体: unknown): 响应体 is 包络失败 {
  return (
    typeof 响应体 === 'object' &&
    响应体 !== null &&
    (响应体 as Record<string, unknown>).cheng_gong === false
  );
}

function 是否成功包络<数据类型>(响应体: unknown): 响应体 is 包络成功<数据类型> {
  return (
    typeof 响应体 === 'object' &&
    响应体 !== null &&
    (响应体 as Record<string, unknown>).cheng_gong === true &&
    'shu_ju' in 响应体
  );
}

export function 解析包络<数据类型>(响应体: unknown): 解析结果<数据类型> {
  if (是否失败包络(响应体)) {
    throw new 业务错误(响应体.ti_shi || 通用文案.请求失败, 响应体.cuo_wu_ma || '');
  }
  if (是否成功包络<数据类型>(响应体)) {
    return { 数据: 响应体.shu_ju, 分页: 响应体.fen_ye };
  }
  记原始错误('响应体不是包络结构', typeof 响应体 === 'object' ? JSON.stringify(响应体).slice(0, 200) : String(响应体));
  throw new 业务错误(通用文案.请求失败, '');
}

export function 取鉴权头(令牌: string | null): Record<string, string> {
  if (令牌 === null || 令牌.length === 0) {
    return {};
  }
  return { Authorization: `Bearer ${令牌}` };
}

export const 请求实例: AxiosInstance = axios.create({
  baseURL: 接口基地址,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

declare module 'axios' {
  interface AxiosRequestConfig {
    /** 续期与注销自身的 401 由调用方处置，不得触发「清令牌并跳登录」的全局兜底 */
    buTuiDengLu?: boolean;
  }
}

请求实例.interceptors.request.use((配置) => {
  try {
    const 请求编号 = `qian-duan-${Date.now().toString(36)}-${Math.floor(Math.random() * 46656).toString(36)}`;
    配置.headers.set('X-Request-Id', 请求编号);
    配置.headers.set('X-Trace-Id', 请求编号);
  } catch {
    return 配置;
  }
  return 配置;
});

const 凭证失效码: readonly string[] = ['WEI_SHOU_QUAN', 'LING_PAI_WU_XIAO'];

/** 服务端已否定本次凭证：只有这一类失败才允许清本地会话，429 与网络抖动都不算 */
export function 是凭证失效错误(错误: unknown): boolean {
  return 错误 instanceof 业务错误 && 凭证失效码.includes(错误.cuo_wu_ma);
}

export function 归一请求错误(错误: unknown): 业务错误 {
  const 原文 = 错误原文(错误);
  if (axios.isAxiosError(错误) && 错误.response) {
    const 状态码 = 错误.response.status;
    const 响应体 = 错误.response.data as Partial<包络失败> | undefined;
    if (状态码 === 401 && 错误.config?.buTuiDengLu !== true) {
      清除令牌();
      if (typeof window !== 'undefined' && window.location.pathname !== '/deng-lu') {
        window.location.assign('/deng-lu');
      }
    }
    if (响应体 !== undefined && 响应体.cheng_gong === false) {
      return new 业务错误(响应体.ti_shi ?? 通用文案.请求失败, 响应体.cuo_wu_ma ?? '');
    }
    记原始错误('HTTP 层无失败包络', 原文, 状态码);
    return new 业务错误(状态码 === 401 ? 通用文案.登录过期 : 通用文案.请求失败, '');
  }
  记原始错误('请求未到达服务端', 原文);
  return new 业务错误(通用文案.请求失败, '');
}

请求实例.interceptors.response.use(
  (响应: AxiosResponse) => {
    if (是否失败包络(响应.data)) {
      return Promise.reject(
        new 业务错误(响应.data.ti_shi || 通用文案.请求失败, 响应.data.cuo_wu_ma || ''),
      );
    }
    return 响应;
  },
  (错误: unknown) => Promise.reject(归一请求错误(错误)),
);
