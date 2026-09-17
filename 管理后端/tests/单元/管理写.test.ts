import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { 创建测试应用, 签发管理令牌, 授权头, 创建模拟池, 默认行 } from './测试辅助';

const 有效编号 = '22222222-2222-4222-8222-222222222222';
const 操作者编号 = '11111111-1111-4111-8111-111111111111';

describe('管理写接口', () => {
  it('授权回收写入用户表并审计', async () => {
    const { 应用, 查询记录 } = 创建测试应用();
    const 头 = 授权头(签发管理令牌({ yongHuId: 操作者编号 }));
    const 授 = await request(应用).post('/api/guan-li/shou-quan').set(头).send({ yong_hu_id: 有效编号, que_ren: true });
    expect(授.status).toBe(200);
    const 收 = await request(应用).post('/api/guan-li/hui-shou').set(头).send({ yong_hu_id: 有效编号, que_ren: true });
    expect(收.status).toBe(200);
    expect(查询记录.some((记录) => 记录.文本.includes('UPDATE "用户" SET "管理员"'))).toBe(true);
    expect(查询记录.some((记录) => 记录.文本.includes('INSERT INTO "审计日志"'))).toBe(true);
  });

  it('高危授回收缺二次确认返回400需二次确认码', async () => {
    const { 应用 } = 创建测试应用();
    const 头 = 授权头(签发管理令牌({ yongHuId: 操作者编号 }));
    const 授 = await request(应用).post('/api/guan-li/shou-quan').set(头).send({ yong_hu_id: 有效编号 });
    expect(授.status).toBe(400);
    expect(授.body.cuo_wu_ma).toBe('XU_YAO_QUE_REN');
    const 收 = await request(应用).post('/api/guan-li/hui-shou').set(头).send({ yong_hu_id: 有效编号 });
    expect(收.status).toBe(400);
    expect(收.body.cuo_wu_ma).toBe('XU_YAO_QUE_REN');
  });

  it('回收后写入用户吊销并广播失效', async () => {
    const { 应用, 查询记录, 缓存表 } = 创建测试应用();
    const 头 = 授权头(签发管理令牌({ yongHuId: 操作者编号 }));
    const 收 = await request(应用).post('/api/guan-li/hui-shou').set(头).send({ yong_hu_id: 有效编号, que_ren: true });
    expect(收.status).toBe(200);
    expect(缓存表.get(`jwt_yong_hu_cheXiao:${有效编号}`)).not.toBeNull();
    expect(查询记录.some((记录) => 记录.文本.includes('UPDATE "用户" SET "管理员"'))).toBe(true);
  });

  it('不能变更自身返回400', async () => {
    const { 应用 } = 创建测试应用();
    const 响应 = await request(应用)
      .post('/api/guan-li/shou-quan')
      .set(授权头(签发管理令牌()))
      .send({ yong_hu_id: 有效编号, que_ren: true });
    expect(响应.status).toBe(400);
  });

  it('目标不存在返回404', async () => {
    const 自备 = 创建模拟池((文本, 参数) => {
      if (文本.includes('SELECT "管理员"')) {
        const 目标 = String((参数 ?? [])[0] ?? '');
        if (目标 === 有效编号) return [];
        return [{ 管理员: true }];
      }
      return [{ ID: 有效编号 }];
    });
    const { 应用 } = 创建测试应用({ 池: 自备.池 });
    const 响应 = await request(应用)
      .post('/api/guan-li/hui-shou')
      .set(授权头(签发管理令牌({ yongHuId: 操作者编号 })))
      .send({ yong_hu_id: 有效编号, que_ren: true });
    expect(响应.status).toBe(404);
  });

  it('夺舍归还写入夺舍日志并审计', async () => {
    const { 应用, 查询记录 } = 创建测试应用();
    const 头 = 授权头(签发管理令牌());
    const 夺 = await request(应用).post('/api/guan-li/duo-she').set(头).send({ jiao_se_id: 有效编号 });
    expect(夺.status).toBe(200);
    const 归 = await request(应用).post('/api/guan-li/gui-huan').set(头).send({ jiao_se_id: 有效编号 });
    expect(归.status).toBe(200);
    expect(查询记录.some((记录) => 记录.文本.includes('INSERT INTO "夺舍日志"'))).toBe(true);
    expect(查询记录.some((记录) => 记录.文本.includes('UPDATE "夺舍日志"'))).toBe(true);
  });

  it('账号封禁列表解封审核全链路', async () => {
    const { 应用, 查询记录 } = 创建测试应用();
    const 头 = 授权头(签发管理令牌());
    expect((await request(应用).get('/api/guan-li/zhang-hao-feng-jin').set(头)).status).toBe(200);
    expect(
      (await request(应用).post('/api/guan-li/zhang-hao-feng-jin/jie-feng').set(头).send({ yong_hu_id: 有效编号 })).status,
    ).toBe(200);
    expect(
      (await request(应用).post('/api/guan-li/shen-su/shen-he').set(头).send({ yong_hu_id: 有效编号, tong_guo: true })).status,
    ).toBe(200);
    expect(
      (await request(应用).post('/api/guan-li/shen-su/shen-he').set(头).send({ yong_hu_id: 有效编号, tong_guo: false })).status,
    ).toBe(200);
    expect(查询记录.some((记录) => 记录.文本.includes('FROM "账号封禁"'))).toBe(true);
  });

  it('YH-108 高危写仅超管：审核员越权403', async () => {
    const 审核池 = 创建模拟池((文本) => {
      if (文本.includes('SELECT "管理员"')) return [{ 管理员: false, 运营: false, 审核员: true }];
      return 默认行(文本);
    });
    const { 应用 } = 创建测试应用({ 池: 审核池.池 });
    const 审核员令牌 = 签发管理令牌({ yongHuId: '44444444-4444-4444-8444-444444444444' });
    const 头 = 授权头(审核员令牌);
    expect(
      (await request(应用).post('/api/guan-li/feng-jin').set(头).send({ yong_hu_id: 有效编号, yuan_yin: '测试' })).status,
    ).toBe(403);
  });

  it('YH-118 解封禁写正常态rowCount幂等：空行404', async () => {
    const 空池 = 创建模拟池((文本) => {
      if (文本.includes('SELECT "管理员"')) return [{ 管理员: true, 运营: false, 审核员: false }];
      return [];
    });
    const { 应用 } = 创建测试应用({ 池: 空池.池 });
    const 头 = 授权头(签发管理令牌());
    expect(
      (await request(应用).post('/api/guan-li/zhang-hao-feng-jin/jie-feng').set(头).send({ yong_hu_id: 有效编号 })).status,
    ).toBe(404);
  });

  it('YH-111 写入禁正常态：zheng_chang级别400', async () => {
    const { 应用 } = 创建测试应用();
    const 头 = 授权头(签发管理令牌());
    expect(
      (await request(应用).post('/api/guan-li/feng-jin').set(头).send({ yong_hu_id: 有效编号, yuan_yin: '测试', ji_bie: 'zheng_chang' })).status,
    ).toBe(400);
  });

  it('YH-028 LIKE通配符转义：关键词参数化无注入', async () => {
    const { 应用, 查询记录 } = 创建测试应用();
    const 头 = 授权头(签发管理令牌());
    const 响应 = await request(应用).get('/api/guan-li/zhang-hao-lie-biao?guan_jian_ci=%_%5C').set(头);
    expect(响应.status).toBe(200);
    for (const 记录 of 查询记录.filter((项) => 项.文本.includes('FROM "用户" u'))) {
      expect(记录.文本).toContain("ESCAPE '\\'");
    }
  });
});
