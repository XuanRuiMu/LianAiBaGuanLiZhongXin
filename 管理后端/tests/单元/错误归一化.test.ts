import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { 创建应用 } from '../../src/应用';
import { 校验失败, 记录缺失 } from '../../src/校验';
import { 归一化错误, 可降级为表缺失, 错误类别 } from '../../src/错误归一化';
import { 全部错误码, 错误注册表, 取错误定义 } from '../../src/错误码';
import { 脱敏日志详情 } from '../../src/日志';
import { 清空管理员缓存 } from '../../src/中间件/管理员';
import { 创建模拟池, 创建模拟缓存, 签发管理令牌, 授权头, 创建测试应用 } from './测试辅助';

function 数据库错误(状态码: string, 消息: string): Error {
  return Object.assign(new Error(消息), { code: 状态码 });
}

function 断言失败包络(响应体: Record<string, unknown>, 错误码: string, 可重试: boolean): void {
  expect(响应体['code']).toBe(错误码);
  expect(响应体['cuo_wu_ma']).toBe(错误码);
  expect(响应体['message']).toBe(响应体['ti_shi']);
  expect(typeof 响应体['message']).toBe('string');
  expect(String(响应体['message'])).toMatch(/[\u4e00-\u9fa5]/);
  expect(typeof 响应体['traceId']).toBe('string');
  expect(String(响应体['traceId']).length).toBeGreaterThan(0);
  expect(响应体['retryable']).toBe(可重试);
}

describe('FP-15 错误码注册表', () => {
  it('码值唯一且每项都有状态与可重试元数据', () => {
    const 码值 = Object.values(错误注册表).map((项) => 项.code);
    expect(new Set(码值).size).toBe(码值.length);
    expect([...全部错误码].sort()).toEqual([...码值].sort());
    for (const 码 of 全部错误码) {
      const 定义 = 取错误定义(码);
      expect(定义).toBeDefined();
      expect(Number.isInteger(定义?.状态码)).toBe(true);
      expect(typeof 定义?.可重试).toBe('boolean');
    }
    expect(取错误定义('XIN_ZENG_MA')).toBeUndefined();
  });
});

