const 隔离连接 = (process.env.TEST_DATABASE_URL ?? '').trim();
if (隔离连接 !== '' && (process.env.DATABASE_URL ?? '') !== '' && process.env.DATABASE_URL !== 隔离连接) {
  throw new Error('TEST_DATABASE_URL 与 DATABASE_URL 不一致，拒绝使用可能指向共享库的运行连接');
}
process.env.TEST_DATABASE_URL = 隔离连接;
process.env.DATABASE_URL = 隔离连接;
process.env.REDIS_URL ??= 'redis://localhost:6379';
process.env.JWT_SECRET ??= 'ce-shi-yong-32-zi-jie-mi-yao-0123456789ab';
process.env.JWT_EXPIRES_IN ??= '1h';
process.env.APP_ENV = 'test';
process.env.NODE_ENV = 'test';
process.env.VITEST ??= 'true';
