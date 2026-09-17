import axios, { type AxiosInstance, type AxiosResponse } from 'axios';
import { 接口基地址 } from '../配置';
import { 清除令牌 } from '../stores/登录';
import { 取文案 } from '../文案';

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
    this.name = '业务错误';
    this.cuo_wu_ma = 错误码;
  }
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
    throw new 业务错误(
      响应体.ti_shi || 取文案('通用', '请求失败'),
      响应体.cuo_wu_ma || 'WEI_ZHI_CUO_WU',
    );
  }
  if (是否成功包络<数据类型>(响应体)) {
    return { 数据: 响应体.shu_ju, 分页: 响应体.fen_ye };
  }
  throw new 业务错误(取文案('通用', '请求失败'), 'WEI_ZHI_CUO_WU');
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

请求实例.interceptors.response.use(
  (响应: AxiosResponse) => {
    if (是否失败包络(响应.data)) {
      return Promise.reject(
        new 业务错误(
          响应.data.ti_shi || 取文案('通用', '请求失败'),
          响应.data.cuo_wu_ma || 'WEI_ZHI_CUO_WU',
        ),
      );
    }
    return 响应;
  },
  (错误: unknown) => {
    if (axios.isAxiosError(错误) && 错误.response) {
      if (错误.response.status === 401) {
        清除令牌();
        if (typeof window !== 'undefined' && window.location.pathname !== '/deng-lu') {
          window.location.assign('/deng-lu');
        }
      }
      const 响应体 = 错误.response.data as Partial<包络失败> | undefined;
      if (响应体 !== undefined && 响应体.cheng_gong === false) {
        return Promise.reject(
          new 业务错误(
            响应体.ti_shi ?? 取文案('通用', '请求失败'),
            响应体.cuo_wu_ma ?? 'WEI_ZHI_CUO_WU',
          ),
        );
      }
    }
    return Promise.reject(错误);
  },
);
