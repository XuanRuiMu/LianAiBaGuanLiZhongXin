import { Pool } from 'pg';
import { 当前配置 } from './配置';

export interface 查询结果 {
  rows: Record<string, unknown>[];
  rowCount: number | null;
}

export interface 查询池 {
  query: (文本: string, 参数?: unknown[]) => Promise<查询结果>;
  用事务?: <T>(体: (查: (文本: string, 参数?: unknown[]) => Promise<查询结果>) => Promise<T>) => Promise<T>;
}

export function 取池整数(新键: string, 默认值: number, 兼容键?: string): number {
  const 候选 = 兼容键 === undefined ? [新键] : [新键, 兼容键];
  for (const 键 of 候选) {
    const 原始 = process.env[键];
    if (原始 === undefined || 原始.trim() === '') {
      continue;
    }
    const 解析 = Number(原始);
    if (!Number.isInteger(解析) || 解析 <= 0) {
      continue;
    }
    return 解析;
  }
  return 默认值;
}

export function 创建池(连接串?: string): 查询池 {
  const 底池 = new Pool({
    connectionString: 连接串 ?? 当前配置().数据库连接串,
    max: 取池整数('LIAN_JIE_SHU_SHANG_XIAN', 10, 'PG_POOL_MAX'),
    connectionTimeoutMillis: 取池整数('LIAN_JIE_CHAO_SHI_HAO_MIAO', 5000, 'PG_POOL_LIAN_JIE_CHAO_SHI'),
    idleTimeoutMillis: 取池整数('KONG_XIAN_CHAO_SHI_HAO_MIAO', 30000, 'PG_POOL_KONG_XIAN_CHAO_SHI'),
    statement_timeout: 取池整数('YU_JU_CHAO_SHI_HAO_MIAO', 15000, 'PG_POOL_YU_JU_CHAO_SHI'),
  });
  const 转换 = (行: unknown[]): Record<string, unknown>[] => 行 as Record<string, unknown>[];
  return {
    query: async (文本: string, 参数?: unknown[]): Promise<查询结果> => {
      const 结果 = await 底池.query(文本, 参数);
      return { rows: 转换(结果.rows), rowCount: 结果.rowCount };
    },
    用事务: async <T>(体: (查: (文本: string, 参数?: unknown[]) => Promise<查询结果>) => Promise<T>): Promise<T> => {
      const 客户端 = await 底池.connect();
      try {
        await 客户端.query('BEGIN');
        const 查 = async (文本: string, 参数?: unknown[]): Promise<查询结果> => {
          const 结果 = await 客户端.query(文本, 参数);
          return { rows: 转换(结果.rows), rowCount: 结果.rowCount };
        };
        const 返回 = await 体(查);
        await 客户端.query('COMMIT');
        return 返回;
      } catch (错误) {
        try {
          await 客户端.query('ROLLBACK');
        } catch {
          return Promise.reject(错误);
        }
        throw 错误;
      } finally {
        客户端.release();
      }
    },
  };
}
