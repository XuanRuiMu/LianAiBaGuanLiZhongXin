// @vitest-environment node
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { 业务错误, 传输错误, 归一请求错误, 请求实例, 前端错误码 } from '../api/请求';
import { 通用文案 } from '../文案/通用';

class 内存存储 implements Storage {
  private 数据 = new Map<string, string>();

  get length(): number {
    return this.数据.size;
  }

  clear(): void {
    this.数据.clear();
  }

  getItem(键: string): string | null {
    return this.数据.get(键) ?? null;
  }

  key(序号: number): string | null {
    return Array.from(this.数据.keys())[序号] ?? null;
  }

  removeItem(键: string): void {
    this.数据.delete(键);
  }

  setItem(键: string, 值: string): void {
    this.数据.set(键, 值);
  }
}

const 局部存储 = new 内存存储();

const 会话存储 = new 内存存储();

const 跳转记录: string[] = [];

let 当前路径 = '/zhang-hao';

function 失败包络(message: string, code: string, retryable = false): Record<string, unknown> {
  return { cheng_gong: false, shu_ju: null, code, message, traceId: 'trace-server', retryable };
}

Object.defineProperty(globalThis, 'window', {
  configurable: true,
  writable: true,
  value: {
    localStorage: 局部存储,
    sessionStorage: 会话存储,
    location: {
      get pathname(): string {
        return 当前路径;
      },
      assign: (地址: string): void => {
        跳转记录.push(地址);
      },
    },
  },
});

const 会话键 = 'guan_li_hui_hua';

function 装会话(): void {
  会话存储.clear();
  局部存储.clear();
  会话存储.setItem(会话键, 'yi_deng_lu');
  局部存储.setItem(会话键, 'yi_deng_lu');
  会话存储.setItem('guan_li_jiao_se', 'chao_guan');
  expect(会话存储.getItem(会话键)).toBe('yi_deng_lu');
}

afterAll(() => {
  Reflect.deleteProperty(globalThis, 'window');
});

beforeEach(() => {
  跳转记录.length = 0;
  当前路径 = '/zhang-hao';
  vi.restoreAllMocks();
});

describe('FP-09 401 兜底跳转的可观察契约', () => {
  it('普通 401：清会话并跳转，保留非包络稳定码与追踪编号', () => {
    装会话();
    const 错误 = 归一请求错误(new 传输错误('Request failed with status code 401', 401, '', false));
    expect(错误).toBeInstanceOf(业务错误);
    expect(错误.message).toBe(通用文案.登录过期);
    expect(错误.code).toBe(前端错误码.非包络响应);
    expect(错误.traceId).toMatch(/^qian-duan-/);
    expect(跳转记录).toEqual(['/deng-lu']);
    expect(会话存储.getItem(会话键)).toBeNull();
    expect(局部存储.getItem(会话键)).toBeNull();
    expect(会话存储.getItem('guan_li_jiao_se')).toBeNull();
  });

  it('buTuiDengLu 的 401：既不跳转也不清会话，续期与注销自己处置', () => {
    装会话();
    const 错误 = 归一请求错误(new 传输错误('Request failed with status code 401', 401, '', true));
    expect(错误.message).toBe(通用文案.登录过期);
    expect(跳转记录).toEqual([]);
    expect(会话存储.getItem(会话键)).toBe('yi_deng_lu');
    expect(局部存储.getItem(会话键)).toBe('yi_deng_lu');
  });

  it('已在 /deng-lu 时不再跳转，登录页不被自己重定向成死循环', () => {
    装会话();
    当前路径 = '/deng-lu';
    归一请求错误(new 传输错误('Request failed with status code 401', 401, '', false));
    expect(跳转记录).toEqual([]);
    expect(会话存储.getItem(会话键)).toBeNull();
  });

  it('429 与请求未到达服务端都不触发跳转，也不清会话', () => {
    装会话();
    归一请求错误(
      new 传输错误('Request failed with status code 429', 429, 失败包络('请求过于频繁，请稍后再试', 'XIAN_LIU', true), false),
    );
    归一请求错误(new 传输错误('Failed to fetch', null, undefined, false));
    expect(跳转记录).toEqual([]);
    expect(会话存储.getItem(会话键)).toBe('yi_deng_lu');
  });

  it('凭证失效码走服务端否定这一支：401 带 LING_PAI_WU_XIAO 时清会话、跳转且码上屏', () => {
    装会话();
    const 错误 = 归一请求错误(
      new 传输错误('Request failed with status code 401', 401, 失败包络('登录续期已过期，请重新登录', 'LING_PAI_WU_XIAO'), false),
    );
    expect(错误.code).toBe('LING_PAI_WU_XIAO');
    expect(跳转记录).toEqual(['/deng-lu']);
    expect(会话存储.getItem(会话键)).toBeNull();
  });

  it('经请求实例的整条链同样落到跳转：非 2xx 无包络的 401 只跳一次', async () => {
    装会话();
    const 调用: { 地址: string; 选项: RequestInit }[] = [];
    const 原请求函数 = globalThis.fetch;
    globalThis.fetch = (async (地址: string, 选项: RequestInit): Promise<Response> => {
      调用.push({ 地址, 选项 });
      return { ok: false, status: 401, text: async () => '' } as unknown as Response;
    }) as unknown as typeof fetch;
    try {
      await expect(请求实例.post('/api/guan-li/shua-xin', {})).rejects.toBeInstanceOf(业务错误);
    } finally {
      globalThis.fetch = 原请求函数;
    }
    expect(调用).toHaveLength(1);
    expect(调用[0].地址.endsWith('/api/guan-li/shua-xin')).toBe(true);
    expect(调用[0].选项.credentials).toBe('include');
    expect(跳转记录).toEqual(['/deng-lu']);
    expect(会话存储.getItem(会话键)).toBeNull();
  });
});
