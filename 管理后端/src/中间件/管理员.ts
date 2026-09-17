import type { Response, NextFunction } from 'express';
import type { Request } from 'express';
import { 取文案 } from '../文案';
import { 失败响应 } from '../响应';
import { 日志 } from '../日志';
import type { 查询池 } from '../数据库';
import type { 认证请求 } from './认证';
import type { 缓存客户端 } from '../缓存';

const 缓存有效毫秒 = 30 * 1000;
const 缓存上限 = 5000;
const 管理员缓存 = new Map<string, { 值: boolean; 到期毫秒: number }>();

export type GuanLiJiaoSe = 'shen_he_yuan' | 'yun_ying' | 'chao_guan';

const 角色缓存 = new Map<string, { 值: GuanLiJiaoSe | null; 到期毫秒: number }>();

export function 取管理角色(行: Record<string, unknown>): GuanLiJiaoSe | null {
  // YH-108 RBAC三角色：管理员旗标为超管；其余按审核/运营旗标划分，无旗标无管理权限
  if (行['管理员'] === true) return 'chao_guan';
  if (行['运营'] === true) return 'yun_ying';
  if (行['审核员'] === true) return 'shen_he_yuan';
  return null;
}

export function 清空管理员缓存(用户编号?: string): void {
  if (用户编号) {
    管理员缓存.delete(用户编号);
    角色缓存.delete(用户编号);
    return;
  }
  管理员缓存.clear();
  角色缓存.clear();
}

const 失效广播频道 = 'guan_li_shi_xiao';

export function 订阅失效广播(缓存: 缓存客户端): Promise<() => void> {
  return 缓存.subscribe(失效广播频道, (消息: string) => {
    try {
      const 解析 = JSON.parse(消息) as { 用户编号?: unknown };
      if (typeof 解析.用户编号 === 'string' && 解析.用户编号.length > 0) {
        管理员缓存.delete(解析.用户编号);
      } else {
        管理员缓存.clear();
      }
    } catch {
      管理员缓存.clear();
    }
  });
}

export async function 广播管理员失效(缓存: 缓存客户端 | undefined, 用户编号?: string): Promise<void> {
  if (用户编号) {
    管理员缓存.delete(用户编号);
    角色缓存.delete(用户编号);
  } else {
    管理员缓存.clear();
    角色缓存.clear();
  }
  if (!缓存) {
    return;
  }
  try {
    await 缓存.publish(失效广播频道, JSON.stringify({ 用户编号: 用户编号 ?? null }));
  } catch {
    return;
  }
}

function 写入缓存(用户编号: string, 值: boolean): void {
  if (管理员缓存.size >= 缓存上限) {
    const 现在 = Date.now();
    for (const [键, 项] of 管理员缓存) {
      if (项.到期毫秒 <= 现在) {
        管理员缓存.delete(键);
      }
    }
    if (管理员缓存.size >= 缓存上限) {
      管理员缓存.clear();
    }
  }
  管理员缓存.set(用户编号, { 值, 到期毫秒: Date.now() + 缓存有效毫秒 });
}

export async function 按用户编号判断管理员(用户编号: string, 池: 查询池): Promise<boolean> {
  return (await 按用户编号取角色(用户编号, 池)) !== null;
}

/** YH-108 RBAC角色查询：三角色任一即有管理身份，缓存与管理员判定同失效通道 */
export async function 按用户编号取角色(用户编号: string, 池: 查询池): Promise<GuanLiJiaoSe | null> {
  const 缓存项 = 角色缓存.get(用户编号);
  if (缓存项 && 缓存项.到期毫秒 > Date.now()) {
    return 缓存项.值;
  }
  // YH-107 读写分离：角色判定只读用户旗标列，不读PII明文字段
  const 结果 = await 池.query('SELECT "管理员", "运营", "审核员" FROM "用户" WHERE "ID" = $1 LIMIT 1', [用户编号]);
  if (结果.rows.length === 0) {
    角色缓存.set(用户编号, { 值: null, 到期毫秒: Date.now() + 缓存有效毫秒 });
    return null;
  }
  const 角色 = 取管理角色(结果.rows[0]);
  角色缓存.set(用户编号, { 值: 角色, 到期毫秒: Date.now() + 缓存有效毫秒 });
  写入缓存(用户编号, 角色 !== null);
  return 角色;
}

export async function 管理员门禁(请求: Request, 响应: Response, 下一步: NextFunction): Promise<void> {
  const 登录用户 = (请求 as 认证请求).登录用户;
  if (!登录用户) {
    失败响应(响应, 401, 取文案('通用', '未授权'), 'WEI_SHOU_QUAN');
    return;
  }
  const 池 = (请求.app.locals as { 池?: 查询池 }).池;
  if (!池) {
    失败响应(响应, 500, 取文案('通用', '服务器内部错误'), 'NEI_BU_CUO_WU');
    return;
  }
  try {
    const 角色 = await 按用户编号取角色(登录用户.yongHuId, 池);
    if (角色 === null) {
      失败响应(响应, 403, 取文案('通用', '无管理员权限'), 'WU_GUAN_LI_QUAN_XIAN');
      return;
    }
    (请求 as 认证请求 & { 管理角色?: GuanLiJiaoSe }).管理角色 = 角色;
    下一步();
  } catch (错误) {
    日志.错误('管理员门禁', '管理员身份校验失败', { 错误: 错误 instanceof Error ? 错误.message : String(错误) });
    失败响应(响应, 500, 取文案('通用', '服务器内部错误'), 'NEI_BU_CUO_WU');
  }
}

/** YH-108 高危双人复核门禁：授回收/封禁写入仅超管可执行，审核员/运营越权403 */
export async function 高危操作门禁(请求: Request, 响应: Response, 下一步: NextFunction): Promise<void> {
  const 角色 = (请求 as 认证请求 & { 管理角色?: GuanLiJiaoSe }).管理角色;
  if (角色 === 'chao_guan') {
    下一步();
    return;
  }
  if (!角色) {
    失败响应(响应, 401, 取文案('通用', '未授权'), 'WEI_SHOU_QUAN');
    return;
  }
  失败响应(响应, 403, 取文案('通用', '无管理员权限'), 'WU_GUAN_LI_QUAN_XIAN');
}
