import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { 接口基地址, 请求超时毫秒 } from '../配置';
import {
  业务错误,
  创建前端错误,
  解析包络,
  请求实例,
  前端错误码,
  type 包络失败,
} from '../api/请求';
import { 创建请求展示闸门, 取错误展示 } from '../api/错误展示';
import { 使用登录仓库, 读令牌 } from '../stores/登录';
import { 通用文案 } from '../文案/通用';

type 桩响应 = { ok: boolean; 状态码?: number; 文本: string; 响应头?: Record<string, string> };
type 调用记录 = { 地址: string; 选项: RequestInit };
type 头记录 = Record<string, string>;

const 原请求函数 = globalThis.fetch;

function 装桩(处理: () => Promise<Response>): { 调用: 调用记录[] } {
  const 调用: 调用记录[] = [];
  globalThis.fetch = (async (地址: string, 选项: RequestInit): Promise<Response> => {
    调用.push({ 地址, 选项 });
    return 处理();
  }) as unknown as typeof fetch;
  return { 调用 };
}

function 壳(响应: 桩响应): Response {
  return {
    ok: 响应.ok,
    status: 响应.状态码 ?? (响应.ok ? 200 : 500),
    headers: new Headers(响应.响应头 ?? {}),
    text: async () => 响应.文本,
  } as unknown as Response;
}

function 装fetch(响应: 桩响应): { 调用: 调用记录[] } {
  return 装桩(async () => 壳(响应));
}

function 装抛出桩(错误: unknown): { 调用: 调用记录[] } {
  return 装桩(async () => {
    throw 错误;
  });
}

function 头(选项: RequestInit): 头记录 {
  return 选项.headers as 头记录;
}

function 成功体(数据: unknown): string {
  return JSON.stringify({ cheng_gong: true, shu_ju: 数据 });
}

function 失败体(提示: string, 码: string, 额外: Partial<包络失败> = {}): string {
  return JSON.stringify({
    cheng_gong: false,
    shu_ju: null,
    code: 码,
    message: 提示,
    traceId: 'trace-server',
    retryable: false,
    ...额外,
  });
}

function 已登录(): void {
  使用登录仓库().设置令牌('yi_deng_lu', true);
  expect(读令牌(), '前置：会话标记必须先落在两个存储里').toBe('yi_deng_lu');
}

const 取错误 = (承诺: Promise<unknown>): Promise<unknown> => 承诺.catch((项: unknown) => 项);

beforeEach(() => {
  setActivePinia(createPinia());
  window.localStorage.clear();
  window.sessionStorage.clear();
});

afterEach(() => {
  globalThis.fetch = 原请求函数;
  vi.restoreAllMocks();
});

