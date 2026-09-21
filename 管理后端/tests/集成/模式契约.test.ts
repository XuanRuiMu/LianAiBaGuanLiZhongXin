import { describe, it, expect } from 'vitest';
import { Pool } from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { 取管理角色, 按用户编号取角色, 清空管理员缓存 } from '../../src/中间件/管理员';
import { 登录取用户语句 } from '../../src/路由/登录';

/**
 * 用户表RBAC模式契约（真连库）。
 * 根因：单元测试用模拟池直接喂 管理员/运营/审核员 三列，缺列从未被测出，
 * 于是 Postgres 42703 一路吞成通用 500，服务全绿却整站不可用。
 */

const 假连接串标记 = 'localhost:5432/test';
const 契约列 = ['管理员', '运营', '审核员'];

function 取真实连接串(): string {
  const 显式 = (process.env.TEST_DATABASE_URL ?? '').trim();
  if (显式 !== '') {
    return 显式;
  }
  const 运行值 = (process.env.DATABASE_URL ?? '').trim();
  if (运行值 !== '' && !运行值.includes(假连接串标记)) {
    return 运行值;
  }
  const 环境文件 = path.resolve(__dirname, '..', '..', '.env');
  try {
    const 解析 = dotenv.parse(fs.readFileSync(环境文件));
    return (解析['DATABASE_URL'] ?? '').trim();
  } catch {
    return '';
  }
}

async function 取真实池(): Promise<Pool | null> {
  const 连接串 = 取真实连接串();
  if (连接串 === '') {
    console.warn('[模式契约] 未配置真实库连接串（TEST_DATABASE_URL / DATABASE_URL / 管理后端/.env），跳过');
    return null;
  }
  const 池 = new Pool({ connectionString: 连接串, connectionTimeoutMillis: 3000 });
  try {
    await 池.query('SELECT 1');
    return 池;
  } catch {
    await 池.end().catch(() => undefined);
    throw new Error('[模式契约] 已配置真实库连接串但不可达，禁止静默跳过');
  }
}

