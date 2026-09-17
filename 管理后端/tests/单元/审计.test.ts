import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { 创建测试应用, 签发管理令牌, 授权头 } from './测试辅助';

const 审计路径 = '/api/guan-li/shen-ji-ri-zhi';

describe('审计接口', () => {
  it('审计日志返回分页结构', async () => {
    const { 应用 } = 创建测试应用();
    const 响应 = await request(应用).get(审计路径).set(授权头(签发管理令牌()));
    expect(响应.status).toBe(200);
    expect(响应.body.cheng_gong).toBe(true);
    expect(响应.body.fen_ye.ye_ma).toBe(1);
    expect(响应.body.fen_ye.mei_ye_tiao_shu).toBe(20);
  });

  it('默认分页下发LIMIT20OFFSET0', async () => {
    const { 应用, 查询记录 } = 创建测试应用();
    await request(应用).get(审计路径).set(授权头(签发管理令牌()));
    const 审计查询 = 查询记录.filter((记录) => 记录.文本.includes('FROM "审计日志"'));
    expect(审计查询.length).toBeGreaterThan(0);
    expect(审计查询.some((记录) => 记录.参数.includes(20) && 记录.参数.includes(0))).toBe(true);
  });

  it('超限每页条数按上限裁剪', async () => {
    const { 应用, 查询记录 } = 创建测试应用();
    const 响应 = await request(应用).get(`${审计路径}?mei_ye_tiao_shu=9999`).set(授权头(签发管理令牌()));
    expect(响应.status).toBe(200);
    expect(响应.body.fen_ye.mei_ye_tiao_shu).toBe(100);
    expect(查询记录.some((记录) => 记录.参数.includes(100))).toBe(true);
  });

  it('事件类型筛选参数化', async () => {
    const { 应用, 查询记录 } = 创建测试应用();
    const 响应 = await request(应用).get(`${审计路径}?shi_jian_lei_xing=deng-lu`).set(授权头(签发管理令牌()));
    expect(响应.status).toBe(200);
    const 审计查询 = 查询记录.filter((记录) => 记录.文本.includes('FROM "审计日志"'));
    for (const 记录 of 审计查询) {
      expect(记录.文本).not.toContain('deng-lu');
    }
  });

  it('敏感读记审计并支持多维筛选', async () => {
    const { 应用, 查询记录 } = 创建测试应用();
    const 响应 = await request(应用)
      .get(`${审计路径}?yong_hu_id=11111111-1111-4111-8111-111111111111&lei_xing=guan_li`)
      .set(授权头(签发管理令牌()));
    expect(响应.status).toBe(200);
    expect(查询记录.some((记录) => 记录.文本.includes('INSERT INTO "审计日志"'))).toBe(true);
  });

  it('导出缺审批单返回400需审批单码', async () => {
    const { 应用 } = 创建测试应用();
    const 响应 = await request(应用).get('/api/guan-li/shen-ji-dao-chu').set(授权头(签发管理令牌()));
    expect(响应.status).toBe(400);
    expect(响应.body.cuo_wu_ma).toBe('XU_SHEN_PI_DAN');
  });

  it('导出带审批单回水印并记审计', async () => {
    const { 应用, 查询记录 } = 创建测试应用();
    const 响应 = await request(应用).get('/api/guan-li/shen-ji-dao-chu?shen_pi_dan=SP-001').set(授权头(签发管理令牌()));
    expect(响应.status).toBe(200);
    expect(String((响应.body.shu_ju as Record<string, unknown>)['shui_yin'] ?? '')).toContain('SP-001');
    expect(查询记录.some((记录) => 记录.文本.includes('INSERT INTO "审计日志"'))).toBe(true);
  });
});
