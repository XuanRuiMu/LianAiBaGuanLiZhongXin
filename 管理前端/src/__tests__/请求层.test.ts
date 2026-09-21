import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { 接口基地址, 请求超时毫秒 } from '../配置';
import { 业务错误, 解析包络, 请求实例, 是凭证失效错误, 取错误展示 } from '../api/请求';
import { 使用登录仓库, 读令牌 } from '../stores/登录';
import { 文案 } from '../文案/聚合';

type 桩响应 = { ok: boolean; 状态码?: number; 文本: string };

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

function 失败体(提示: string, 码: string): string {
  return `{"cheng_gong":false,"shu_ju":null,"ti_shi":"${提示}","cuo_wu_ma":"${码}"}`;
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

describe('FP-09 线路包络零变化：地址与查询串', () => {
  it('查询串逐字符等值：数字、时间冒号、空格、保留字符与中文的编码形态全部锁死', async () => {
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
        '&kai_shi_shi_jian=2026-01-01+00:00:00' +
        '&yong_hu_id=1,2$3' +
        '&lei_xing=%E7%94%B2+%E4%B8%8E%26%3D%E5%8F%B7',
    );
  });

  it('空值不上送：undefined 与空串都不进查询串，参数全空时不留问号', async () => {
    const { 调用 } = 装fetch({ ok: true, 文本: 成功体([]) });
    await 请求实例.get('/api/guan-li/zhang-hao-lie-biao', {
      params: { guan_jian_ci: undefined, shou_ji_hao: '', ye_ma: 1 },
    });
    expect(调用[0].地址).toBe(`${接口基地址}/api/guan-li/zhang-hao-lie-biao?ye_ma=1`);
  });

  it('不传 params 时地址就是基地址加路径，一个字符都不多加', async () => {
    const { 调用 } = 装fetch({ ok: true, 文本: 成功体([]) });
    await 请求实例.get('/api/jian-kang');
    expect(调用[0].地址).toBe(`${接口基地址}/api/jian-kang`);
  });

  it('零与 false 是有效筛选值，数组按 key[]=v 逐值展开并跳过空元素', async () => {
    const { 调用 } = 装fetch({ ok: true, 文本: 成功体([]) });
    await 请求实例.get('/api/x', { params: { d: 0, e: false, ids: ['1', 2, undefined, ''] } });
    expect(调用[0].地址).toBe(`${接口基地址}/api/x?d=0&e=false&ids%5B%5D=1&ids%5B%5D=2`);
  });

  it('URL 路径与基地址拼接不变，POST 仍把正文写成 JSON 并只给有体的请求发 Content-Type', async () => {
    const { 调用 } = 装fetch({ ok: true, 文本: 成功体({ yi_chu_li: true }) });
    await 请求实例.post('/api/guan-li/feng-jin', { yong_hu_id: 'yi', yuan_yin: 'ce' });
    expect(调用[0].地址).toBe(`${接口基地址}/api/guan-li/feng-jin`);
    expect(调用[0].选项.method).toBe('POST');
    expect(调用[0].选项.body).toBe('{"yong_hu_id":"yi","yuan_yin":"ce"}');
    expect(头(调用[0].选项)['Content-Type']).toBe('application/json');
  });
});

describe('FP-09 请求头与凭据面', () => {
  it('每个请求都带同值的 X-Request-Id 与 X-Trace-Id，且逐请求唯一', async () => {
    const { 调用 } = 装fetch({ ok: true, 文本: 成功体(null) });
    await 请求实例.get('/api/jian-kang');
    await 请求实例.get('/api/jian-kang');
    const 首 = 头(调用[0].选项);
    const 次 = 头(调用[1].选项);
    expect(首['X-Request-Id']).toMatch(/^qian-duan-[0-9a-z]+-[0-9a-z]+$/);
    expect(首['X-Trace-Id']).toBe(首['X-Request-Id']);
    expect(次['X-Request-Id']).not.toBe(首['X-Request-Id']);
  });

  it('凭据走 Cookie：credentials 恒为 include，GET 不发 Content-Type，也不自拼 Authorization 头', async () => {
    const { 调用 } = 装fetch({ ok: true, 文本: 成功体(null) });
    await 请求实例.get('/api/guan-li/wo-de-jiao-se');
    const 选项 = 调用[0].选项;
    expect(选项.credentials).toBe('include');
    expect(选项.method).toBe('GET');
    expect(头(选项)['Content-Type']).toBeUndefined();
    expect(头(选项).Authorization).toBeUndefined();
    expect(选项.body).toBeUndefined();
  });

  it('超时档取自配置常量，逐请求挂上 AbortSignal', async () => {
    const 定时 = vi.spyOn(AbortSignal, 'timeout');
    const { 调用 } = 装fetch({ ok: true, 文本: 成功体(null) });
    await 请求实例.get('/api/jian-kang');
    expect(请求超时毫秒).toBe(15000);
    expect(定时).toHaveBeenCalledWith(请求超时毫秒);
    expect(调用[0].选项.signal).toBeInstanceOf(AbortSignal);
  });
});

