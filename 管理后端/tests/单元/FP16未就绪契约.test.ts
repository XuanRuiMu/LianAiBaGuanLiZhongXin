import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { 创建应用 } from '../../src/应用';
import { 创建模拟缓存, 创建模拟池, 创建测试应用, 授权头, 签发管理令牌 } from './测试辅助';

describe('FP-16 未就绪失败不得伪装成功', () => {
  it('只读表缺失返回503失败包络而不是200', async () => {
    const { 池 } = 创建模拟池((文本) => {
      if (文本.includes('SELECT "管理员"')) {
        return [{ 管理员: true, 运营: false, 审核员: false }];
      }
      throw new Error('relation "思考记录" does not exist');
    });
    const 响应 = await request(创建测试应用({ 池 }).应用)
      .get('/api/guan-li/si-kao-ji-lu')
      .set(授权头(签发管理令牌()));
    expect(响应.status).toBe(503);
    expect(响应.body.cheng_gong).toBe(false);
    expect(响应.body.cuo_wu_ma).toBe('BIAO_QUE_SHI_JIANG_JI');
    expect(响应.body.retryable).toBe(true);
  });

  it('就绪探针依赖未注入返回503失败包络', async () => {
    const { 缓存 } = 创建模拟缓存();
    const 响应 = await request(创建应用({ 缓存 })).get('/api/ready');
    expect(响应.status).toBe(503);
    expect(响应.body.cheng_gong).toBe(false);
    expect(响应.body.code).toBe('YI_LAI_QUE_SHI');
    expect(响应.body.retryable).toBe(true);
  });
});
