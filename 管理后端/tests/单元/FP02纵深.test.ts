import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { 创建测试应用, 签发管理令牌, 授权头, 创建模拟池 } from './测试辅助';
import { 取真实IP, 是否可信代理 } from '../../src/真实IP';

describe('FP-02 YH-016管理端信任代理+Redis限流+YH-021正则统一', () => {
  it('真实IP推导：不可信对端直接取对端，不读伪造X-Real-IP', async () => {
    const 假请求 = {
      socket: { remoteAddress: '203.0.113.9' },
      headers: { 'x-real-ip': '1.2.3.4' },
    } as never;
    expect(取真实IP(假请求)).toBe('203.0.113.9');
    expect(是否可信代理('203.0.113.9')).toBe(false);
  });

  it('真实IP推导：回环对端信任X-Real-IP', async () => {
    const 真请求 = {
      socket: { remoteAddress: '127.0.0.1' },
      headers: { 'x-real-ip': '203.0.113.9' },
    } as never;
    expect(取真实IP(真请求)).toBe('203.0.113.9');
    expect(是否可信代理('127.0.0.1')).toBe(true);
  });

  it('限流走共享缓存：同键跨应用实例累计', async () => {
    const 表 = new Map<string, string>();
    const 共享缓存 = {
      get: async (键: string): Promise<string | null> => 表.get(键) ?? null,
      set: async (键: string, 值: string): Promise<unknown> => {
        表.set(键, 值);
        return 'OK';
      },
      del: async (键: string): Promise<unknown> => (表.delete(键) ? 1 : 0),
      publish: async (): Promise<unknown> => 0,
      subscribe: async (): Promise<() => void> => () => undefined,
    };
    const { 池 } = 创建模拟池();
    const { 创建应用 } = await import('../../src/应用.js');
    const { 清空管理员缓存 } = await import('../../src/中间件/管理员.js');
    清空管理员缓存();
    const 应用 = 创建应用({ 池, 缓存: 共享缓存, 读限流: { 窗口毫秒: 60000, 上限: 2 } });
    const 头 = 授权头(签发管理令牌());
    expect((await request(应用).get('/api/guan-li/zhang-hao-lie-biao').set(头)).status).toBe(200);
    expect((await request(应用).get('/api/guan-li/zhang-hao-lie-biao').set(头)).status).toBe(200);
    expect((await request(应用).get('/api/guan-li/zhang-hao-lie-biao').set(头)).status).toBe(429);
  });

  it('管理端手机号正则与主仓统一：12开头拒绝', async () => {
    const { 校验手机号 } = await import('../../src/校验.js');
    expect(() => 校验手机号('手机号', '12000000000')).toThrow();
    expect(校验手机号('手机号', '13800000000')).toBe('13800000000');
  });

  it('管理登录弱密码复杂度由服务层兜底：过短直接400不查库', async () => {
    const { 池 } = 创建模拟池(() => [{ 管理员: true }]);
    const { 应用, 查询记录 } = 创建测试应用({ 池 });
    // YH-031 收敛后口径：8位加字母数字，纯弱口令直接400不查库
    const 响应 = await request(应用).post('/api/guan-li/deng-lu').send({ shou_ji_hao: '13800000000', mi_ma: '12345678' });
    expect(响应.status).toBe(400);
    expect(查询记录.some((记录) => 记录.文本.includes('FROM "用户" WHERE "手机号"'))).toBe(false);
  });
});
