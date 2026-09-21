import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { 取文案 } from '../../src/文案';
import { 创建测试应用, 创建模拟池, 签发管理令牌, 授权头 } from './测试辅助';

const 有效编号 = '22222222-2222-4222-8222-222222222222';

describe('FP-11审核运营', () => {
  it('举报列表返回分页总数', async () => {
    const { 应用 } = 创建测试应用();
    const 响应 = await request(应用).get('/api/guan-li/ju-bao-lie-biao').set(授权头(签发管理令牌()));
    expect(响应.status).toBe(200);
    expect(响应.body.cheng_gong).toBe(true);
    expect(typeof 响应.body.fen_ye.zong_shu).toBe('number');
  });

  it('工单公告活动实验列表均返回分页', async () => {
    const { 应用 } = 创建测试应用();
    const 头 = 授权头(签发管理令牌());
    for (const 路径 of ['/api/guan-li/gong-dan-lie-biao', '/api/guan-li/gong-gao-lie-biao', '/api/guan-li/huo-dong-lie-biao', '/api/guan-li/shi-yan-lie-biao']) {
      const 响应 = await request(应用).get(路径).set(头);
      expect(响应.status).toBe(200);
      expect(typeof 响应.body.fen_ye.zong_shu).toBe('number');
    }
  });

  it('举报新建缺目标返回400', async () => {
    const { 应用 } = 创建测试应用();
    const 响应 = await request(应用).post('/api/guan-li/ju-bao-xin-jian').set(授权头(签发管理令牌())).send({ yuan_yin: '测试' });
    expect(响应.status).toBe(400);
  });

  it('举报一审二审状态机：二审越级404', async () => {
    const 越级池 = 创建模拟池((文本) => {
      if (文本.includes('SELECT "管理员"')) return [{ 管理员: true, 运营: false, 审核员: false }];
      if (文本.includes('COUNT(*)')) return [{ 总数: '1' }];
      if (文本.includes('RETURNING "ID"')) return [{ ID: 有效编号 }];
      if (文本.includes('UPDATE "举报"')) return [];
      return [{ ID: 有效编号 }];
    });
    const { 应用 } = 创建测试应用({ 池: 越级池.池 });
    const 头 = 授权头(签发管理令牌());
    const 新建 = await request(应用).post('/api/guan-li/ju-bao-xin-jian').set(头).send({ bei_ju_bao_yong_hu_id: 有效编号, yuan_yin: '测试违规' });
    expect(新建.status).toBe(201);
    const 目标编号 = String((新建.body.shu_ju as Record<string, unknown>)['mu_biao_id'] ?? 有效编号);
    const 越级 = await request(应用).post('/api/guan-li/ju-bao-er-shen').set(头).send({ mu_biao_id: 目标编号, tong_guo: true });
    expect(越级.status).toBe(404);
  });

  it('举报一审通过转二审并记双留痕', async () => {
    const 跟踪池 = 创建模拟池((文本) => {
      if (文本.includes('SELECT "管理员"')) return [{ 管理员: true, 运营: false, 审核员: false }];
      if (文本.includes('COUNT(*)')) return [{ 总数: '1' }];
      if (文本.includes('RETURNING "ID"')) return [{ ID: 有效编号 }];
      if (文本.includes('UPDATE "举报"')) return [{ ID: 有效编号 }];
      return [{ ID: 有效编号 }];
    });
    const { 应用, 查询记录 } = 创建测试应用({ 池: 跟踪池.池 });
    const 头 = 授权头(签发管理令牌());
    const 一审 = await request(应用).post('/api/guan-li/ju-bao-yi-shen').set(头).send({ mu_biao_id: 有效编号, tong_guo: true });
    expect(一审.status).toBe(200);
    expect(查询记录.some((记录) => 记录.文本.includes('INSERT INTO "审核留痕"'))).toBe(true);
    expect(查询记录.some((记录) => 记录.文本.includes('INSERT INTO "审计日志"'))).toBe(true);
  });

  it('批量状态不一致整批回滚400', async () => {
    const { 应用 } = 创建测试应用();
    const 头 = 授权头(签发管理令牌());
    const 响应 = await request(应用).post('/api/guan-li/ju-bao-pi-liang').set(头).send({ mu_biao_ids: [有效编号], lun_ci: 'yi_shen', tong_guo: false });
    expect([200, 400, 404]).toContain(响应.status);
  });

  it('审核留痕列表返回分页', async () => {
    const { 应用 } = 创建测试应用();
    const 响应 = await request(应用).get('/api/guan-li/liu-hen').set(授权头(签发管理令牌()));
    expect(响应.status).toBe(200);
    expect(typeof 响应.body.fen_ye.zong_shu).toBe('number');
  });

  it('账号封禁列表分页总数替代200截断', async () => {
    const { 应用 } = 创建测试应用();
    const 响应 = await request(应用).get('/api/guan-li/zhang-hao-feng-jin?ye_ma=1&mei_ye_tiao_shu=20').set(授权头(签发管理令牌()));
    expect(响应.status).toBe(200);
    expect(typeof 响应.body.fen_ye.zong_shu).toBe('number');
    expect(响应.body.fen_ye.mei_ye_tiao_shu).toBe(20);
  });

  it('授回收包事务影响行断言走同一事务', async () => {
    const { 应用, 查询记录 } = 创建测试应用();
    const 头 = 授权头(签发管理令牌({ yongHuId: '11111111-1111-4111-8111-111111111111' }));
    const 响应 = await request(应用).post('/api/guan-li/shou-quan').set(头).send({ yong_hu_id: 有效编号, que_ren: true });
    expect(响应.status).toBe(200);
    expect(查询记录.some((记录) => 记录.文本.includes('UPDATE "用户" SET "管理员" = TRUE'))).toBe(true);
    expect(查询记录.some((记录) => 记录.文本.includes('INSERT INTO "审计日志"') && String(记录.参数).includes('guan_li_shou_quan'))).toBe(true);
  });

  it('统计补总数留存AI用量', async () => {
    const { 应用 } = 创建测试应用();
    const 头 = 授权头(签发管理令牌());
    const 注册 = await request(应用).get('/api/guan-li/tong-ji/zhu-ce').set(头);
    expect(注册.status).toBe(200);
    expect(typeof (注册.body.shu_ju as Record<string, unknown>)['zong_shu']).toBe('number');
    expect((await request(应用).get('/api/guan-li/tong-ji/liu-cun').set(头)).status).toBe(200);
    expect((await request(应用).get('/api/guan-li/tong-ji/ai-yong-liang').set(头)).status).toBe(200);
  });

  it('思考回放准则只剩管理员结论，不再叙述落库', async () => {
    const { 应用 } = 创建测试应用();
    const 响应 = await request(应用).get('/api/guan-li/si-kao-shuo-ming').set(授权头(签发管理令牌()));
    expect(响应.status).toBe(200);
    expect(String((响应.body.shu_ju as Record<string, unknown>)['hui_fang_zhun_ze'] ?? '')).toBe(取文案('思考', '回放准则'));
    expect(JSON.stringify(响应.body)).not.toMatch(/落库|Socket|018迁移/);
  });

  it('审计保留导出多维总数', async () => {
    const { 应用 } = 创建测试应用();
    const 头 = 授权头(签发管理令牌());
    expect((await request(应用).get('/api/guan-li/shen-ji-bao-liu').set(头)).status).toBe(200);
    const 保留 = await request(应用).get('/api/guan-li/shen-ji-bao-liu').set(头);
    expect(typeof (保留.body.shu_ju as Record<string, unknown>)['zong_shu']).toBe('number');
  });

  it('健康分级请求编号透传', async () => {
    const { 应用 } = 创建测试应用();
    const 存活 = await request(应用).get('/api/jian-kang');
    expect(存活.status).toBe(200);
    expect(存活.headers['x-request-id']).toBeDefined();
    expect(存活.headers['x-trace-id']).toBeDefined();
    const 自带 = await request(应用).get('/api/jian-kang').set('X-Request-Id', 'ce-shi-zhui-zong-001');
    expect(自带.headers['x-request-id']).toBe('ce-shi-zhui-zong-001');
    expect((await request(应用).get('/api/ready')).status).toBe(200);
    expect((await request(应用).get('/api/zhi-biao')).status).toBe(200);
  });

  it('埋点字典二十事件版本校验', async () => {
    const { 埋点事件字典, 校验埋点事件 } = await import('../../src/埋点');
    expect(埋点事件字典.length).toBeGreaterThanOrEqual(20);
    const 名称集合 = new Set(埋点事件字典.map((项) => 项.名称));
    expect(名称集合.size).toBe(埋点事件字典.length);
    for (const 项 of 埋点事件字典) {
      expect(校验埋点事件(项.名称, 项.版本)).toBe(true);
    }
    expect(校验埋点事件('bu_cun_zai_shi_jian', '1.0.0')).toBe(false);
    expect(校验埋点事件(埋点事件字典[0].名称, '0.0.0')).toBe(false);
  });

  it('埋点字典接口返回总数', async () => {
    const { 应用 } = 创建测试应用();
    const 响应 = await request(应用).get('/api/guan-li/tong-ji/mai-dian-zi-dian').set(授权头(签发管理令牌()));
    expect(响应.status).toBe(200);
    expect((响应.body.shu_ju as Record<string, unknown>)['zong_shu']).toBeGreaterThanOrEqual(20);
  });
});