describe('FP-09 错误分流四情形', () => {
  it('非 2xx 且有失败包络：抛业务错误并带上服务端提示与码，不自造码', async () => {
    装fetch({ ok: false, 状态码: 403, 文本: 失败体('无管理身份，请联系超级管理员授予角色', 'WU_GUAN_LI_QUAN_XIAN') });
    expect(取错误展示(await 取错误(请求实例.get('/api/guan-li/shou-quan')))).toEqual({
      提示: '无管理身份，请联系超级管理员授予角色',
      错误码: 'WU_GUAN_LI_QUAN_XIAN',
    });
  });

  it('非 2xx 且无包络：只产标准中文提示且不带码', async () => {
    装fetch({ ok: false, 状态码: 504, 文本: '<html>Gateway Time-out</html>' });
    expect(取错误展示(await 取错误(请求实例.get('/api/x')))).toEqual({
      提示: 文案.通用.请求失败,
      错误码: '',
    });
  });

  it('非 2xx 且响应体是裸 null：不吃类型错误，仍归到「无失败包络」那条分支', async () => {
    装fetch({ ok: false, 状态码: 500, 文本: 'null' });
    await expect(请求实例.get('/api/x')).rejects.toMatchObject({
      message: 文案.通用.请求失败,
      cuo_wu_ma: '',
    });
  });

  it('2xx 但是失败包络：仍提前抛出业务错误并带上码', async () => {
    装fetch({ ok: true, 文本: 失败体('数据表尚未就绪，无法查询', 'BIAO_QUE_SHI_JIANG_JI') });
    await expect(请求实例.get('/api/x')).rejects.toMatchObject({
      message: '数据表尚未就绪，无法查询',
      cuo_wu_ma: 'BIAO_QUE_SHI_JIANG_JI',
    });
  });

  it('2xx 失败包络的空提示与空码：回落标准提示，但绝不带码上屏', async () => {
    装fetch({ ok: true, 文本: '{"cheng_gong":false,"shu_ju":null,"ti_shi":"","cuo_wu_ma":""}' });
    await expect(请求实例.post('/api/x', {})).rejects.toMatchObject({
      message: 文案.通用.请求失败,
      cuo_wu_ma: '',
    });
  });

  it('2xx 但体不是包络：原样透传给 解析包络，由它产出标准提示且不吐英文原文', async () => {
    装fetch({ ok: true, 文本: '<html>OK</html>' });
    const 响应 = await 请求实例.get('/api/x');
    expect(响应.data).toBe('<html>OK</html>');
    expect(() => 解析包络(响应.data)).toThrow(业务错误);
    expect(取错误展示(await 取错误(请求实例.get('/api/x').then((项) => 解析包络(项.data))))).toEqual({
      提示: 文案.通用.请求失败,
      错误码: '',
    });
  });

  it('请求未到达服务端（网络抖动）：提示走标准原子，错误码为空', async () => {
    装抛出桩(new TypeError('Failed to fetch'));
    await expect(请求实例.get('/api/x')).rejects.toMatchObject({
      message: 文案.通用.请求失败,
      cuo_wu_ma: '',
    });
  });

  it('响应头已到但读体中断：仍归「请求未到达服务端」，抛的是业务错误而非裸异常', async () => {
    已登录();
    globalThis.fetch = (async () =>
      ({
        ok: true,
        status: 200,
        text: async () => {
          throw new TypeError('aborted');
        },
      }) as unknown as Response) as unknown as typeof fetch;
    await expect(请求实例.get('/api/x')).rejects.toBeInstanceOf(业务错误);
    await expect(请求实例.get('/api/x')).rejects.toMatchObject({
      message: 文案.通用.请求失败,
      cuo_wu_ma: '',
    });
    expect(读令牌()).toBe('yi_deng_lu');
  });

  it('超时到点：与网络抖动同归「请求未到达服务端」分支，不带码也不清会话', async () => {
    已登录();
    装抛出桩({ name: 'TimeoutError', message: 'The operation was aborted due to timeout' });
    await expect(请求实例.get('/api/x')).rejects.toMatchObject({
      message: 文案.通用.请求失败,
      cuo_wu_ma: '',
    });
    expect(读令牌()).toBe('yi_deng_lu');
  });
});

describe('FP-09 会话保住的三类失败', () => {
  it('429 限流带 XIAN_LIU 码，不清会话且判为凭证未失效', async () => {
    已登录();
    装fetch({ ok: false, 状态码: 429, 文本: 失败体('请求过于频繁，请稍后再试', 'XIAN_LIU') });
    const 错误 = await 取错误(请求实例.get('/api/x'));
    expect(错误).toBeInstanceOf(业务错误);
    expect(是凭证失效错误(错误)).toBe(false);
    expect(读令牌()).toBe('yi_deng_lu');
  });

  it('网络抖动不清会话：服务端没有否定本次凭证', async () => {
    已登录();
    装抛出桩(new TypeError('Failed to fetch'));
    expect(是凭证失效错误(await 取错误(请求实例.get('/api/x')))).toBe(false);
    expect(读令牌()).toBe('yi_deng_lu');
  });

  it('401 无包络清会话，但不算凭证被服务端否定', async () => {
    已登录();
    装fetch({ ok: false, 状态码: 401, 文本: '' });
    await expect(请求实例.get('/api/x')).rejects.toThrow(文案.通用.登录过期);
    expect(读令牌()).toBeNull();
  });

  it('带 LING_PAI_WU_XIAO 码的 401 才算凭证被服务端否定，buTuiDengLu 时不清会话', async () => {
    已登录();
    装fetch({ ok: false, 状态码: 401, 文本: 失败体('登录续期已过期，请重新登录', 'LING_PAI_WU_XIAO') });
    const 错误 = await 取错误(请求实例.post('/api/guan-li/shua-xin', {}, { buTuiDengLu: true }));
    expect(是凭证失效错误(错误)).toBe(true);
    expect(读令牌()).toBe('yi_deng_lu');
  });

  it('buTuiDengLu 的注销 401 走登录过期提示，本地会话由调用方自己收尾', async () => {
    已登录();
    装fetch({ ok: false, 状态码: 401, 文本: '' });
    await expect(请求实例.post('/api/guan-li/tui-chu', {}, { buTuiDengLu: true })).rejects.toThrow(
      文案.通用.登录过期,
    );
    expect(读令牌()).toBe('yi_deng_lu');
  });
});