describe('FP-15 查询串与请求头契约', () => {
  it('查询串逐字符保持既有编码口径', async () => {
    const { 调用 } = 装fetch({ ok: true, 文本: 成功体([]) });
    await 请求实例.get('/api/guan-li/shen-ji-ri-zhi', {
      params: {
        ye_ma: 2,
        mei_ye_tiao_shu: 20,
        kai_shi_shi_jian: '2026-01-01 00:00:00',
        yong_hu_id: '1,2$3',
        lei_xing: '甲 与&=号',
      },
    });
    expect(调用[0].地址).toBe(
      `${接口基地址}/api/guan-li/shen-ji-ri-zhi` +
        '?ye_ma=2&mei_ye_tiao_shu=20' +
        '&kai_shi_shi_jian=2026-01-01+00%3A00%3A00'.replace(/%3A/g, ':') +
        '&yong_hu_id=1,2$3' +
        '&lei_xing=%E7%94%B2+%E4%B8%8E%26%3D%E5%8F%B7',
    );
  });

  it('空值不上送且数组逐值展开', async () => {
    const { 调用 } = 装fetch({ ok: true, 文本: 成功体([]) });
    await 请求实例.get('/api/guan-li/zhang-hao-lie-biao', {
      params: { guan_jian_ci: undefined, shou_ji_hao: '', ye_ma: 1 },
    });
    await 请求实例.get('/api/x', { params: { d: 0, e: false, ids: ['1', 2, undefined, ''] } });
    expect(调用[0].地址).toBe(`${接口基地址}/api/guan-li/zhang-hao-lie-biao?ye_ma=1`);
    expect(调用[1].地址).toBe(`${接口基地址}/api/x?d=0&e=false&ids%5B%5D=1&ids%5B%5D=2`);
  });

  it('POST 只在有正文时发送 JSON 与 Content-Type', async () => {
    const { 调用 } = 装fetch({ ok: true, 文本: 成功体({ yi_chu_li: true }) });
    await 请求实例.post('/api/guan-li/feng-jin', { yong_hu_id: 'yi', yuan_yin: 'ce' });
    await 请求实例.get('/api/guan-li/wo-de-jiao-se');
    expect(调用[0].选项.body).toBe('{"yong_hu_id":"yi","yuan_yin":"ce"}');
    expect(头(调用[0].选项)['Content-Type']).toBe('application/json');
    expect(头(调用[1].选项)['Content-Type']).toBeUndefined();
  });

  it('凭据只走 Cookie，追踪头同值且逐请求唯一，超时只来自配置', async () => {
    const 定时 = vi.spyOn(AbortSignal, 'timeout');
    const { 调用 } = 装fetch({ ok: true, 文本: 成功体(null) });
    await 请求实例.get('/api/jian-kang');
    await 请求实例.get('/api/jian-kang');
    const 首 = 头(调用[0].选项);
    const 次 = 头(调用[1].选项);
    expect(首['X-Request-Id']).toMatch(/^qian-duan-[0-9a-z]+-[0-9a-z]+$/);
    expect(首['X-Trace-Id']).toBe(首['X-Request-Id']);
    expect(次['X-Request-Id']).not.toBe(首['X-Request-Id']);
    expect(调用[0].选项.credentials).toBe('include');
    expect(调用[0].选项.signal).toBeInstanceOf(AbortSignal);
    expect(请求超时毫秒).toBe(15000);
    expect(定时).toHaveBeenCalledWith(请求超时毫秒);
  });
});

describe('FP-15 传输失败稳定分类', () => {
  it('网络传输中断与读体中断都有稳定码、追踪编号和中文消息', async () => {
    装抛出桩(new TypeError('Failed to fetch password=秘密 token=访问值'));
    const 网络 = await 取错误(请求实例.get('/api/x'));
    expect(网络).toBeInstanceOf(业务错误);
    expect((网络 as 业务错误).code).toBe(前端错误码.传输中断);
    expect((网络 as 业务错误).traceId).toMatch(/^qian-duan-/);
    expect((网络 as 业务错误).retryable).toBe(true);
    expect(取错误展示(网络).消息).toBe(通用文案.网络中断);

    globalThis.fetch = (async () =>
      ({
        ok: true,
        status: 200,
        headers: new Headers(),
        text: async () => {
          throw new TypeError('aborted Cookie=guan_li_ling_pai=秘密');
        },
      }) as unknown as Response) as unknown as typeof fetch;
    const 读体 = await 取错误(请求实例.get('/api/x'));
    expect((读体 as 业务错误).code).toBe(前端错误码.传输中断);
  });

  it('超时与普通网络失败分流且都不清会话', async () => {
    已登录();
    装抛出桩({ name: 'TimeoutError', message: 'The operation was aborted due to timeout' });
    const 错误 = await 取错误(请求实例.get('/api/x'));
    expect((错误 as 业务错误).code).toBe(前端错误码.请求超时);
    expect(取错误展示(错误).消息).toBe(通用文案.请求超时);
    expect(读令牌()).toBe('yi_deng_lu');
  });

  it('非 JSON 与非包络响应都产非包络稳定码，不伪装空态', async () => {
    装fetch({ ok: true, 文本: '<html>OK</html>' });
    await expect(请求实例.get('/api/x')).rejects.toMatchObject({
      code: 前端错误码.非包络响应,
      retryable: true,
    });
    装fetch({ ok: false, 状态码: 504, 文本: '<html>Gateway Time-out</html>' });
    const 展示 = 取错误展示(await 取错误(请求实例.get('/api/x')));
    expect(展示.错误码).toBe(前端错误码.非包络响应);
    expect(展示.消息).toBe(通用文案.响应格式异常);
    expect(展示.可重试).toBe(true);
  });

  it('失败包络缺 code、message、traceId 或 retryable 时整包降级为非包络错误', async () => {
    for (const 响应体 of [
      { cheng_gong: false, shu_ju: null, message: '失败', traceId: 'trace', retryable: false },
      { cheng_gong: false, shu_ju: null, code: 'XIAN_LIU', traceId: 'trace', retryable: false },
      { cheng_gong: false, shu_ju: null, code: 'XIAN_LIU', message: '失败', retryable: false },
      { cheng_gong: false, shu_ju: null, code: 'XIAN_LIU', message: '失败', traceId: 'trace' },
    ]) {
      装fetch({ ok: false, 状态码: 429, 文本: JSON.stringify(响应体) });
      expect(((await 取错误(请求实例.get('/api/x'))) as 业务错误).code).toBe(前端错误码.非包络响应);
    }
  });
});

