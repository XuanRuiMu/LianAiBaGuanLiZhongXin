import { describe, it, expect } from 'vitest';
import { Pool } from 'pg';

const 六类语句: Array<{ 类别: string; 语句: string; 参数: unknown[] }> = [
  { 类别: '账号', 语句: 'SELECT "ID" FROM "用户" LIMIT $1', 参数: [1] },
  { 类别: '聊天', 语句: 'SELECT "ID" FROM "消息" LIMIT $1', 参数: [1] },
  { 类别: 'AI思考', 语句: 'SELECT "ID" FROM "记忆" LIMIT $1', 参数: [1] },
  { 类别: '封禁', 语句: 'SELECT "ID" FROM "封禁记录" LIMIT $1', 参数: [1] },
  { 类别: '审计', 语句: 'SELECT "ID" FROM "审计日志" LIMIT $1', 参数: [1] },
  { 类别: '统计', 语句: 'SELECT COUNT(*) AS "总数" FROM "好感度"', 参数: [] },
];

async function 获取真实池(): Promise<Pool | null> {
  const 连接串 = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '';
  if (!连接串 || 连接串.includes('localhost:5432/test')) {
    console.warn('[集成] 未配置真实库连接串，跳过');
    return null;
  }
  const 池 = new Pool({ connectionString: 连接串, connectionTimeoutMillis: 3000 });
  try {
    await 池.query('SELECT 1');
    return 池;
  } catch {
    console.warn('[集成] 数据库不可达，跳过');
    await 池.end().catch(() => undefined);
    return null;
  }
}

describe('管理后端集成联通', () => {
  for (const { 类别, 语句, 参数 } of 六类语句) {
    it(`${类别}只读语句真实联通`, async () => {
      const 池 = await 获取真实池();
      if (!池) {
        console.warn(`[集成] ${类别}无真实库，跳过不断言通过`);
        return;
      }
      try {
        const 结果 = await 池.query(语句, 参数);
        expect(Array.isArray(结果.rows)).toBe(true);
      } finally {
        await 池.end().catch(() => undefined);
      }
    });
  }
});
