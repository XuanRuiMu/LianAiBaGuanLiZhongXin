import type { Response, NextFunction } from 'express';
import type { Request } from 'express';
import { 取文案 } from '../文案';
import { 失败响应 } from '../响应';
import { 错误码 } from '../错误码';
import { 日志 } from '../日志';
import type { 查询池 } from '../数据库';
import type { 认证请求 } from './认证';
import type { 缓存客户端 } from '../缓存';
import { 响应依赖缺失, 响应归一化错误 } from '../错误归一化';

const 缓存有效毫秒 = 30 * 1000;
const 缓存上限 = 5000;

export type GuanLiJiaoSe = 'shen_he_yuan' | 'yun_ying' | 'chao_guan';

/**
 * YH-108 权限矩阵能力位：cha_kan=只读路由，feng_jin=封禁/解封写，feng_jin_shen_he=封禁申诉审核，
 * tong_ji_xie=统计路由族（含读审计写侧），gao_we=超管高危写（授回收/夺舍/归还/审核评审发布）
 */
export type GuanLiNengLi = 'cha_kan' | 'feng_jin' | 'feng_jin_shen_he' | 'tong_ji_xie' | 'gao_we';

/** 能力位→docs/契约.md 第8行中文口径的唯一映射，矩阵与文档逐字一致守卫据此派生 */
export const 能力中文口径: Record<GuanLiNengLi, string> = {
  cha_kan: '读',
  feng_jin: '封禁',
  feng_jin_shen_he: '封禁审核',
  tong_ji_xie: '统计',
  gao_we: '授回收',
};

export const 管理角色清单: readonly GuanLiJiaoSe[] = ['chao_guan', 'yun_ying', 'shen_he_yuan'];

/**
 * YH-108 权限矩阵唯一真源：门禁与身份接口能力回传同读此表，禁第二份副本。
 * FP-17（用户裁决 L-27）按 docs/契约.md 第8行扩权：审核员=读加封禁审核、运营=读加封禁加统计、超管=全量加授回收。
 */
export const 角色能力矩阵: Record<GuanLiJiaoSe, readonly GuanLiNengLi[]> = {
  chao_guan: ['cha_kan', 'feng_jin', 'feng_jin_shen_he', 'tong_ji_xie', 'gao_we'],
  yun_ying: ['cha_kan', 'feng_jin', 'tong_ji_xie'],
  shen_he_yuan: ['cha_kan', 'feng_jin_shen_he'],
};

const 角色缓存 = new Map<string, { 值: GuanLiJiaoSe | null; 到期毫秒: number }>();

export function 取管理角色(行: Record<string, unknown>): GuanLiJiaoSe | null {
  // YH-108 RBAC三角色：管理员旗标为超管；其余按审核/运营旗标划分，无旗标无管理权限
  if (行['管理员'] === true) return 'chao_guan';
  if (行['运营'] === true) return 'yun_ying';
  if (行['审核员'] === true) return 'shen_he_yuan';
  return null;
}

export function 取角色能力(角色: GuanLiJiaoSe | null): readonly GuanLiNengLi[] {
  if (角色 === null) {
    return [];
  }
  return 角色能力矩阵[角色];
}

export function 清空管理员缓存(用户编号?: string): void {
  if (用户编号) {
    角色缓存.delete(用户编号);
    return;
  }
  角色缓存.clear();
}

const 失效广播频道 = 'guan_li_shi_xiao';

export function 订阅失效广播(缓存: 缓存客户端): Promise<() => void> {
  return 缓存.subscribe(失效广播频道, (消息: string) => {
    // YH-108 跨实例失效必须清角色缓存，否则改完权限要等本实例缓存过期才生效
    try {
      const 解析 = JSON.parse(消息) as { 用户编号?: unknown };
      if (typeof 解析.用户编号 === 'string' && 解析.用户编号.length > 0) {
        角色缓存.delete(解析.用户编号);
      } else {
        角色缓存.clear();
      }
    } catch {
      角色缓存.clear();
    }
  });
}

export async function 广播管理员失效(缓存: 缓存客户端 | undefined, 用户编号?: string): Promise<void> {
  if (用户编号) {
    角色缓存.delete(用户编号);
  } else {
    角色缓存.clear();
  }
  if (!缓存) {
    return;
  }
  try {
    await 缓存.publish(失效广播频道, JSON.stringify({ 用户编号: 用户编号 ?? null }));
  } catch (错误) {
    // 广播失败＝其他实例要等 TTL 才看到新权限，静默会让「改完不生效」无从排查
    日志.警告('管理员门禁', '角色失效广播发布失败，其他实例需等缓存过期', {
      错误: 错误 instanceof Error ? 错误.message : String(错误),
      目标: 用户编号 ?? '全量',
    });
  }
}