describe('FP-15 HTTP 包络与白名单降级', () => {
  it('401、403、404、409、429、5xx 保留服务端 code、message、traceId 与 retryable', async () => {
    const 用例: Array<[number, string, boolean]> = [
      [401, 'LING_PAI_WU_XIAO', false],
      [403, 'WU_GUAN_LI_QUAN_XIAN', false],
      [404, 'WEI_ZHAO_DAO', false],
      [409, 'SHEN_HE_DUI_XIANG_YI_BIAN', true],
      [429, 'XIAN_LIU', true],
      [503, 'HUAN_CUN_BU_KE_YONG', true],
    ];
    for (const [状态码, 错误码值, 可重试] of 用例) {
      装fetch({
        ok: false,
        状态码,
        文本: 失败体('服务端中文提示', 错误码值, { retryable: 可重试 }),
      });
      const 错误 = (await 取错误(请求实例.get('/api/x', 状态码 === 401 ? { buTuiDengLu: true } : undefined))) as 业务错误;
      expect(错误.code).toBe(错误码值);
      expect(错误.message).toBe('服务端中文提示');
      expect(错误.traceId).toBe('trace-server');
      expect(错误.retryable).toBe(可重试);
    }
  });

  it('白名单外新码保留原码但消息降级为通用中文', async () => {
    装fetch({ ok: false, 状态码: 400, 文本: 失败体('新版本提示', 'XIN_LU_ZHOU_QI', { retryable: true }) });
    const 展示 = 取错误展示(await 取错误(请求实例.get('/api/x')));
    expect(展示.错误码).toBe('XIN_LU_ZHOU_QI');
    expect(展示.消息).toBe(通用文案.请求失败);
    expect(展示.影响).toBe(通用文案.数据未更新);
    expect(展示.下一步).toBe(通用文案.稍后重试);
    expect(展示.可重试).toBe(true);
  });

  it('已知码夹带 SQL、路径、环境、驱动或第三方原文时拒绝上屏', async () => {
    const 危险消息 = [
      'SELECT * FROM 用户 at D:\\service\\db.ts line 12',
      'DATABASE_URL=postgres://user:pass@localhost/db stack failed',
      'Redis ECONNREFUSED driver error',
      'https://third.example/token/abc',
    ];
    for (const message of 危险消息) {
      装fetch({ ok: false, 状态码: 500, 文本: 失败体(message, 'NEI_BU_CUO_WU', { retryable: true }) });
      const 展示 = 取错误展示(await 取错误(请求实例.get('/api/x')));
      expect(展示.消息).toBe(通用文案.请求失败);
      expect(JSON.stringify(展示)).not.toContain(message);
    }
  });

  it('字段错误值不携带内部原文上屏', async () => {
    装fetch({
      ok: false,
      状态码: 400,
      文本: 失败体('参数有误', 'CAN_SHU_CUO_WU', {
        fieldErrors: { ni_hao: 'SELECT * FROM users', you_xiang: '邮箱格式不正确' },
      }),
    });
    const 展示 = 取错误展示(await 取错误(请求实例.get('/api/x')));
    expect(展示.字段错误).toEqual({
      ni_hao: 通用文案.请求失败,
      you_xiang: '邮箱格式不正确',
    });
    expect(JSON.stringify(展示)).not.toContain('SELECT * FROM users');
  });

  it('traceId 优先取包络，其次响应头，缺失时回退本次请求号', async () => {
    装fetch({ ok: false, 状态码: 400, 文本: 失败体('参数有误', 'CAN_SHU_CUO_WU') });
    expect(((await 取错误(请求实例.get('/api/x'))) as 业务错误).traceId).toBe('trace-server');

    装fetch({
      ok: false,
      状态码: 400,
      文本: JSON.stringify({ cheng_gong: false, shu_ju: null, code: 'CAN_SHU_CUO_WU', message: '参数有误', traceId: '', retryable: false }),
      响应头: { 'X-Trace-Id': 'trace-header' },
    });
    expect(((await 取错误(请求实例.get('/api/x'))) as 业务错误).traceId).toBe('trace-header');

    装fetch({
      ok: false,
      状态码: 400,
      文本: JSON.stringify({ cheng_gong: false, shu_ju: null, code: 'CAN_SHU_CUO_WU', message: '参数有误', traceId: '', retryable: false }),
    });
    expect(((await 取错误(请求实例.get('/api/x'))) as 业务错误).traceId).toMatch(/^qian-duan-/);
  });

  it('可选 retryAfterMs 与 fieldErrors 原样进入结构化错误', async () => {
    装fetch({
      ok: false,
      状态码: 429,
      文本: 失败体('请求过于频繁', 'XIAN_LIU', {
        retryable: true,
        retryAfterMs: 1500,
        fieldErrors: { yong_hu_id: '用户编号格式不正确' },
      }),
    });
    const 展示 = 取错误展示(await 取错误(请求实例.get('/api/x')));
    expect(展示.可重试延迟毫秒).toBe(1500);
    expect(展示.字段错误).toEqual({ yong_hu_id: '用户编号格式不正确' });
    expect(展示.下一步).toContain('1.5 秒');
  });
});