describe('用户表RBAC模式契约', () => {
  it('用户表存在 管理员/运营/审核员 三列且旗标列非空有默认值', async () => {
    const 池 = await 取真实池();
    if (!池) {
      return;
    }
    try {
      const 结果 = await 池.query(
        'SELECT column_name, is_nullable, column_default, data_type FROM information_schema.columns WHERE table_name = $1 ORDER BY column_name',
        ['用户'],
      );
      const 列名 = new Set(结果.rows.map((行) => String(行['column_name'])));
      for (const 列 of 契约列) {
        expect(列名.has(列), `用户表缺少列 ${列}`).toBe(true);
      }
      const 详情 = new Map(结果.rows.map((行) => [String(行['column_name']), 行]));
      for (const 列 of ['运营', '审核员']) {
        expect(String(详情.get(列)?.['is_nullable']), `列 ${列} 必须 NOT NULL`).toBe('NO');
        expect(String(详情.get(列)?.['data_type']), `列 ${列} 必须为 boolean`).toBe('boolean');
        expect(String(详情.get(列)?.['column_default']).toLowerCase(), `列 ${列} 必须默认 false`).toContain('false');
      }
    } finally {
      await 池.end().catch(() => undefined);
    }
  }, 20000);

  it('管理端角色查询语句在真实库可直接执行且映射合法', async () => {
    const 池 = await 取真实池();
    if (!池) {
      return;
    }
    try {
      // 复现 #17 的原始语句本身：改前此处在 42703 上直接抛错
      const 结果 = await 池.query('SELECT "管理员", "运营", "审核员" FROM "用户" ORDER BY "创建时间" ASC LIMIT 1');
      expect(Array.isArray(结果.rows)).toBe(true);
      if (结果.rows.length === 0) {
        return;
      }
      const 行 = 结果.rows[0];
      for (const 列 of 契约列) {
        expect(typeof 行[列], `真实库列 ${列} 必须可读出布尔值`).toBe('boolean');
      }
      const 角色 = 取管理角色(行);
      expect(角色 === null || ['chao_guan', 'yun_ying', 'shen_he_yuan'].includes(角色)).toBe(true);
      if (行['管理员'] === true) {
        expect(角色).toBe('chao_guan');
      }
    } finally {
      await 池.end().catch(() => undefined);
    }
  }, 20000);

  it('登录取用户语句在真实库可直接执行且七列可读', async () => {
    const 池 = await 取真实池();
    if (!池) {
      return;
    }
    try {
      const 结果 = await 池.query(登录取用户语句, ['00000000000']);
      expect(Array.isArray(结果.rows)).toBe(true);
      const 字段 = await 池.query(
        'SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND column_name = ANY($2)',
        ['用户', ['ID', '手机号', '用户名', '密码哈希', '管理员', '运营', '审核员']],
      );
      expect(字段.rows.map((行) => String(行['column_name']))).toHaveLength(7);
    } finally {
      await 池.end().catch(() => undefined);
    }
  }, 20000);

  it('真实库门禁按三旗标解析角色：超管行解析为 chao_guan，无旗标行为 null', async () => {
    const 池 = await 取真实池();
    if (!池) {
      return;
    }
    try {
      清空管理员缓存();
      const 超管 = await 池.query('SELECT "ID" FROM "用户" WHERE "管理员" IS TRUE LIMIT 1');
      if (超管.rows.length > 0) {
        expect(await 按用户编号取角色(String(超管.rows[0]['ID']), 池)).toBe('chao_guan');
      }
      const 无旗标 = await 池.query(
        'SELECT "ID" FROM "用户" WHERE "管理员" IS NOT TRUE AND "运营" IS NOT TRUE AND "审核员" IS NOT TRUE LIMIT 1',
      );
      if (无旗标.rows.length > 0) {
        expect(await 按用户编号取角色(String(无旗标.rows[0]['ID']), 池)).toBeNull();
      }
    } finally {
      清空管理员缓存();
      await 池.end().catch(() => undefined);
    }
  }, 20000);

  it('真库回滚事务内三角色旗标各解析为对应角色（不落库，不改真实用户数据）', async () => {
    const 池 = await 取真实池();
    if (!池) {
      return;
    }
    const 客户端 = await 池.connect();
    let 已回滚 = false;
    const 回滚 = async (): Promise<void> => {
      if (已回滚) {
        return;
      }
      已回滚 = true;
      await 客户端.query('ROLLBACK').catch(() => undefined);
    };
    try {
      const 样本 = await 客户端.query(
        'SELECT "ID" FROM "用户" WHERE "管理员" IS NOT TRUE AND "运营" IS NOT TRUE AND "审核员" IS NOT TRUE ORDER BY "创建时间" ASC LIMIT 1',
      );
      if (样本.rows.length === 0) {
        return;
      }
      const 编号 = String(样本.rows[0]['ID']);
      await 客户端.query('BEGIN');
      const 期望: Array<{ 角色: string; 列: string }> = [
        { 角色: 'chao_guan', 列: '管理员' },
        { 角色: 'yun_ying', 列: '运营' },
        { 角色: 'shen_he_yuan', 列: '审核员' },
      ];
      for (const 项 of 期望) {
        await 客户端.query(
          'UPDATE "用户" SET "管理员" = $2, "运营" = $3, "审核员" = $4 WHERE "ID" = $1',
          [编号, 项.列 === '管理员', 项.列 === '运营', 项.列 === '审核员'],
        );
        const 查 = await 客户端.query('SELECT "管理员", "运营", "审核员" FROM "用户" WHERE "ID" = $1 LIMIT 1', [编号]);
        expect(取管理角色(查.rows[0]), `真库置列 ${项.列} 应解析为 ${项.角色}`).toBe(项.角色);
        清空管理员缓存();
        expect(await 按用户编号取角色(编号, 客户端)).toBe(项.角色);
      }
      await 回滚();
      const 复核 = await 客户端.query('SELECT "管理员", "运营", "审核员" FROM "用户" WHERE "ID" = $1 LIMIT 1', [编号]);
      expect(取管理角色(复核.rows[0])).toBeNull();
    } finally {
      await 回滚();
      客户端.release();
      清空管理员缓存();
      await 池.end().catch(() => undefined);
    }
  }, 20000);
});
