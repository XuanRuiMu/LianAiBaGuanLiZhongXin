import { describe, it, expect, afterEach } from 'vitest';
import request from 'supertest';
import { 是否允许来源, 创建应用 } from '../../src/应用';
import { 创建测试应用, 签发管理令牌, 授权头 } from './测试辅助';

const 旧来源 = process.env.ALLOWED_ORIGINS;

afterEach(() => {
  if (旧来源 === undefined) delete process.env.ALLOWED_ORIGINS;
  else process.env.ALLOWED_ORIGINS = 旧来源;
});

describe('专属前端绑定', () => {
  it('本地5175双环回默认放行', () => {
    delete process.env.ALLOWED_ORIGINS;
    expect(是否允许来源('http://localhost:5175')).toBe(true);
    expect(是否允许来源('http://127.0.0.1:5175')).toBe(true);
  });

  it('非5175与非本地一律拒收', () => {
    delete process.env.ALLOWED_ORIGINS;
    expect(是否允许来源('http://localhost:3000')).toBe(false);
    expect(是否允许来源('http://127.0.0.1:5173')).toBe(false);
    expect(是否允许来源('http://example.com:5175')).toBe(false);
    expect(是否允许来源('not-a-url')).toBe(false);
  });

  it('显式白名单来源放行', () => {
    process.env.ALLOWED_ORIGINS = 'http://my-admin:5175';
    expect(是否允许来源('http://my-admin:5175')).toBe(true);
    expect(是否允许来源('http://evil:5175')).toBe(false);
  });

  it('CORS预检非白名单不放行', async () => {
    delete process.env.ALLOWED_ORIGINS;
    const { 应用 } = 创建测试应用();
    const 响应 = await request(应用)
      .options('/api/guan-li/zhang-hao-lie-biao')
      .set('Origin', 'http://evil:5175')
      .set('Access-Control-Request-Method', 'GET');
    expect(响应.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('CORS预检白名单放行', async () => {
    delete process.env.ALLOWED_ORIGINS;
    const { 应用 } = 创建测试应用();
    const 响应 = await request(应用)
      .options('/api/guan-li/zhang-hao-lie-biao')
      .set('Origin', 'http://localhost:5175')
      .set('Access-Control-Request-Method', 'GET');
    expect(响应.headers['access-control-allow-origin']).toBe('http://localhost:5175');
  });

  it('无Origin健康检查豁免可用', async () => {
    const { 应用 } = 创建测试应用();
    const 响应 = await request(应用).get('/api/jian-kang');
    expect(响应.status).toBe(200);
  });

  it('无Origin管理接口仍需令牌不豁免', async () => {
    const { 应用 } = 创建测试应用();
    const 缺头 = await request(应用).get('/api/guan-li/zhang-hao-lie-biao');
    expect(缺头.status).toBe(401);
    const 带令牌 = await request(应用).get('/api/guan-li/zhang-hao-lie-biao').set(授权头(签发管理令牌()));
    expect(带令牌.status).toBe(200);
  });

  it('创建应用导出绑定判定供脚本复用', () => {
    expect(typeof 创建应用).toBe('function');
    expect(typeof 是否允许来源).toBe('function');
  });
});
