import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { 启动前补齐主配置 } from '../../src/配置';

const 同源键 = ['DATABASE_URL', 'REDIS_URL', 'JWT_SECRET', 'JWT_EXPIRES_IN', 'GUAN_LI_SHUA_XIN_YOU_XIAO_MIAO', 'ADMIN_PHONES', 'ALLOWED_ORIGINS', 'NEI_WANG_BAI_MING_DAN', 'TRUST_PROXY', 'FORCE_HTTPS', 'VITE_API_PROXY_TARGET', 'INTERNAL_TOKEN', 'TTS_SERVICE_URL'];
const 备份 = new Map<string, string | undefined>();

function 备份环境(): void {
  备份.clear();
  for (const 键 of [...同源键, 'APP_ENV', 'NODE_ENV']) {
    备份.set(键, process.env[键]);
    delete process.env[键];
  }
}

afterEach(() => {
  for (const [键, 值] of 备份) {
    if (值 === undefined) delete process.env[键];
    else process.env[键] = 值;
  }
});

function 建工作区(主配置: Record<string, string>): string {
  const 根 = fs.mkdtempSync(path.join(os.tmpdir(), 'guan-li-bu-qi-'));
  fs.mkdirSync(path.join(根, '管理中心'));
  fs.mkdirSync(path.join(根, '和我恋爱吧'));
  const 行 = Object.entries(主配置).map(([键, 值]) => `${键}=${值}`);
  fs.writeFileSync(path.join(根, '和我恋爱吧', '.env'), `${行.join('\n')}\n`, 'utf8');
  return path.join(根, '管理中心');
}

function 建嵌套工作区(主配置: Record<string, string>): string {
  const 根 = fs.mkdtempSync(path.join(os.tmpdir(), 'guan-li-bu-qi-nest-'));
  fs.mkdirSync(path.join(根, '和我恋爱吧'));
  const 子 = path.join(根, '管理中心', '管理后端');
  fs.mkdirSync(子, { recursive: true });
  const 行 = Object.entries(主配置).map(([键, 值]) => `${键}=${值}`);
  fs.writeFileSync(path.join(根, '和我恋爱吧', '.env'), `${行.join('\n')}\n`, 'utf8');
  return 子;
}

describe('启动前补齐主配置', () => {
  it('缺键时按fill-empty从主配置补齐', () => {
    备份环境();
    const 工作目录 = 建工作区({ DATABASE_URL: 'postgres://主库', REDIS_URL: 'redis://主缓存', JWT_SECRET: '主密钥足够长0123456789abcdef' });
    const 已补 = 启动前补齐主配置(工作目录);
    expect(已补).toContain('DATABASE_URL');
    expect(process.env.DATABASE_URL).toBe('postgres://主库');
    expect(process.env.REDIS_URL).toBe('redis://主缓存');
    expect(process.env.JWT_SECRET).toBe('主密钥足够长0123456789abcdef');
  });

  it('已有值不被覆盖', () => {
    备份环境();
    const 工作目录 = 建工作区({ DATABASE_URL: 'postgres://主库' });
    process.env.DATABASE_URL = 'postgres://已有';
    const 已补 = 启动前补齐主配置(工作目录);
    expect(已补).not.toContain('DATABASE_URL');
    expect(process.env.DATABASE_URL).toBe('postgres://已有');
  });

  it('生产环境禁止自动补齐', () => {
    备份环境();
    process.env.APP_ENV = 'prod';
    const 工作目录 = 建工作区({ DATABASE_URL: 'postgres://主库' });
    const 已补 = 启动前补齐主配置(工作目录);
    expect(已补).toEqual([]);
    expect(process.env.DATABASE_URL).toBeUndefined();
  });

  it('主配置缺失时静默返回', () => {
    备份环境();
    const 根 = fs.mkdtempSync(path.join(os.tmpdir(), 'guan-li-bu-qi-kong-'));
    const 工作目录 = path.join(根, '管理中心');
    fs.mkdirSync(工作目录, { recursive: true });
    expect(启动前补齐主配置(工作目录)).toEqual([]);
  });

  it('管理后端子目录启动可回退两级找到主配置', () => {
    备份环境();
    const 工作目录 = 建嵌套工作区({ DATABASE_URL: 'postgres://主库' });
    const 已补 = 启动前补齐主配置(工作目录);
    expect(已补).toContain('DATABASE_URL');
    expect(process.env.DATABASE_URL).toBe('postgres://主库');
  });

  it('主库无连接串时按三件套派生本地连接串', () => {
    备份环境();
    const 工作目录 = 建工作区({ POSTGRES_USER: 'u', POSTGRES_PASSWORD: 'p', POSTGRES_DB: 'd', REDIS_PASSWORD: 'r' });
    const 已补 = 启动前补齐主配置(工作目录);
    expect(已补).toContain('DATABASE_URL');
    expect(已补).toContain('REDIS_URL');
    expect(process.env.DATABASE_URL).toBe('postgresql://u:p@localhost:5432/d');
    expect(process.env.REDIS_URL).toBe('redis://:r@localhost:6379');
  });
});
