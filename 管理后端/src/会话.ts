import type { Request, Response, RequestHandler, Router as Router类型 } from 'express';
import { Router } from 'express';
import { 当前配置 } from './配置';
import { 成功响应 } from './响应';
import { 日志 } from './日志';
import { 取可选字符串 } from './校验';
import type { 缓存客户端 } from './缓存';
import { 响应依赖缺失, 响应缓存不可用 } from './错误归一化';
import type { 认证请求 } from './中间件/认证';

/** 会话双 Cookie 的唯一线路口径：名字与作用路径只在真源出现一次（契约.md 一、四节） */
export const 访问令牌Cookie名 = 'guan_li_ling_pai';
export const 刷新令牌Cookie名 = 'guan_li_shua_xin';
export const 访问令牌作用路径 = '/api/guan-li';
export const 刷新令牌作用路径 = '/api/guan-li/shua-xin';
export const 刷新令牌缓存前缀 = 'guan_li_shua_xin:';
export const 持久会话缓存前缀 = 'guan_li_shua_xin_chi_jiu:';
export const 令牌黑名单前缀 = 'jwt_blacklist:';

interface Cookie骨架 {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'strict';
  path: string;
  maxAge?: number;
}

function 取缓存(请求: Request): 缓存客户端 | undefined {
  return (请求.app.locals as { 缓存?: 缓存客户端 }).缓存;
}

/** 「记住密码」= 持久会话；线路键唯一真源为 chi_jiu_hui_hua，只认 JSON 布尔真值，任何其它键名或非法输入一律回落为会话级 */
export function 是否持久会话(正文: Record<string, unknown>): boolean {
  return 正文['chi_jiu_hui_hua'] === true;
}

function Cookie基础(请求: Request, 路径: string, 存活秒?: number): Cookie骨架 {
  const 安全 = 请求.secure || 请求.headers['x-forwarded-proto'] === 'https' || 当前配置().运行环境 !== 'prod';
  const 骨架: Cookie骨架 = {
    httpOnly: true,
    secure: 安全,
    sameSite: 'strict',
    path: 路径,
  };
  if (存活秒 !== undefined) {
    骨架.maxAge = 存活秒 * 1000;
  }
  return 骨架;
}

/**
 * 会话 Cookie 下发：访问令牌一律随 JWT 有效期，刷新令牌只在持久会话时带 Max-Age，
 * 否则回落成浏览器会话级 Cookie，关窗即失效，不在浏览器里留下 7 天可用的离线凭证。
 */
export function 下发会话Cookie(
  请求: Request,
  响应: Response,
  访问令牌: string,
  刷新编号: string,
  持久会话: boolean,
): void {
  const 配置 = 当前配置();
  响应.cookie(访问令牌Cookie名, 访问令牌, Cookie基础(请求, 访问令牌作用路径, 配置.访问令牌有效秒));
  响应.cookie(
    刷新令牌Cookie名,
    刷新编号,
    Cookie基础(请求, 刷新令牌作用路径, 持久会话 ? 配置.刷新有效秒 : undefined),
  );
}

export function 抹除会话Cookie(请求: Request, 响应: Response): void {
  响应.clearCookie(访问令牌Cookie名, Cookie基础(请求, 访问令牌作用路径));
  响应.clearCookie(刷新令牌Cookie名, Cookie基础(请求, 刷新令牌作用路径));
}

export async function 登记持久会话(
  缓存: 缓存客户端,
  刷新编号: string,
  持久会话: boolean,
): Promise<void> {
  if (持久会话) {
    await 缓存.set(`${持久会话缓存前缀}${刷新编号}`, '1', 当前配置().刷新有效秒);
  }
}

export async function 读持久会话(缓存: 缓存客户端, 刷新编号: string): Promise<boolean> {
  return (await 缓存.get(`${持久会话缓存前缀}${刷新编号}`)) === '1';
}

/** 刷新号一次性轮换后，旧号的持久标记要一并删掉，否则缓存里堆积无人认领的标记 */
export async function 注销刷新令牌(缓存: 缓存客户端, 刷新编号: string): Promise<void> {
  await 缓存.del(`${刷新令牌缓存前缀}${刷新编号}`);
  await 缓存.del(`${持久会话缓存前缀}${刷新编号}`);
}

/**
 * FP-03 服务端注销：把当前访问令牌按 jti 拉黑到它自然过期，同时删掉刷新号，
 * 让「退出登录」成为真正的凭证吊销而不是只清本地标记。挂载层次与只读路由相同
 * （认证中间件＋管理员门禁之后）：任何已认证管理员都可结束自己的会话，不需要业务能力位。
 */
export function 创建登出路由(写限流: RequestHandler): Router类型 {
  const 路由 = Router();

  路由.post('/tui-chu', 写限流, async (请求: Request, 响应: Response): Promise<void> => {
    const 缓存 = 取缓存(请求);
    if (!缓存) {
      响应依赖缺失(响应, '管理登出', '缓存', 请求);
      return;
    }
    const 登录用户 = (请求 as 认证请求).登录用户;
    const 令牌编号 = typeof 登录用户?.jti === 'string' ? 登录用户.jti : '';
    const 剩余秒 =
      typeof 登录用户?.exp === 'number'
        ? Math.max(1, 登录用户.exp - Math.floor(Date.now() / 1000))
        : 当前配置().访问令牌有效秒;
    const 刷新编号 = 取可选字符串((请求.cookies as Record<string, unknown> | undefined)?.[刷新令牌Cookie名]);
    抹除会话Cookie(请求, 响应);
    try {
      if (令牌编号.length > 0) {
        await 缓存.set(`${令牌黑名单前缀}${令牌编号}`, '1', 剩余秒);
      }
      if (刷新编号 !== undefined) {
        await 注销刷新令牌(缓存, 刷新编号);
      }
    } catch (错误) {
      响应缓存不可用(响应, '管理登出', 错误, 请求);
      return;
    }
    日志.信息('管理登出', '管理员注销会话', { 用户编号: 登录用户?.yongHuId ?? '' });
    成功响应(响应, { yi_tui_chu: true });
  });

  return 路由;
}
