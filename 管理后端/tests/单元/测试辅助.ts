import jwt from 'jsonwebtoken';
import { 创建应用 } from '../../src/应用';
import { 清空管理员缓存 } from '../../src/中间件/管理员';

export interface 记录查询 {
  文本: string;
  参数: unknown[];
}

export type 行处理器 = (文本: string, 参数: unknown[]) => Record<string, unknown>[];

export function 默认行(文本: string): Record<string, unknown>[] {
  // YH-108 RBAC三角色查询兼容：新SELECT含运营/审核员列，旧匹配仍命中
  if (文本.includes('SELECT "管理员"')) {
    return [{ 管理员: true, 运营: false, 审核员: false }];
  }
  if (文本.includes('COUNT(*)')) {
    return [{ 总数: '3' }];
  }
  return [{ ID: '11111111-1111-4111-8111-111111111111' }];
}

export function 创建模拟池(处理器?: 行处理器) {
  const 查询记录: 记录查询[] = [];
  const 池 = {
    query: async (文本: string, 参数?: unknown[]) => {
      const 实际参数 = 参数 ?? [];
      查询记录.push({ 文本, 参数: 实际参数 });
      const 行 =处理器 ? 处理器(文本, 实际参数) : 默认行(文本);
      return { rows: 行, rowCount: 行.length };
    },
  };
  return { 池, 查询记录 };
}

export function 创建模拟缓存(预置: Record<string, string> = {}) {
  const 表 = new Map<string, string>(Object.entries(预置));
  const 订阅回调 = new Map<string, (消息: string) => void>();
  const 缓存 = {
    get: async (键: string): Promise<string | null> => 表.get(键) ?? null,
    set: async (键: string, 值: string): Promise<unknown> => {
      表.set(键, 值);
      return 'OK';
    },
    del: async (键: string): Promise<unknown> => (表.delete(键) ? 1 : 0),
    publish: async (频道: string, 消息: string): Promise<unknown> => {
      订阅回调.get(频道)?.(消息);
      return 1;
    },
    subscribe: async (频道: string, 回调: (消息: string) => void): Promise<() => void> => {
      订阅回调.set(频道, 回调);
      return () => undefined;
    },
  };
  return { 缓存, 表, 订阅回调 };
}

export const 测试用户编号 = '22222222-2222-4222-8222-222222222222';
export const 测试令牌编号 = '33333333-3333-4333-8333-333333333333';

export function 签发管理令牌(覆盖: Record<string, unknown> = {}): string {
  return jwt.sign(
    { yongHuId: 测试用户编号, shouJiHao: '13800000000', ...覆盖 },
    String(process.env.JWT_SECRET),
    { expiresIn: '1h', jwtid: 测试令牌编号 },
  );
}

export function 授权头(令牌: string): { Authorization: string } {
  return { Authorization: `Bearer ${令牌}` };
}

export function 创建测试应用(
  覆盖: {
    池?: { query: (文本: string, 参数?: unknown[]) => Promise<{ rows: Record<string, unknown>[]; rowCount: number }> };
    缓存?: {
      get: (键: string) => Promise<string | null>;
      set: (键: string, 值: string, 存活秒?: number) => Promise<unknown>;
      del: (键: string) => Promise<unknown>;
      publish: (频道: string, 消息: string) => Promise<unknown>;
      subscribe: (频道: string, 回调: (消息: string) => void) => Promise<() => void>;
    };
    管理员?: boolean;
    旗标?: { 管理员?: boolean; 运营?: boolean; 审核员?: boolean };
    写上限?: number;
    读上限?: number;
  } = {},
) {
  const 模拟池 = 创建模拟池((文本, _参数) => {
    void _参数;
    if (文本.includes('SELECT "管理员"')) {
      return [
        {
          管理员: 覆盖.旗标?.管理员 ?? 覆盖.管理员 ?? true,
          运营: 覆盖.旗标?.运营 ?? false,
          审核员: 覆盖.旗标?.审核员 ?? false,
        },
      ];
    }
    return 默认行(文本);
  });
  const 模拟缓存 = 创建模拟缓存();
  清空管理员缓存();
  const 查询记录: 记录查询[] = 覆盖.池 ? [] : 模拟池.查询记录;
  const 池包装 = 覆盖.池
    ? {
        query: async (文本: string, 参数?: unknown[]) => {
          const 实际参数 = 参数 ?? [];
          查询记录.push({ 文本, 参数: 实际参数 });
          return 覆盖.池!.query(文本, 参数);
        },
      }
    : 模拟池.池;
  const 应用 = 创建应用({
    池: 池包装,
    缓存: 覆盖.缓存 ?? 模拟缓存.缓存,
    写限流: 覆盖.写上限 === undefined ? undefined : { 窗口毫秒: 60000, 上限: 覆盖.写上限 },
    读限流: 覆盖.读上限 === undefined ? undefined : { 窗口毫秒: 60000, 上限: 覆盖.读上限 },
  });
  return { 应用, 查询记录, 缓存表: 模拟缓存.表, 订阅回调: 模拟缓存.订阅回调 };
}
