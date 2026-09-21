import { 接口基地址, 请求超时毫秒 } from '../配置';
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

export type 查询值 =
  | string
  | number
  | boolean
  | undefined
  | ReadonlyArray<string | number | boolean | undefined>;

export type 请求配置 = {
  params?: Record<string, 查询值>;
  /** 续期与注销自身的 401 由调用方处置，不得触发「清令牌并跳登录」的全局兜底 */
  buTuiDengLu?: boolean;
};

export type 响应包装 = {
  data: unknown;
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

/** 传输层失败的唯一形态：状态码为 null 即「请求未到达服务端」（网络抖动、超时到点、读体中断），带状态码的失败（含 429）才走包络与状态码分流 */
export class 传输错误 extends Error {
  readonly 状态码: number | null;
  readonly 响应体: unknown;
  readonly buTuiDengLu: boolean;

  constructor(原文: string, 状态码: number | null, 响应体: unknown, buTuiDengLu: boolean) {
    super(原文);
    this.name = 传输错误.name;
    this.状态码 = 状态码;
    this.响应体 = 响应体;
    this.buTuiDengLu = buTuiDengLu;
  }
}

const 凭证失效码: readonly string[] = ['WEI_SHOU_QUAN', 'LING_PAI_WU_XIAO'];

/** 服务端已否定本次凭证：只有这一类失败才允许清本地会话，429 与网络抖动都不算 */
export function 是凭证失效错误(错误: unknown): boolean {
  return 错误 instanceof 业务错误 && 凭证失效码.includes(错误.cuo_wu_ma);
}

export function 归一请求错误(错误: unknown): 业务错误 {
  const 原文 = 错误原文(错误);
  if (错误 instanceof 传输错误 && 错误.状态码 !== null) {
    const 状态码 = 错误.状态码;
    if (状态码 === 401 && 错误.buTuiDengLu !== true) {
      清除令牌();
      if (typeof window !== 'undefined' && window.location.pathname !== '/deng-lu') {
        window.location.assign('/deng-lu');
      }
    }
    const 响应体 = 错误.响应体 as Partial<包络失败> | null | undefined;
    if (响应体 !== undefined && 响应体 !== null && 响应体.cheng_gong === false) {
      return new 业务错误(响应体.ti_shi ?? 通用文案.请求失败, 响应体.cuo_wu_ma ?? '');
    }
    记原始错误('HTTP 层无失败包络', 原文, 状态码);
    return new 业务错误(状态码 === 401 ? 通用文案.登录过期 : 通用文案.请求失败, '');
  }
  记原始错误('请求未到达服务端', 原文);
  return new 业务错误(通用文案.请求失败, '');
}

function 编码线路值(值: string): string {
  return encodeURIComponent(值)
    .replace(/%3A/gi, ':')
    .replace(/%24/g, '$')
    .replace(/%2C/gi, ',')
    .replace(/%20/g, '+');
}

function 拼查询串(路径: string, 参数: Record<string, 查询值> | undefined): string {
  const 片段: string[] = [];
  for (const [键, 原始值] of Object.entries(参数 ?? {})) {
    if (Array.isArray(原始值)) {
      for (const 项 of 原始值) {
        if (项 !== undefined && 项 !== null && 项 !== '') {
          片段.push(`${编码线路值(`${键}[]`)}=${编码线路值(String(项))}`);
        }
      }
      continue;
    }
    if (原始值 === undefined || 原始值 === null || 原始值 === '') {
      continue;
    }
    片段.push(`${编码线路值(键)}=${编码线路值(String(原始值))}`);
  }
  if (片段.length === 0) {
    return 路径;
  }
  return `${路径}${路径.includes('?') ? '&' : '?'}${片段.join('&')}`;
}

function 取完整地址(路径: string, 参数: Record<string, 查询值> | undefined): string {
  const 查询 = 拼查询串(路径, 参数);
  return 接口基地址.length === 0 ? 查询 : `${接口基地址.replace(/\/+$/, '')}${查询}`;
}

function 取追踪头(): Record<string, string> {
  const 请求编号 = `qian-duan-${Date.now().toString(36)}-${Math.floor(Math.random() * 46656).toString(36)}`;
  return { 'X-Request-Id': 请求编号, 'X-Trace-Id': 请求编号 };
}

async function 读响应体(响应: Response): Promise<unknown> {
  const 文本 = await 响应.text();
  try {
    return JSON.parse(文本) as unknown;
  } catch {
    return 文本;
  }
}

async function 发起请求(
  方法: 'GET' | 'POST',
  路径: string,
  正文: unknown,
  配置: 请求配置,
): Promise<响应包装> {
  const 头: Record<string, string> = 取追踪头();
  const 选项: RequestInit = {
    method: 方法,
    credentials: 'include',
    headers: 头,
    signal: AbortSignal.timeout(请求超时毫秒),
  };
  if (正文 !== undefined) {
    头['Content-Type'] = 'application/json';
    选项.body = JSON.stringify(正文);
  }
  let 响应: Response;
  try {
    响应 = await fetch(取完整地址(路径, 配置.params), 选项);
  } catch (错误) {
    throw 归一请求错误(new 传输错误(错误原文(错误), null, undefined, 配置.buTuiDengLu === true));
  }
  let 响应体: unknown;
  try {
    响应体 = await 读响应体(响应);
  } catch (错误) {
    throw 归一请求错误(new 传输错误(错误原文(错误), null, undefined, 配置.buTuiDengLu === true));
  }
  if (!响应.ok) {
    throw 归一请求错误(
      new 传输错误(
        `Request failed with status code ${响应.status}`,
        响应.status,
        响应体,
        配置.buTuiDengLu === true,
      ),
    );
  }
  if (是否失败包络(响应体)) {
    throw new 业务错误(响应体.ti_shi || 通用文案.请求失败, 响应体.cuo_wu_ma || '');
  }
  return { data: 响应体 };
}

export const 请求实例 = {
  get(路径: string, 配置: 请求配置 = {}): Promise<响应包装> {
    return 发起请求('GET', 路径, undefined, 配置);
  },
  post(路径: string, 正文?: unknown, 配置: 请求配置 = {}): Promise<响应包装> {
    return 发起请求('POST', 路径, 正文, 配置);
  },
};