function 写入角色缓存(用户编号: string, 值: GuanLiJiaoSe | null): void {
  if (!角色缓存.has(用户编号) && 角色缓存.size >= 缓存上限) {
    const 现在 = Date.now();
    for (const [键, 项] of 角色缓存) {
      if (项.到期毫秒 <= 现在) {
        角色缓存.delete(键);
      }
    }
    if (角色缓存.size >= 缓存上限) {
      角色缓存.clear();
    }
  }
  角色缓存.set(用户编号, { 值, 到期毫秒: Date.now() + 缓存有效毫秒 });
}

/** YH-108 RBAC角色查询：三角色任一即有管理身份，缓存与授予/回收同一失效通道 */
export async function 按用户编号取角色(用户编号: string, 池: 查询池): Promise<GuanLiJiaoSe | null> {
  const 缓存项 = 角色缓存.get(用户编号);
  if (缓存项 && 缓存项.到期毫秒 > Date.now()) {
    return 缓存项.值;
  }
  // YH-107 读写分离：角色判定只读用户旗标列，不读PII明文字段
  const 结果 = await 池.query('SELECT "管理员", "运营", "审核员" FROM "用户" WHERE "ID" = $1 LIMIT 1', [用户编号]);
  const 角色 = 结果.rows.length === 0 ? null : 取管理角色(结果.rows[0]);
  写入角色缓存(用户编号, 角色);
  return 角色;
}

export async function 管理员门禁(请求: Request, 响应: Response, 下一步: NextFunction): Promise<void> {
  const 登录用户 = (请求 as 认证请求).登录用户;
  if (!登录用户) {
    失败响应(响应, 401, 取文案('通用', '未授权'), 错误码.未授权);
    return;
  }
  const 池 = (请求.app.locals as { 池?: 查询池 }).池;
  if (!池) {
    响应依赖缺失(响应, '管理员门禁', '数据库', 请求);
    return;
  }
  try {
    const 角色 = await 按用户编号取角色(登录用户.yongHuId, 池);
    if (角色 === null) {
      失败响应(响应, 403, 取文案('通用', '无管理员权限'), 错误码.无管理身份);
      return;
    }
    (请求 as 认证请求 & { 管理角色?: GuanLiJiaoSe }).管理角色 = 角色;
    下一步();
  } catch (错误) {
    响应归一化错误(响应, 错误, '管理员门禁', 请求);
  }
}

/**
 * FP-17 能力门禁唯一实现：授权一律按查库角色在角色能力矩阵中的能力位，缺位 403 WU_GUAN_LI_QUAN_XIAN。
 * 高危操作门禁即所需能力为 gao_we 的实例；新增写路由必须经本工厂挂位，禁自带判定分支。
 */
export function 创建能力门禁(所需能力: GuanLiNengLi) {
  return async function 能力门禁(请求: Request, 响应: Response, 下一步: NextFunction): Promise<void> {
    const 角色 = (请求 as 认证请求 & { 管理角色?: GuanLiJiaoSe }).管理角色;
    if (!角色) {
      失败响应(响应, 401, 取文案('通用', '未授权'), 错误码.未授权);
      return;
    }
    if (取角色能力(角色).includes(所需能力)) {
      下一步();
      return;
    }
    失败响应(响应, 403, 取文案('通用', '无管理员权限'), 错误码.无管理身份);
  };
}

/** YH-108 高危双人复核门禁：角色能力矩阵含 gao_we 才可执行（授回收/夺舍/归还/审核评审发布仍超管专属） */
export const 高危操作门禁 = 创建能力门禁('gao_we');

/** FP-17 封禁/解封写门禁：按契约第8行归运营（读加封禁加统计） */
export const 封禁操作门禁 = 创建能力门禁('feng_jin');

/** FP-17 封禁申诉审核门禁：按契约第8行归审核员（读加封禁审核） */
export const 封禁审核操作门禁 = 创建能力门禁('feng_jin_shen_he');

/** FP-17 统计路由族门禁：含读审计写侧，按契约第8行归运营 */
export const 统计操作门禁 = 创建能力门禁('tong_ji_xie');
