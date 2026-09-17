import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { 创建测试应用, 创建模拟池, 签发管理令牌, 授权头 } from './测试辅助';

const 思考路径 = ['ji-yi', 'dui-hua-zhai-yao', 'guan-jian-shi-jian', 'duo-she-ri-zhi', 'ping-gu'];

describe('AI思考接口', () => {
  for (const 路径 of 思考路径) {
    it(`${路径}查询返回200`, async () => {
      const { 应用 } = 创建测试应用();
      const 响应 = await request(应用).get(`/api/guan-li/${路径}`).set(授权头(签发管理令牌()));
      expect(响应.status).toBe(200);
      expect(响应.body.cheng_gong).toBe(true);
    });
  }

  it('思考查询ID非法返回400', async () => {
    const { 应用 } = 创建测试应用();
    const 响应 = await request(应用)
      .get('/api/guan-li/ji-yi?yong_hu_id=not-uuid')
      .set(授权头(签发管理令牌()));
    expect(响应.status).toBe(400);
  });

  it('思考说明披露独立持久化表已落地', async () => {
    const { 应用 } = 创建测试应用();
    const 响应 = await request(应用).get('/api/guan-li/si-kao-shuo-ming').set(授权头(签发管理令牌()));
    expect(响应.status).toBe(200);
    const 正文 = JSON.stringify(响应.body);
    expect(响应.body.shu_ju.you_du_li_si_kao_chi_jiu_hua_biao).toBe(true);
    expect(响应.body.shu_ju.yi_chi_jiu_hua_cha_xun).toContain('思考记录');
    expect(响应.body.shu_ju.dan_tiao_jie_duan_zi_fu_shu).toBe(1500);
    expect(响应.body.shu_ju.shi_shi_shi_jian).toContain('管理员_深度思考');
    expect(正文).not.toContain('undefined');
  });

  it('思考记录列表缺表降级不500', async () => {
    const { 池 } = 创建模拟池((_文本) => {
      if (_文本.includes('SELECT "管理员"')) return [{ 管理员: true }];
      throw new Error('relation "思考记录" does not exist');
    });
    const { 应用 } = 创建测试应用({ 池 });
    const 响应 = await request(应用).get('/api/guan-li/si-kao-ji-lu').set(授权头(签发管理令牌()));
    expect(响应.status).toBe(200);
    expect(响应.body.cuo_wu_ma).toBe('BIAO_QUE_SHI_JIANG_JI');
  });

  it('思考记录列表正常返回分页', async () => {
    const { 应用 } = 创建测试应用();
    const 响应 = await request(应用).get('/api/guan-li/si-kao-ji-lu').set(授权头(签发管理令牌()));
    expect(响应.status).toBe(200);
    expect(响应.body.cheng_gong).toBe(true);
  });

  it('思考记录事件筛选参数化', async () => {
    const { 应用, 查询记录 } = 创建测试应用();
    const 响应 = await request(应用)
      .get('/api/guan-li/si-kao-ji-lu?shi_jian=guan-li-yuan-shen-du-si-kao')
      .set(授权头(签发管理令牌()));
    expect(响应.status).toBe(200);
    for (const 记录 of 查询记录.filter((项) => 项.文本.includes('FROM "思考记录"'))) {
      expect(记录.文本).not.toContain('guan-li-yuan-shen-du-si-kao');
    }
  });
});