describe('错误归一化分类', () => {
  it('列不存在归为模式缺失，不再落入通用内部错误', () => {
    const 结果 = 归一化错误(数据库错误('42703', 'column "运营" does not exist'));
    expect(结果.类别).toBe(错误类别.模式缺失);
    expect(结果.状态码).toBe(500);
    expect(结果.错误码).toBe('MO_SHI_QUE_SHI');
  });

  it('表不存在可降级，列不存在禁止降级', () => {
    expect(可降级为表缺失(数据库错误('42P01', 'relation "思考记录" does not exist'))).toBe(true);
    expect(可降级为表缺失(数据库错误('42703', 'column "运营" does not exist'))).toBe(false);
    expect(可降级为表缺失(new Error('relation "思考记录" does not exist'))).toBe(true);
    expect(可降级为表缺失(new Error('column "运营" does not exist'))).toBe(false);
  });

  it('连接类SQLSTATE归为数据库，与依赖未注入区分', () => {
    expect(归一化错误(数据库错误('08006', 'connection failure')).错误码).toBe('SHU_JU_KU_CUO_WU');
    expect(归一化错误(数据库错误('57014', 'canceling statement due to statement timeout')).错误码).toBe('SHU_JU_KU_CUO_WU');
  });

  it('连接池取不到连接的传输层errno同样归为数据库', () => {
    expect(归一化错误(Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:5432'), { code: 'ECONNREFUSED' })).错误码).toBe('SHU_JU_KU_CUO_WU');
    expect(归一化错误(Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' })).类别).toBe(错误类别.数据库);
  });

  it('无SQLSTATE仅消息的列缺失仍归模式缺失，不落未知', () => {
    expect(归一化错误(new Error('column "审核员" does not exist')).错误码).toBe('MO_SHI_QUE_SHI');
  });

  it('业务异常保持原状态码与错误码', () => {
    expect(归一化错误(new 校验失败('参数不对'))).toEqual({
      类别: 错误类别.业务,
      状态码: 400,
      错误码: 'CAN_SHU_CUO_WU',
      提示: '参数不对',
    });
    expect(归一化错误(new 记录缺失('账号不存在')).错误码).toBe('WEI_ZHAO_DAO');
    expect(归一化错误(new 记录缺失('账号不存在')).状态码).toBe(404);
  });

  it('无信号异常仍为未知内部错误', () => {
    expect(归一化错误(new Error('boom')).错误码).toBe('NEI_BU_CUO_WU');
    expect(归一化错误('boom').状态码).toBe(500);
  });
});

describe('门禁与降级走同一归一化入口', () => {
  it('缺查询池返回依赖缺失而非通用内部错误', async () => {
    const { 缓存 } = 创建模拟缓存();
    清空管理员缓存();
    const 应用 = 创建应用({ 缓存 });
    const 响应 = await request(应用).get('/api/guan-li/zhang-hao-lie-biao').set(授权头(签发管理令牌()));
    expect(响应.status).toBe(503);
    expect(响应.body.cuo_wu_ma).toBe('YI_LAI_QUE_SHI');
  });

  it('缺缓存依赖返回缓存不可用而非通用内部错误', async () => {
    const { 池 } = 创建模拟池();
    清空管理员缓存();
    const 应用 = 创建应用({ 池 });
    const 响应 = await request(应用).get('/api/guan-li/zhang-hao-lie-biao').set(授权头(签发管理令牌()));
    expect(响应.status).toBe(503);
    expect(响应.body.cuo_wu_ma).toBe('HUAN_CUN_BU_KE_YONG');
  });

  it('RBAC列缺失在门禁处暴露为模式缺失且不泄漏内部细节', async () => {
    const { 池 } = 创建模拟池((文本) => {
      if (文本.includes('"运营", "审核员"')) {
        throw 数据库错误('42703', 'column "运营" does not exist');
      }
      return [{ 管理员: true, 运营: false, 审核员: false }];
    });
    const { 应用 } = 创建测试应用({ 池 });
    const 响应 = await request(应用).get('/api/guan-li/zhang-hao-lie-biao').set(授权头(签发管理令牌()));
    expect(响应.status).toBe(500);
    expect(响应.body.cuo_wu_ma).toBe('MO_SHI_QUE_SHI');
    expect(JSON.stringify(响应.body)).not.toContain('42703');
    expect(JSON.stringify(响应.body)).not.toContain('does not exist');
  });

  it('只读降级点：列缺失不再被吞成表未迁移', async () => {
    const { 池 } = 创建模拟池((文本) => {
      if (文本.includes('"运营", "审核员"')) {
        return [{ 管理员: true, 运营: false, 审核员: false }];
      }
      throw 数据库错误('42703', 'column "原文长度" does not exist');
    });
    const { 应用 } = 创建测试应用({ 池 });
    const 响应 = await request(应用).get('/api/guan-li/si-kao-ji-lu').set(授权头(签发管理令牌()));
    expect(响应.status).toBe(500);
    expect(响应.body.cuo_wu_ma).toBe('MO_SHI_QUE_SHI');
  });

  it('只读降级点：表缺失返回503失败包络', async () => {
    const { 池 } = 创建模拟池((文本) => {
      if (文本.includes('"运营", "审核员"')) {
        return [{ 管理员: true, 运营: false, 审核员: false }];
      }
      throw new Error('relation "思考记录" does not exist');
    });
    const { 应用 } = 创建测试应用({ 池 });
    const 响应 = await request(应用).get('/api/guan-li/si-kao-ji-lu').set(授权头(签发管理令牌()));
    expect(响应.status).toBe(503);
    expect(响应.body.cuo_wu_ma).toBe('BIAO_QUE_SHI_JIANG_JI');
  });
});

describe('FP-15 HTTP 与健康检查失败契约', () => {
  it('401、403、404、409、429 都返回完整稳定包络', async () => {
    const 无凭证 = await request(创建测试应用().应用).get('/api/guan-li/zhang-hao-lie-biao');
    expect(无凭证.status).toBe(401);
    断言失败包络(无凭证.body, 'WEI_SHOU_QUAN', false);

    const 越权 = await request(创建测试应用({ 管理员: false }).应用)
      .get('/api/guan-li/zhang-hao-lie-biao')
      .set(授权头(签发管理令牌()));
    expect(越权.status).toBe(403);
    断言失败包络(越权.body, 'WU_GUAN_LI_QUAN_XIAN', false);

    const 不存在 = await request(创建测试应用().应用).get('/api/bu-cun-zai').set('X-Request-Id', 'fp15-not-found');
    expect(不存在.status).toBe(404);
    断言失败包络(不存在.body, 'WEI_ZHAO_DAO', false);
    expect(不存在.body.traceId).toBe('fp15-not-found');

    const 空更新 = 创建模拟池((文本) => {
      if (文本.includes('SELECT "管理员"')) {
        return [{ 管理员: true, 运营: false, 审核员: false }];
      }
      return [];
    }).池;
    const 冲突 = await request(创建测试应用({ 池: 空更新 }).应用)
      .post('/api/guan-li/ju-bao-yi-shen')
      .set(授权头(签发管理令牌()))
      .send({ mu_biao_id: '11111111-1111-4111-8111-111111111111', tong_guo: true });
    expect(冲突.status).toBe(409);
    断言失败包络(冲突.body, 'SHEN_HE_DUI_XIANG_YI_BIAN', true);

    const 限流应用 = 创建应用({ 写限流: { 上限: 1, 窗口毫秒: 60_000 } });
    await request(限流应用).post('/api/guan-li/deng-lu').send({ shou_ji_hao: '13800000000', mi_ma: 'abcdef1', chi_jiu_hui_hua: false });
    const 限流 = await request(限流应用).post('/api/guan-li/deng-lu').send({ shou_ji_hao: '13800000000', mi_ma: 'abcdef1', chi_jiu_hui_hua: false });
    expect(限流.status).toBe(429);
    断言失败包络(限流.body, 'XIAN_LIU', true);
    expect(限流.body.retryAfterMs).toEqual(expect.any(Number));
    expect(Number(限流.body.retryAfterMs)).toBeGreaterThan(0);
  });

  it('依赖不可用、业务失败与健康检查失败均有稳定码和可重试语义', async () => {
    const { 缓存 } = 创建模拟缓存();
    const 缺库 = await request(创建应用({ 缓存 }))
      .get('/api/guan-li/zhang-hao-lie-biao')
      .set(授权头(签发管理令牌()));
    expect(缺库.status).toBe(503);
    断言失败包络(缺库.body, 'YI_LAI_QUE_SHI', true);

    const 业务 = await request(创建测试应用().应用)
      .get('/api/guan-li/si-kao-ji-lu?yong_hu_id=bad-id')
      .set(授权头(签发管理令牌()));
    expect(业务.status).toBe(400);
    断言失败包络(业务.body, 'CAN_SHU_CUO_WU', false);
    expect(业务.body.fieldErrors).toEqual({ yong_hu_id: '用户编号格式不正确' });

    const 健康 = await request(创建应用({ 缓存 })).get('/api/ready');
    expect(健康.status).toBe(503);
    断言失败包络(健康.body, 'YI_LAI_QUE_SHI', true);
    expect(JSON.stringify(健康.body)).not.toMatch(/postgres|redis|database|stack|environment/i);
  });
});

describe('FP-15 日志脱敏', () => {
  it('递归移除密码、Cookie、令牌与 API key 原值', () => {
    const 清洗 = 脱敏日志详情({
      错误: 'password=密文 Cookie: 会话=秘密 token=访问值 api_key=接口密钥 Authorization: Bearer 签名值',
      路径: '/api/guan-li/deng-lu',
      嵌套: {
        密码: '登录密码',
        Cookie: 'guan_li_ling_pai=令牌值',
        access_token: '访问值',
        apiKey: '接口密钥',
        安全字段: '可保留',
      },
      清单: [{ token: '刷新值' }, { message: '普通诊断' }],
    });
    const 文本 = JSON.stringify(清洗);
    for (const 秘密 of ['密文', '秘密', '访问值', '接口密钥', '签名值', '登录密码', '令牌值', '刷新值']) {
      expect(文本).not.toContain(秘密);
    }
    expect(文本).not.toMatch(/password|cookie|token|api[_ -]?key|authorization/i);
    expect(文本).toContain('/api/guan-li/deng-lu');
    expect(文本).toContain('普通诊断');
  });
});
