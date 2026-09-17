import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { 创建测试应用, 签发管理令牌, 授权头 } from './测试辅助';

describe('统计接口', () => {
  it('注册统计返回200且服务端聚合', async () => {
    const { 应用, 查询记录 } = 创建测试应用();
    const 响应 = await request(应用).get('/api/guan-li/tong-ji/zhu-ce').set(授权头(签发管理令牌()));
    expect(响应.status).toBe(200);
    expect(查询记录.some((记录) => 记录.文本.includes('GROUP BY'))).toBe(true);
  });

  it('消息统计返回200且按发送者聚合', async () => {
    const { 应用, 查询记录 } = 创建测试应用();
    const 响应 = await request(应用).get('/api/guan-li/tong-ji/xiao-xi').set(授权头(签发管理令牌()));
    expect(响应.status).toBe(200);
    expect(查询记录.some((记录) => 记录.文本.includes('FROM "消息"') && 记录.文本.includes('GROUP BY'))).toBe(true);
  });

  it('好感度统计返回200且含均值聚合', async () => {
    const { 应用, 查询记录 } = 创建测试应用();
    const 响应 = await request(应用).get('/api/guan-li/tong-ji/hao-gan-du').set(授权头(签发管理令牌()));
    expect(响应.status).toBe(200);
    expect(查询记录.some((记录) => 记录.文本.includes('AVG('))).toBe(true);
  });

  it('天数非法返回400', async () => {
    const { 应用 } = 创建测试应用();
    const 头 = 授权头(签发管理令牌());
    for (const 天数 of ['0', 'abc', '999']) {
      const 响应 = await request(应用).get(`/api/guan-li/tong-ji/zhu-ce?tian_shu=${天数}`).set(头);
      expect(响应.status).toBe(400);
    }
  });

  it('统计天数参数化下发', async () => {
    const { 应用, 查询记录 } = 创建测试应用();
    await request(应用).get('/api/guan-li/tong-ji/zhu-ce?tian_shu=7').set(授权头(签发管理令牌()));
    expect(查询记录.some((记录) => 记录.参数.includes(7))).toBe(true);
  });
});
