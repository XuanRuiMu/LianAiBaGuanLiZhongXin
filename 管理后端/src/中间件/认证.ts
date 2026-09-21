import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { 当前配置 } from '../配置';
import { 取文案 } from '../文案';
import { 失败响应 } from '../响应';
import { 错误码 } from '../错误码';
import type { 缓存客户端 } from '../缓存';
import { 响应依赖缺失, 响应缓存不可用, 响应鉴权或归一 } from '../错误归一化';

export interface 令牌载荷 {
  yongHuId: string;
  shouJiHao: string;
  jti?: string;
  iat?: number;
  exp?: number;
  qianFaHaoMiao?: number;
  tokenType?: string;
  sub?: string;
}

export interface 认证请求 extends Request {
  登录用户?: 令牌载荷;
}

function 取缓存(请求: Request): 缓存客户端 | undefined {
  return (请求.app.locals as { 缓存?: 缓存客户端 }).缓存;
}

export async function 认证中间件(请求: Request, 响应: Response, 下一步: NextFunction): Promise<void> {
  const 授权头 = 请求.headers.authorization;
  const 曲奇令牌 = typeof (请求.cookies as Record<string, unknown> | undefined)?.['guan_li_ling_pai'] === 'string'
    ? String((请求.cookies as Record<string, unknown>)['guan_li_ling_pai']).trim()
    : '';
  const 头令牌 = 授权头 && 授权头.startsWith('Bearer ') ? 授权头.slice(7).trim() : '';
  const 令牌 = 曲奇令牌 || 头令牌;
  if (!令牌) {
    失败响应(响应, 401, 取文案('通用', '未授权'), 错误码.未授权);
    return;
  }
  const 缓存 = 取缓存(请求);
  if (!缓存) {
    响应依赖缺失(响应, '认证', '缓存', 请求);
    return;
  }
  try {
    let 原始: Record<string, unknown>;
    try {
      // YH-031 JWT算法白名单：仅HS256，禁none/RS256混淆
      原始 = jwt.verify(令牌, 当前配置().令牌密钥, { algorithms: ['HS256'] }) as unknown as Record<string, unknown>;
    } catch {
      失败响应(响应, 401, 取文案('通用', '令牌无效'), 错误码.登录失效);
      return;
    }
    const 用户编号 = typeof 原始['yongHuId'] === 'string' ? 原始['yongHuId'] : typeof 原始['sub'] === 'string' ? 原始['sub'] : '';
    if (!用户编号) {
      失败响应(响应, 401, 取文案('通用', '令牌无效'), 错误码.登录失效);
      return;
    }
    const 令牌编号 = typeof 原始['jti'] === 'string' ? 原始['jti'] : '';
    let 已拉黑: string | null = null;
    let 吊销值: string | null = null;
    try {
      if (令牌编号) {
        已拉黑 = await 缓存.get(`jwt_blacklist:${令牌编号}`);
      }
      吊销值 = await 缓存.get(`jwt_yong_hu_cheXiao:${用户编号}`);
    } catch (错误) {
      响应缓存不可用(响应, '认证', 错误, 请求);
      return;
    }
    if (已拉黑) {
      失败响应(响应, 401, 取文案('通用', '令牌无效'), 错误码.登录失效);
      return;
    }
    if (吊销值 !== null) {
      const 签发毫秒 =
        typeof 原始['qianFaHaoMiao'] === 'number'
          ? 原始['qianFaHaoMiao']
          : typeof 原始['iat'] === 'number'
            ? 原始['iat'] * 1000
            : undefined;
      if (typeof 签发毫秒 === 'number' && 签发毫秒 <= Number(吊销值)) {
        失败响应(响应, 401, 取文案('通用', '令牌无效'), 错误码.登录失效);
        return;
      }
    }
    (请求 as 认证请求).登录用户 = {
      yongHuId: 用户编号,
      shouJiHao: typeof 原始['shouJiHao'] === 'string' ? 原始['shouJiHao'] : '',
      jti: 令牌编号 || undefined,
      iat: typeof 原始['iat'] === 'number' ? 原始['iat'] : undefined,
      exp: typeof 原始['exp'] === 'number' ? 原始['exp'] : undefined,
      qianFaHaoMiao: typeof 原始['qianFaHaoMiao'] === 'number' ? 原始['qianFaHaoMiao'] : undefined,
      tokenType: typeof 原始['tokenType'] === 'string' ? 原始['tokenType'] : undefined,
      sub: typeof 原始['sub'] === 'string' ? 原始['sub'] : undefined,
    };
    下一步();
  } catch (错误) {
    // 非JWT校验异常不得伪装成令牌无效：归一化后真实原因进日志
    响应鉴权或归一(响应, 错误, '认证', 请求);
  }
}
