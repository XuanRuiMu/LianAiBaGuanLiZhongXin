import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { 创建应用 } from '../../src/应用';
import { 校验失败, 记录缺失 } from '../../src/校验';
import { 归一化错误, 可降级为表缺失, 错误类别 } from '../../src/错误归一化';
import { 清空管理员缓存 } from '../../src/中间件/管理员';
import { 创建模拟池, 创建模拟缓存, 签发管理令牌, 授权头, 创建测试应用 } from './测试辅助';

function 数据库错误(状态码: string, 消息: string): Error {
  return Object.assign(new Error(消息), { code: 状态码 });
}

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
    expect(响应.status).toBe(500);
    expect(响应.body.cuo_wu_ma).toBe('YI_LAI_QUE_SHI');
  });

  it('缺缓存依赖返回缓存不可用而非通用内部错误', async () => {
    const { 池 } = 创建模拟池();
    清空管理员缓存();
    const 应用 = 创建应用({ 池 });
    const 响应 = await request(应用).get('/api/guan-li/zhang-hao-lie-biao').set(授权头(签发管理令牌()));
    expect(响应.status).toBe(500);
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

  it('只读降级点：表缺失维持200降级契约', async () => {
    const { 池 } = 创建模拟池((文本) => {
      if (文本.includes('"运营", "审核员"')) {
        return [{ 管理员: true, 运营: false, 审核员: false }];
      }
      throw new Error('relation "思考记录" does not exist');
    });
    const { 应用 } = 创建测试应用({ 池 });
    const 响应 = await request(应用).get('/api/guan-li/si-kao-ji-lu').set(授权头(签发管理令牌()));
    expect(响应.status).toBe(200);
    expect(响应.body.cuo_wu_ma).toBe('BIAO_QUE_SHI_JIANG_JI');
  });
});
