import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { 创建测试应用, 签发管理令牌, 授权头, 创建模拟池 } from './测试辅助';

const 列表路径 = '/api/guan-li/zhang-hao-lie-biao';

describe('账号接口', () => {
  it('账号列表返回分页结构', async () => {
    const { 应用 } = 创建测试应用();
    const 响应 = await request(应用).get(列表路径).set(授权头(签发管理令牌()));
    expect(响应.status).toBe(200);
    expect(响应.body.cheng_gong).toBe(true);
    expect(Array.isArray(响应.body.shu_ju)).toBe(true);
    expect(响应.body.fen_ye.ye_ma).toBe(1);
    expect(响应.body.fen_ye.mei_ye_tiao_shu).toBe(20);
    expect(typeof 响应.body.fen_ye.zong_shu).toBe('number');
  });

  it('关键词查询全部参数化', async () => {
    const { 应用, 查询记录 } = 创建测试应用();
    const 响应 = await request(应用)
      .get(`${列表路径}?guan_jian_ci=zhang-san`)
      .set(授权头(签发管理令牌()));
    expect(响应.status).toBe(200);
    const 列表查询 = 查询记录.filter((记录) => 记录.文本.includes('FROM "用户" u'));
    expect(列表查询.length).toBeGreaterThan(0);
    for (const 记录 of 列表查询) {
      expect(记录.文本).not.toContain('zhang-san');
      expect(记录.参数.some((参数) => String(参数).includes('zhang-san'))).toBe(true);
    }
  });

  it('手机号格式非法返回400', async () => {
    const { 应用 } = 创建测试应用();
    const 响应 = await request(应用)
      .get(`${列表路径}?shou_ji_hao=abc`)
      .set(授权头(签发管理令牌()));
    expect(响应.status).toBe(400);
    expect(响应.body.ti_shi).toMatch(/[\u4e00-\u9fa5]/);
  });

  it('详情ID非法直接400防22P02', async () => {
    const { 应用, 查询记录 } = 创建测试应用();
    const 响应 = await request(应用)
      .get('/api/guan-li/zhang-hao-xiang-qing/bu-shi-uuid')
      .set(授权头(签发管理令牌()));
    expect(响应.status).toBe(400);
    const 详情查询 = 查询记录.filter(
      (记录) => 记录.文本.includes('FROM "用户"') && !记录.文本.includes('SELECT "管理员"'),
    );
    expect(详情查询.length).toBe(0);
  });

  it('详情不存在返回404', async () => {
    const { 池 } = 创建模拟池((文本) => {
      if (文本.includes('SELECT "管理员"')) return [{ 管理员: true }];
      return [];
    });
    const { 应用 } = 创建测试应用({ 池 });
    const 响应 = await request(应用)
      .get('/api/guan-li/zhang-hao-xiang-qing/11111111-1111-4111-8111-111111111111')
      .set(授权头(签发管理令牌()));
    expect(响应.status).toBe(404);
  });

  it('未知封禁态参数被忽略仍返回200', async () => {
    const { 应用 } = 创建测试应用();
    const 响应 = await request(应用)
      .get(`${列表路径}?feng_jin_tai=wei-zhi-tai`)
      .set(授权头(签发管理令牌()));
    expect(响应.status).toBe(200);
    expect(响应.body.cheng_gong).toBe(true);
  });

  it('账号列表默认掩码手机号不回明文', async () => {
    const { 应用 } = 创建测试应用();
    const 响应 = await request(应用).get(列表路径).set(授权头(签发管理令牌()));
    expect(响应.status).toBe(200);
    for (const 行 of 响应.body.shu_ju as Array<Record<string, unknown>>) {
      expect(String(行['手机号'] ?? '')).not.toMatch(/^1\d{10}$/);
    }
  });

  it('账号详情读记审计并掩码', async () => {
    const { 应用, 查询记录 } = 创建测试应用();
    const 响应 = await request(应用)
      .get('/api/guan-li/zhang-hao-xiang-qing/11111111-1111-4111-8111-111111111111')
      .set(授权头(签发管理令牌()));
    expect(响应.status).toBe(200);
    expect(String((响应.body.shu_ju as Record<string, unknown>)['手机号'] ?? '')).not.toMatch(/^1\d{10}$/);
    expect(查询记录.some((记录) => 记录.文本.includes('INSERT INTO "审计日志"'))).toBe(true);
  });

  it('解密接口回明文并记审计', async () => {
    const { 应用, 查询记录 } = 创建测试应用();
    const 响应 = await request(应用)
      .get('/api/guan-li/zhang-hao-jie-mi/11111111-1111-4111-8111-111111111111')
      .set(授权头(签发管理令牌()));
    expect(响应.status).toBe(200);
    expect(查询记录.some((记录) => 记录.文本.includes('INSERT INTO "审计日志"'))).toBe(true);
  });

  it('账号查询左连账号封禁读封禁态', async () => {
    const { 应用, 查询记录 } = 创建测试应用();
    await request(应用).get(列表路径).set(授权头(签发管理令牌()));
    expect(查询记录.some((记录) => 记录.文本.includes('LEFT JOIN "账号封禁"'))).toBe(true);
    expect(查询记录.some((记录) => 记录.文本.includes('"封禁级别"'))).toBe(true);
  });
});
