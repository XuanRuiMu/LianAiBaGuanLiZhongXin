import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { 创建测试应用, 创建模拟池, 签发管理令牌, 授权头, 测试用户编号, 测试令牌编号 } from './测试辅助';

const 列表路径 = '/api/guan-li/zhang-hao-lie-biao';

describe('管理鉴权链', () => {
  it('缺鉴权头返回401与未授权码', async () => {
    const { 应用 } = 创建测试应用();
    const 响应 = await request(应用).get(列表路径);
    expect(响应.status).toBe(401);
    expect(响应.body.cuo_wu_ma).toBe('WEI_SHOU_QUAN');
    expect(响应.body.ti_shi).toMatch(/[\u4e00-\u9fa5]/);
  });

  it('错误头格式返回401', async () => {
    const { 应用 } = 创建测试应用();
    const 响应 = await request(应用).get(列表路径).set('Authorization', 'Token abc');
    expect(响应.status).toBe(401);
    expect(响应.body.cuo_wu_ma).toBe('WEI_SHOU_QUAN');
  });

  it('伪造签名返回401令牌无效', async () => {
    const { 应用 } = 创建测试应用();
    const 响应 = await request(应用).get(列表路径).set(授权头('wei-zao.ling-pai.qian-ming'));
    expect(响应.status).toBe(401);
    expect(响应.body.cuo_wu_ma).toBe('LING_PAI_WU_XIAO');
  });

  it('过期令牌返回401令牌无效', async () => {
    const { 应用 } = 创建测试应用();
    const 过期令牌 = jwt.sign(
      { yongHuId: 测试用户编号, shouJiHao: '13800000000', exp: Math.floor(Date.now() / 1000) - 10 },
      String(process.env.JWT_SECRET),
      { jwtid: 测试令牌编号 },
    );
    const 响应 = await request(应用).get(列表路径).set(授权头(过期令牌));
    expect(响应.status).toBe(401);
    expect(响应.body.cuo_wu_ma).toBe('LING_PAI_WU_XIAO');
  });

  it('命中黑名单返回401', async () => {
    const { 应用, 缓存表 } = 创建测试应用();
    缓存表.set(`jwt_blacklist:${测试令牌编号}`, '1');
    const 响应 = await request(应用).get(列表路径).set(授权头(签发管理令牌()));
    expect(响应.status).toBe(401);
    expect(响应.body.cuo_wu_ma).toBe('LING_PAI_WU_XIAO');
  });

  it('命中用户吊销返回401', async () => {
    const { 应用, 缓存表 } = 创建测试应用();
    缓存表.set(`jwt_yong_hu_cheXiao:${测试用户编号}`, String(Date.now() + 60000));
    const 响应 = await request(应用).get(列表路径).set(授权头(签发管理令牌()));
    expect(响应.status).toBe(401);
    expect(响应.body.cuo_wu_ma).toBe('LING_PAI_WU_XIAO');
  });

  it('服务间令牌不能充当管理凭证', async () => {
    const { 应用 } = 创建测试应用();
    const 响应 = await request(应用).get(列表路径).set('X-Internal-Token', 'nei-bu-ling-pai');
    expect(响应.status).toBe(401);
  });

  it('非管理员返回403', async () => {
    const { 应用 } = 创建测试应用({ 管理员: false });
    const 响应 = await request(应用).get(列表路径).set(授权头(签发管理令牌()));
    expect(响应.status).toBe(403);
    expect(响应.body.ti_shi).toMatch(/[\u4e00-\u9fa5]/);
  });

  it('缓存不可用返回500与缓存码而非401', async () => {
    const { 池 } = 创建模拟池((文本) => {
      if (文本.includes('SELECT "管理员"')) return [{ 管理员: true }];
      return [{ ID: '11111111-1111-4111-8111-111111111111' }];
    });
    const 坏缓存 = {
      get: async (_键: string): Promise<string | null> => {
        void _键;
        throw new Error('WRONGPASS');
      },
      set: async (_键: string, _值: string): Promise<unknown> => {
        void _键;
        void _值;
        return 'OK';
      },
      del: async (_键: string): Promise<unknown> => {
        void _键;
        return 0;
      },
      publish: async (): Promise<unknown> => 0,
      subscribe: async (): Promise<() => void> => () => undefined,
    };
    const { 应用 } = 创建测试应用({ 池, 缓存: 坏缓存 });
    const 响应 = await request(应用).get(列表路径).set(授权头(签发管理令牌()));
    expect(响应.status).toBe(503);
    expect(响应.body.cuo_wu_ma).toBe('HUAN_CUN_BU_KE_YONG');
    expect(响应.body.ti_shi).toMatch(/[\u4e00-\u9fa5]/);
  });

  it('旧版sub字段回退取身份', async () => {
    const { 应用 } = 创建测试应用();
    const 令牌 = jwt.sign({ sub: 测试用户编号, shouJiHao: '13800000000' }, String(process.env.JWT_SECRET), {
      expiresIn: '1h',
      jwtid: 'sub-hui-tui-jti',
    });
    const 响应 = await request(应用).get(列表路径).set(授权头(令牌));
    expect(响应.status).toBe(200);
  });
});
