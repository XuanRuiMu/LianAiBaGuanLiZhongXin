import { describe, it, expect, afterEach } from 'vitest';
import { 创建池, 取池整数 } from '../../src/数据库';

const 键表 = [
  'LIAN_JIE_SHU_SHANG_XIAN',
  'LIAN_JIE_CHAO_SHI_HAO_MIAO',
  'KONG_XIAN_CHAO_SHI_HAO_MIAO',
  'YU_JU_CHAO_SHI_HAO_MIAO',
  'PG_POOL_MAX',
  'PG_POOL_LIAN_JIE_CHAO_SHI',
  'PG_POOL_KONG_XIAN_CHAO_SHI',
  'PG_POOL_YU_JU_CHAO_SHI',
];

afterEach(() => {
  for (const 键 of 键表) {
    delete process.env[键];
  }
});

describe('连接池配置键', () => {
  it('canonical 纯拼音键优先于旧兼容键', () => {
    process.env.LIAN_JIE_SHU_SHANG_XIAN = '7';
    process.env.PG_POOL_MAX = '3';
    expect(取池整数('LIAN_JIE_SHU_SHANG_XIAN', 10, 'PG_POOL_MAX')).toBe(7);
  });

  it('canonical 缺席时回退旧兼容键', () => {
    process.env.PG_POOL_MAX = '3';
    expect(取池整数('LIAN_JIE_SHU_SHANG_XIAN', 10, 'PG_POOL_MAX')).toBe(3);
  });

  it('双键缺席时用默认值', () => {
    expect(取池整数('LIAN_JIE_SHU_SHANG_XIAN', 10, 'PG_POOL_MAX')).toBe(10);
  });

  it('非法值跳过并继续回退', () => {
    process.env.LIAN_JIE_SHU_SHANG_XIAN = 'abc';
    process.env.PG_POOL_MAX = '0';
    expect(取池整数('LIAN_JIE_SHU_SHANG_XIAN', 10, 'PG_POOL_MAX')).toBe(10);
    process.env.PG_POOL_MAX = '4';
    expect(取池整数('LIAN_JIE_SHU_SHANG_XIAN', 10, 'PG_POOL_MAX')).toBe(4);
  });
});

describe('池事务接口命名', () => {
  it('自有事务接口为中文用事务且无英文旧名', () => {
    const 池 = 创建池('postgres://test:test@localhost:5432/test') as unknown as Record<string, unknown>;
    expect(typeof 池['用事务']).toBe('function');
    expect('withTransaction' in 池).toBe(false);
  });
});