describe('FP-15 展示与竞态单源', () => {
  it('解析包络是唯一失败拆分点且任何错误都不再无码', () => {
    expect(() => 解析包络({ cheng_gong: true })).toThrow(业务错误);
    const 本地 = 创建前端错误('请填写手机号', 前端错误码.本地校验, false);
    const 展示 = 取错误展示(本地);
    expect(展示.错误码).toBe(前端错误码.本地校验);
    expect(展示.消息).toBe('请填写手机号');
    expect(展示.追踪编号).toMatch(/^qian-duan-/);
    expect(取错误展示(new Error('Failed to fetch')).错误码).toBe(前端错误码.未归类);
  });

  it('请求展示闸门只允许最新批次覆盖错误', () => {
    const 闸门 = 创建请求展示闸门();
    const 旧请求 = 闸门.开始();
    const 新请求 = 闸门.开始();
    expect(闸门.可更新(旧请求)).toBe(false);
    expect(闸门.可更新(新请求)).toBe(true);
    闸门.作废();
    expect(闸门.可更新(新请求)).toBe(false);
  });

  it('诊断日志不输出响应原文、密码、Cookie、令牌或 API key', async () => {
    const 诊断 = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    装抛出桩(new TypeError('password=密文 Cookie=会话=秘密 token=访问值 api_key=接口密钥'));
    await 取错误(请求实例.get('/api/x?token=查询秘密'));
    const 文本 = JSON.stringify(诊断.mock.calls);
    expect(文本).not.toMatch(/密文|秘密|访问值|接口密钥|查询秘密|password|cookie|token|api_key/i);
    expect(文本).toContain('traceId');
  });
});
