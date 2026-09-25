import { Pool } from 'pg';

export function 取隔离数据库连接串(): string {
  const 连接串 = (process.env.TEST_DATABASE_URL ?? '').trim();
  if (连接串 === '') {
    throw new Error('集成测试必须由隔离门禁注入 TEST_DATABASE_URL；禁止回退 .env 或跳过');
  }

  let 地址: URL;
  try {
    地址 = new URL(连接串);
  } catch {
    throw new Error('TEST_DATABASE_URL 不是合法的数据库连接串');
  }

  const 数据库名 = decodeURIComponent(地址.pathname.replace(/^\/+/, ''));
  if (!/(^|[_-])test([_-]|$)/i.test(数据库名)) {
    throw new Error('TEST_DATABASE_URL 必须指向名称包含 test 的独立数据库');
  }
  return 连接串;
}

export async function 创建隔离数据库池(): Promise<Pool> {
  const 池 = new Pool({
    connectionString: 取隔离数据库连接串(),
    connectionTimeoutMillis: 5000,
  });
  try {
    await 池.query('SELECT 1');
    return 池;
  } catch {
    await 池.end();
    throw new Error('TEST_DATABASE_URL 指向的隔离数据库不可达');
  }
}
