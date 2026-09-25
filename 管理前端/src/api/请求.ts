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
  code: string;
  message: string;
  traceId: string;
  retryable: boolean;
  retryAfterMs?: number;
  fieldErrors?: Record<string, string>;
};

export type 解析结果<数据类型> = {
  数据: 数据类型;
  分页?: 分页信息;
};

export const 前端错误码 = {
  传输中断: 'CHUAN_SHU_ZHONG_DUAN',
  请求超时: 'QING_QIU_CHAO_SHI',
  非包络响应: 'FEI_BAO_FENG_WU',
  未归类: 'WEI_ZHI_CUOWU',
  本地校验: 'QIAN_DAN_WU_XIAO',
} as const;

type 业务错误详情 = {
  code: string;
  message: string;
  traceId?: string;
  retryable?: boolean;
  retryAfterMs?: number;
  fieldErrors?: Record<string, string>;
};

export class 业务错误 extends Error {
  readonly code: string;
  readonly traceId: string;
  readonly retryable: boolean;
  readonly retryAfterMs?: number;
  readonly fieldErrors: Readonly<Record<string, string>>;

  constructor(详情: 业务错误详情);
  constructor(提示: string, 错误码: string);
  constructor(详情: 业务错误详情 | string, 错误码: string = 前端错误码.未归类) {
    const 规范 = typeof 详情 === 'string'
      ? { code: 错误码, message: 详情, retryable: false }
      : 详情;
    super(规范.message);
    this.name = 业务错误.name;
    this.code = 规范.code;
    this.traceId = 安全追踪编号(规范.traceId);
    this.retryable = 规范.retryable === true;
    this.retryAfterMs = 规范.retryAfterMs !== undefined && Number.isInteger(规范.retryAfterMs) && 规范.retryAfterMs >= 0
      ? 规范.retryAfterMs
      : undefined;
    this.fieldErrors = Object.fromEntries(
      Object.entries(规范.fieldErrors ?? {}).filter(([, 值]) => typeof 值 === 'string'),
    ) as Record<string, string>;
  }

  get cuo_wu_ma(): string {
    return this.code;
  }
}

export type 查询值 =
  | string
  | number
  | boolean
  | undefined
  | ReadonlyArray<string | number | boolean | undefined>;

export type 请求配置 = {
  params?: Record<string, 查询值>;
  buTuiDengLu?: boolean;
};

export type 响应包装 = {
  data: unknown;
};

const 错误码格式 = /^[A-Z][A-Z0-9_]{3,63}$/;
const 追踪编号格式 = /^[A-Za-z0-9._:-]{1,64}$/;

function 创建追踪编号(): string {
  return `qian-duan-${Date.now().toString(36)}-${Math.floor(Math.random() * 46656).toString(36)}`;
}

function 安全追踪编号(值: string | undefined): string {
  return 值 !== undefined && 追踪编号格式.test(值) ? 值 : 创建追踪编号();
}

export function 创建前端错误(
  提示: string,
  错误码: string = 前端错误码.本地校验,
  retryable = false,
  选项: { traceId?: string; retryAfterMs?: number; fieldErrors?: Record<string, string> } = {},
): 业务错误 {
  return new 业务错误({
    code: 错误码,
    message: 提示,
    traceId: 选项.traceId,
    retryable,
    retryAfterMs: 选项.retryAfterMs,
    fieldErrors: 选项.fieldErrors,
  });
}

function 是完整失败包络(响应体: unknown): 响应体 is 包络失败 {
  if (typeof 响应体 !== 'object' || 响应体 === null) {
    return false;
  }
  const 包络 = 响应体 as Record<string, unknown>;
  return 包络['cheng_gong'] === false
    && 包络['shu_ju'] === null
    && typeof 包络['code'] === 'string'
    && 错误码格式.test(包络['code'])
    && typeof 包络['message'] === 'string'
    && 包络['message'].length > 0
    && typeof 包络['traceId'] === 'string'
    && typeof 包络['retryable'] === 'boolean';
}

function 是成功包络<数据类型>(响应体: unknown): 响应体 is 包络成功<数据类型> {
  return typeof 响应体 === 'object'
    && 响应体 !== null
    && (响应体 as Record<string, unknown>)['cheng_gong'] === true
    && 'shu_ju' in 响应体;
}

function 包络转错误(包络: 包络失败, traceId: string): 业务错误 {
  return new 业务错误({
    code: 包络.code,
    message: 包络.message,
    traceId,
    retryable: 包络.retryable,
    retryAfterMs: 包络.retryAfterMs,
    fieldErrors: 包络.fieldErrors,
  });
}

function 记请求诊断(来源: string, traceId: string, 状态码?: number): void {
  console.error('[request]', { 来源, traceId, 状态码: 状态码 ?? null });
}

function 建非包络错误(traceId: string, 状态码?: number): 业务错误 {
  记请求诊断('non-envelope', traceId, 状态码);
  return 创建前端错误(通用文案.响应格式异常, 前端错误码.非包络响应, true, { traceId });
}

