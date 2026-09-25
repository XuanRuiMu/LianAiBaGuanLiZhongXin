import { afterEach, describe, expect, it, vi } from 'vitest';

const 环境键 = ['TEST_DATABASE_URL', 'DATABASE_URL', 'REDIS_URL'] as const;
const 原值 = new Map(环境键.map((键) => [键, process.env[键]]));

afterEach(() => {
  for (const [键, 值] of 原值) {
    if (值 === undefined) delete process.env[键];
    else process.env[键] = 值;
  }
  vi.resetModules();
});

describe('测试准备环境', () => {
  it('显式隔离连接在加载准备文件后保持', async () => {
    const 显式值: Record<(typeof 环境键)[number], string> = {
      TEST_DATABASE_URL: 'postgresql://隔离用户:隔离密码@隔离数据库:5432/隔离库',
      DATABASE_URL: 'postgresql://隔离用户:隔离密码@隔离数据库:5432/隔离库',
      REDIS_URL: 'redis://运行用户:运行密码@隔离缓存:6379',
    };
    for (const 键 of 环境键) {
      process.env[键] = 显式值[键];
    }

    vi.resetModules();
    await import('../准备.js');

    for (const 键 of 环境键) {
      expect(process.env[键]).toBe(显式值[键]);
    }
  });

  it('隔离连接与运行连接冲突时拒绝加载', async () => {
    process.env.TEST_DATABASE_URL = 'postgresql://隔离用户:隔离密码@隔离数据库:5432/隔离库';
    process.env.DATABASE_URL = 'postgresql://运行用户:运行密码@运行数据库:5432/运行库';

    vi.resetModules();
    await expect(import('../准备.js')).rejects.toThrow('TEST_DATABASE_URL 与 DATABASE_URL 不一致');
  });

  it('未配置隔离连接时不伪造数据库地址', async () => {
    delete process.env.TEST_DATABASE_URL;
    delete process.env.DATABASE_URL;

    vi.resetModules();
    await import('../准备.js');

    expect(process.env.TEST_DATABASE_URL).toBe('');
    expect(process.env.DATABASE_URL).toBe('');
  });
});
