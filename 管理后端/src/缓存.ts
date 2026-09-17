import Redis from 'ioredis';
import { 当前配置 } from './配置';
import { 日志 } from './日志';

export interface 缓存客户端 {
  get: (键: string) => Promise<string | null>;
  set: (键: string, 值: string, 存活秒?: number) => Promise<unknown>;
  del: (键: string) => Promise<unknown>;
  publish: (频道: string, 消息: string) => Promise<unknown>;
  subscribe: (频道: string, 回调: (消息: string) => void) => Promise<() => void>;
}

class 真实缓存 implements 缓存客户端 {
  private 客户端: Redis;
  private 就绪: Promise<void> | null = null;

  constructor(连接串: string) {
    this.客户端 = new Redis(连接串, { lazyConnect: true, maxRetriesPerRequest: 2, enableReadyCheck: true });
    this.客户端.on('error', (错误: Error) => {
      日志.错误('缓存连接', '缓存连接错误', { 错误: 错误.message });
    });
  }

  private 确保连接(): Promise<void> {
    if (this.就绪) {
      return this.就绪;
    }
    this.就绪 = this.客户端.ping().then(() => undefined);
    this.就绪.catch(() => {
      this.就绪 = null;
    });
    return this.就绪;
  }

  async get(键: string): Promise<string | null> {
    await this.确保连接();
    return this.客户端.get(键);
  }

  async set(键: string, 值: string, 存活秒?: number): Promise<unknown> {
    await this.确保连接();
    if (存活秒 !== undefined) {
      return this.客户端.set(键, 值, 'EX', 存活秒);
    }
    return this.客户端.set(键, 值);
  }

  async del(键: string): Promise<unknown> {
    await this.确保连接();
    return this.客户端.del(键);
  }

  async publish(频道: string, 消息: string): Promise<unknown> {
    await this.确保连接();
    return this.客户端.publish(频道, 消息);
  }

  async subscribe(频道: string, 回调: (消息: string) => void): Promise<() => void> {
    const 订阅端 = this.客户端.duplicate();
    await 订阅端.subscribe(频道);
    const 处理 = (收频道: string, 消息: string): void => {
      if (收频道 === 频道) {
        回调(消息);
      }
    };
    订阅端.on('message', 处理);
    return () => {
      void 订阅端.unsubscribe(频道).finally(() => {
        订阅端.disconnect();
      });
    };
  }
}

export function 创建缓存(连接串?: string): 缓存客户端 {
  return new 真实缓存(连接串 ?? 当前配置().缓存连接串);
}