export function 解析包络<数据类型>(响应体: unknown): 解析结果<数据类型> {
  if (是完整失败包络(响应体)) {
    throw 包络转错误(响应体, 响应体.traceId);
  }
  if (是成功包络<数据类型>(响应体)) {
    return { 数据: 响应体.shu_ju, 分页: 响应体.fen_ye };
  }
  throw 建非包络错误(创建追踪编号());
}

export class 传输错误 extends Error {
  readonly 状态码: number | null;
  readonly 响应体: unknown;
  readonly buTuiDengLu: boolean;
  readonly traceId: string;
  readonly 响应头: Headers | undefined;
  readonly 类型: 'transport' | 'timeout';

  constructor(
    原文: string,
    状态码: number | null,
    响应体: unknown,
    buTuiDengLu: boolean,
    traceId = 创建追踪编号(),
    响应头?: Headers,
    类型: 'transport' | 'timeout' = 'transport',
  ) {
    super(原文);
    this.name = 传输错误.name;
    this.状态码 = 状态码;
    this.响应体 = 响应体;
    this.buTuiDengLu = buTuiDengLu;
    this.traceId = 安全追踪编号(traceId);
    this.响应头 = 响应头;
    this.类型 = 类型;
  }
}

function 建传输错误(
  原文: string,
  状态码: number | null,
  响应体: unknown,
  配置: 请求配置,
  traceId: string,
  响应头?: Headers,
  类型: 'transport' | 'timeout' = 'transport',
): 传输错误 {
  return new 传输错误(原文, 状态码, 响应体, 配置.buTuiDengLu === true, traceId, 响应头, 类型);
}

export function 是凭证失效错误(错误: unknown): boolean {
  return 错误 instanceof 业务错误 && (错误.code === 'WEI_SHOU_QUAN' || 错误.code === 'LING_PAI_WU_XIAO');
}

function 取响应追踪编号(错误: 传输错误): string {
  const 头编号 = 错误.响应头?.get('X-Trace-Id') ?? '';
  return 安全追踪编号(头编号 || 错误.traceId);
}

export function 归一请求错误(错误: unknown): 业务错误 {
  if (!(错误 instanceof 传输错误)) {
    const traceId = 创建追踪编号();
    记请求诊断('unclassified', traceId);
    return 创建前端错误(通用文案.请求失败, 前端错误码.未归类, true, { traceId });
  }
  const traceId = 取响应追踪编号(错误);
  if (错误.状态码 === 401 && 错误.buTuiDengLu !== true) {
    清除令牌();
    if (typeof window !== 'undefined' && window.location.pathname !== '/deng-lu') {
      window.location.assign('/deng-lu');
    }
  }
  if (错误.状态码 !== null) {
    if (是完整失败包络(错误.响应体)) {
      const 包络 = 错误.响应体;
      return 包络转错误(包络, 安全追踪编号(包络.traceId || traceId));
    }
    if (错误.状态码 === 401) {
      记请求诊断('401-non-envelope', traceId, 错误.状态码);
      return 创建前端错误(通用文案.登录过期, 前端错误码.非包络响应, false, { traceId });
    }
    return 建非包络错误(traceId, 错误.状态码);
  }

  记请求诊断(错误.类型, traceId);
  return 创建前端错误(
    错误.类型 === 'timeout' ? 通用文案.请求超时 : 通用文案.网络中断,
    错误.类型 === 'timeout' ? 前端错误码.请求超时 : 前端错误码.传输中断,
    true,
    { traceId },
  );
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

function 取追踪头(traceId: string): Record<string, string> {
  return { 'X-Request-Id': traceId, 'X-Trace-Id': traceId };
}

async function 读响应体(响应: Response): Promise<unknown> {
  const 文本 = await 响应.text();
  try {
    return JSON.parse(文本) as unknown;
  } catch {
    return 文本;
  }
}

function 错误名称(错误: unknown): string {
  if (typeof 错误 === 'object' && 错误 !== null && 'name' in 错误 && typeof 错误.name === 'string') {
    return 错误.name;
  }
  return 'Error';
}

function 是超时(错误: unknown): boolean {
  return 错误名称(错误) === 'TimeoutError';
}

async function 发起请求(
  方法: 'GET' | 'POST',
  路径: string,
  正文: unknown,
  配置: 请求配置,
): Promise<响应包装> {
  const traceId = 创建追踪编号();
  const 头: Record<string, string> = 取追踪头(traceId);
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
    throw 归一请求错误(建传输错误(
      错误名称(错误),
      null,
      undefined,
      配置,
      traceId,
      undefined,
      是超时(错误) ? 'timeout' : 'transport',
    ));
  }
  let 响应体: unknown;
  try {
    响应体 = await 读响应体(响应);
  } catch (错误) {
    throw 归一请求错误(建传输错误(
      错误名称(错误),
      null,
      undefined,
      配置,
      traceId,
      响应.headers,
    ));
  }
  if (!响应.ok) {
    throw 归一请求错误(建传输错误(
      'HTTPFailure',
      响应.status,
      响应体,
      配置,
      traceId,
      响应.headers,
    ));
  }
  if (是完整失败包络(响应体)) {
    throw 包络转错误(响应体, 安全追踪编号(响应体.traceId || 响应.headers?.get('X-Trace-Id') || traceId));
  }
  if (!是成功包络(响应体)) {
    throw 建非包络错误(traceId);
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
