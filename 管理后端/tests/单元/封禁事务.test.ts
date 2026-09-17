import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { 创建应用 } from '../../src/应用';
import { 清空管理员缓存 } from '../../src/中间件/管理员';
import { 创建模拟缓存, 签发管理令牌, 授权头, 默认行 } from './测试辅助';
import type { 查询池 } from '../../src/数据库';

const 写入路径 = '/api/guan-li/feng-jin';

function 创建事务模拟池() {
  const 外层记录: Array<{ 文本: string; 参数: unknown[] }> = [];
  const 事务记录: Array<{ 文本: string; 参数: unknown[] }> = [];
  let 事务次数 = 0;
  const 池: 查询池 = {
    query: async (文本: string, 参数?: unknown[]) => {
      const 实际参数 = 参数 ?? [];
      外层记录.push({ 文本, 参数: 实际参数 });
      const 行 = 默认行(文本);
      return { rows: 行, rowCount: 行.length };
    },
    用事务: async <T>(体: (查: (文本: string, 参数?: unknown[]) => Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>) => Promise<T>): Promise<T> => {
      事务次数 += 1;
      const 查 = async (文本: string, 参数?: unknown[]) => {
        const 实际参数 = 参数 ?? [];
        事务记录.push({ 文本, 参数: 实际参数 });
        const 行 = 默认行(文本);
        return { rows: 行, rowCount: 行.length };
      };
      return 体(查);
    },
  };
  return { 池, 外层记录, 事务记录, 取事务次数: () => 事务次数 };
}

describe('封禁事务', () => {
  it('二写合一走同一事务', async () => {
    const 模拟池 = 创建事务模拟池();
    const 模拟缓存 = 创建模拟缓存();
    清空管理员缓存();
    const 应用 = 创建应用({ 池: 模拟池.池, 缓存: 模拟缓存.缓存 });
    const 响应 = await request(应用)
      .post(写入路径)
      .set(授权头(签发管理令牌()))
      .send({ yong_hu_id: '22222222-2222-4222-8222-222222222222', ip: '1.2.3.4', yuan_yin: 'ce-shi-wei-gui' });
    expect(响应.status).toBe(201);
    expect(模拟池.取事务次数()).toBe(1);
    expect(模拟池.外层记录.some((记录) => 记录.文本.includes('INSERT INTO "封禁记录"'))).toBe(false);
    expect(模拟池.外层记录.some((记录) => 记录.文本.includes('INSERT INTO "审计日志"'))).toBe(false);
    expect(模拟池.事务记录.some((记录) => 记录.文本.includes('INSERT INTO "账号封禁"'))).toBe(true);
    expect(模拟池.事务记录.some((记录) => 记录.文本.includes('INSERT INTO "封禁记录"'))).toBe(true);
    expect(模拟池.事务记录.some((记录) => 记录.文本.includes('INSERT INTO "审计日志"'))).toBe(true);
    for (const 记录 of [...模拟池.外层记录, ...模拟池.事务记录]) {
      expect(记录.文本).not.toContain('ce-shi-wei-gui');
    }
  });
});
