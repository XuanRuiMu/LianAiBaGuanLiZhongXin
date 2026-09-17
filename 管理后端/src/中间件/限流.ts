import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import type { Request, Response } from 'express';
import { 当前配置 } from '../配置';
import { 取文案 } from '../文案';
import { 失败响应 } from '../响应';
import type { 认证请求 } from './认证';
import { 取真实IP } from '../真实IP';

export interface 限流选项 {
  窗口毫秒?: number;
  上限?: number;
}

function 取请求标识(请求: Request): string {
  const 登录用户 = (请求 as 认证请求).登录用户;
  if (登录用户?.yongHuId) {
    return `yongHu:${登录用户.yongHuId}`;
  }
  // YH-016 真实IP推导：可信链路X-Real-IP，不解析客户端可控XFF
  return `ip:${ipKeyGenerator(取真实IP(请求) ?? 'unknown')}`;
}

function 取真实IP键(请求: Request): string {
  try {
    return ipKeyGenerator(取真实IP(请求));
  } catch {
    return 'unknown';
  }
}

function 取缓存作存储(缓存: {
  get: (键: string) => Promise<string | null>;
  set: (键: string, 值: string, 存活秒?: number) => Promise<unknown>;
  del: (键: string) => Promise<unknown>;
}): {
  increment: (键: string) => Promise<{ totalHits: number; resetTime?: Date }>;
  decrement: (键: string) => Promise<void>;
  resetKey: (键: string) => Promise<void>;
  prefix: string;
  localKeys: boolean;
} | undefined {
  // 同一请求挂读+写两个限流器时库会判double-count；localKeys=true让各实例独立记键
  const 未命中重置 = new Map<string, Date>();
  const 前缀 = `fp02-${Math.random().toString(36).slice(2, 8)}:`;
  return {
    prefix: 前缀,
    localKeys: true,
    increment: async (键: string) => {
      const 计数键 = `xian_liu:${键}`;
      const 现 = await 缓存.get(计数键);
      const 下一 = (现 === null ? 0 : Number(现) || 0) + 1;
      await 缓存.set(计数键, String(下一), 120);
      let 重置 = 未命中重置.get(计数键);
      if (现 === null || !重置) {
        重置 = new Date(Date.now() + 60000);
        未命中重置.set(计数键, 重置);
      }
      return { totalHits: 下一, resetTime: 重置 };
    },
    decrement: async (键: string): Promise<void> => {
      await 缓存.del(`xian_liu:${键}`);
    },
    resetKey: async (键: string): Promise<void> => {
      await 缓存.del(`xian_liu:${键}`);
      未命中重置.delete(`xian_liu:${键}`);
    },
  };
}

function 创建限流器(默认窗口毫秒: number, 默认上限: number, 选项: 限流选项, 缓存?: {
  get: (键: string) => Promise<string | null>;
  set: (键: string, 值: string, 存活秒?: number) => Promise<unknown>;
  del: (键: string) => Promise<unknown>;
}) {
  return rateLimit({
    windowMs: 选项.窗口毫秒 ?? 默认窗口毫秒,
    limit: 选项.上限 ?? 默认上限,
    standardHeaders: true,
    legacyHeaders: false,
    // YH-016 限流迁Redis：有缓存走共享计数，无缓存回退内存（测试/单机）
    ...(缓存 ? { store: 取缓存作存储(缓存) as never } : {}),
    keyGenerator: (请求: Request): string => 取请求标识(请求),
    handler: (_请求: Request, 响应: Response): void => {
      失败响应(响应, 429, 取文案('通用', '请求过于频繁'), 'XIAN_LIU');
    },
  });
}

export function 创建读限流(选项: 限流选项 = {}, 缓存?: {
  get: (键: string) => Promise<string | null>;
  set: (键: string, 值: string, 存活秒?: number) => Promise<unknown>;
  del: (键: string) => Promise<unknown>;
}) {
  const 配置 = 当前配置();
  return 创建限流器(配置.读限流窗口毫秒, 配置.读限流次数, 选项, 缓存);
}

export function 创建写限流(选项: 限流选项 = {}, 缓存?: {
  get: (键: string) => Promise<string | null>;
  set: (键: string, 值: string, 存活秒?: number) => Promise<unknown>;
  del: (键: string) => Promise<unknown>;
}) {
  const 配置 = 当前配置();
  return 创建限流器(配置.写限流窗口毫秒, 配置.写限流次数, 选项, 缓存);
}

export { 取真实IP键 };
