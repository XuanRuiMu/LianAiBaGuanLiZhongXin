import type { Request, Response } from 'express';
import { 取文案 } from './文案';
import { 失败响应 } from './响应';
import { 错误码, 取错误定义, type 错误码值 } from './错误码';
import { 日志 } from './日志';
import { 校验失败, 记录缺失 } from './校验';

/**
 * 全局唯一错误归一化入口。
 * 根因：各 catch 各自吞异常并统一吐「服务器内部错误 / NEI_BU_CUO_WU」，
 * 使 Postgres 42703（列不存在）这类可定位缺陷与真·内部错误不可区分，服务起来了也查不到原因。
 * 约定：真实原因（SQLSTATE、原始消息）只进服务端日志；对外只给分类后的通用文案与稳定错误码。
 */
export const 错误类别 = {
  数据库: 'shu_ju_ku',
  模式缺失: 'mo_shi_que_shi',
  依赖缺失: 'yi_lai_que_shi',
  鉴权: 'jian_quan',
  业务: 'ye_wu',
  未知: 'wei_zhi',
} as const;

export type 错误类别名 = (typeof 错误类别)[keyof typeof 错误类别];

export interface 归一化结果 {
  类别: 错误类别名;
  状态码: number;
  错误码: 错误码值;
  提示: string;
  fieldErrors?: Record<string, string>;
}

/** SQLSTATE class 42 中确属 schema 缺陷者：表/列/函数/类型/约束不存在或不兼容 */
const 模式缺失状态 = new Set(['42P01', '42P02', '42P10', '42P13', '42P16', '42703', '42704', '42883']);
/** 仅「关系不存在」可降级为「表尚未迁移」；「列不存在」是 schema 缺陷，禁止被降级吞掉 */
const 关系缺失状态 = '42P01';
const 表缺失文本 = /relation\s+"[^"]+"\s+does not exist|no such table/i;
const 列缺失文本 = /column\s+"[^"]+"\s+does not exist/i;
const 状态码文本 = /^[0-9A-Z]{5}$/;
const 连接类状态 = /^(08|57|53|55|58)/;
/** 连接池拿不到连接时抛的是 Node 传输层 errno（无 SQLSTATE），同样属数据库不可达 */
const 传输层不可达码 = new Set(['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EHOSTUNREACH', 'ENETUNREACH', 'EAI_AGAIN']);

function 取错误码(错误: unknown): string {
  const 码 = (错误 as { code?: unknown } | null | undefined)?.code;
  return typeof 码 === 'string' ? 码 : '';
}

function 取状态码(错误: unknown): string {
  const 码 = 取错误码(错误);
  return 状态码文本.test(码) ? 码 : '';
}

function 取原始消息(错误: unknown): string {
  return 错误 instanceof Error ? 错误.message : String(错误);
}

function 是表缺失(错误: unknown): boolean {
  const 码 = 取状态码(错误);
  if (码 === 关系缺失状态) {
    return true;
  }
  return 码 === '' && 表缺失文本.test(取原始消息(错误));
}

/** 对外可判定的「表尚未迁移」降级条件：只有关系不存在才算，列不存在不算 */
export function 可降级为表缺失(错误: unknown): boolean {
  if (错误 instanceof 校验失败 || 错误 instanceof 记录缺失) {
    return false;
  }
  return 是表缺失(错误);
}

/** 数据库错误：带合法 SQLSTATE 即视为查询层错误，与依赖不可达/未知错误区分 */
function 是数据库错误(码: string): boolean {
  if (码 === '') {
    return false;
  }
  const 类 = 码.slice(0, 2);
  return 类 === '42' || 类 === '22' || 类 === '23' || 类 === '25' || 类 === '40' || 连接类状态.test(码);
}

export function 归一化错误(错误: unknown): 归一化结果 {
  if (错误 instanceof 校验失败) {
    return {
      类别: 错误类别.业务,
      状态码: 错误.状态码,
      错误码: 错误码.参数有误,
      提示: 错误.message,
      fieldErrors: 错误.fieldErrors,
    };
  }
  if (错误 instanceof 记录缺失) {
    return { 类别: 错误类别.业务, 状态码: 错误.状态码, 错误码: 错误码.记录未找到, 提示: 错误.message };
  }
  const 码 = 取状态码(错误);
  const 消息 = 取原始消息(错误);
  const 模式类 = (码.slice(0, 2) === '42' && 模式缺失状态.has(码)) || 列缺失文本.test(消息) || 表缺失文本.test(消息);
  if (模式类) {
    return {
      类别: 错误类别.模式缺失,
      状态码: 500,
      错误码: 错误码.表结构不完整,
      提示: 取文案('通用', '数据服务异常'),
    };
  }
  if (是数据库错误(码) || 传输层不可达码.has(取错误码(错误))) {
    return {
      类别: 错误类别.数据库,
      状态码: 500,
      错误码: 错误码.数据服务失败,
      提示: 取文案('通用', '数据服务异常'),
    };
  }
  const 状态码 = (错误 as { status?: unknown } | null | undefined)?.status;
  if (状态码 === 401) {
    return { 类别: 错误类别.鉴权, 状态码: 401, 错误码: 错误码.登录失效, 提示: 取文案('通用', '令牌无效') };
  }
  if (状态码 === 400) {
    return { 类别: 错误类别.业务, 状态码: 400, 错误码: 错误码.参数有误, 提示: 取文案('通用', '参数错误') };
  }
  return { 类别: 错误类别.未知, 状态码: 500, 错误码: 错误码.内部错误, 提示: 取文案('通用', '服务器内部错误') };
}

function 记日志(级别: '警告' | '错误', 模块: string, 消息: string, 归一: 归一化结果, 错误: unknown, 请求?: Request): void {
  const 详情: Record<string, unknown> = {
    类别: 归一.类别,
    错误码: 归一.错误码,
    错误: 错误 instanceof Error ? 错误.message : String(错误),
  };
  const 码 = 取状态码(错误);
  if (码 !== '') {
    详情['数据库状态码'] = 码;
  }
  const 约束 = (错误 as { constraint?: unknown } | null | undefined)?.constraint;
  if (typeof 约束 === 'string') {
    详情['约束'] = 约束;
  }
  if (请求) {
    详情['路径'] = 请求.path;
    详情['请求编号'] = (请求 as Request & { 请求编号?: string }).请求编号 ?? '';
  }
  日志[级别](模块, 消息, 详情);
}

/** 归一化并落盘真实原因；对外仅返回分类后的通用文案 */
export function 响应归一化错误(响应: Response, 错误: unknown, 模块: string, 请求?: Request): void {
  const 归一 = 归一化错误(错误);
  if (归一.类别 === 错误类别.业务) {
    日志.信息(模块, '业务校验未通过', { 错误码: 归一.错误码, 路径: 请求?.path ?? '' });
  } else {
    记日志('错误', 模块, '请求处理异常', 归一, 错误, 请求);
  }
  失败响应(响应, 归一.状态码, 归一.提示, 归一.错误码, { fieldErrors: 归一.fieldErrors });
}

/** Express 全局错误中间件入口：与响应归一化错误同源，禁止再各写一份 */
export function 归一化错误中间件(模块 = '应用') {
  return (错误: unknown, 请求: Request, 响应: Response, 下一步: (错误: unknown) => void): void => {
    if (响应.headersSent) {
      下一步(错误);
      return;
    }
    响应归一化错误(响应, 错误, 模块, 请求);
  };
}

/** 应用内依赖（查询池/缓存）未注入：属部署装配问题，与数据库查询失败区分 */
export function 响应依赖缺失(响应: Response, 模块: string, 依赖: '数据库' | '缓存', 请求?: Request): void {
  const 代码 = 依赖 === '缓存' ? 错误码.缓存服务不可用 : 错误码.依赖未就绪;
  const 归一: 归一化结果 = {
    类别: 错误类别.依赖缺失,
    状态码: 取错误定义(代码)?.状态码 ?? 500,
    错误码: 代码,
    提示: 依赖 === '缓存' ? 取文案('通用', '缓存不可用') : 取文案('通用', '依赖未就绪'),
  };
  日志.错误(模块, `${依赖}依赖未注入`, { 类别: 归一.类别, 错误码: 归一.错误码, 路径: 请求?.path ?? '' });
  失败响应(响应, 归一.状态码, 归一.提示, 归一.错误码, { fieldErrors: 归一.fieldErrors });
}

export function 响应健康检查失败(
  响应: Response,
  模块: string,
  错误列表: readonly unknown[],
  请求?: Request,
): void {
  for (const [序号, 错误] of 错误列表.entries()) {
    日志.错误(模块, '健康检查依赖异常', {
      序号,
      错误: 错误 instanceof Error ? 错误.message : String(错误),
      路径: 请求?.path ?? '',
      请求编号: (请求 as Request & { 请求编号?: string }).请求编号 ?? '',
    });
  }
  失败响应(响应, 503, 取文案('通用', '依赖未就绪'), 错误码.依赖未就绪);
}

/** 令牌类异常仍按鉴权处理，其余不得伪装成「令牌无效」 */
export function 响应鉴权或归一(响应: Response, 错误: unknown, 模块: string, 请求?: Request): void {
  const 名 = (错误 as { name?: unknown } | null | undefined)?.name;
  const 是令牌异常 = typeof 名 === 'string' && (名.startsWith('JsonWebToken') || 名 === 'TokenExpiredError' || 名 === 'NotBeforeError');
  if (是令牌异常) {
    日志.信息(模块, '令牌校验未通过', { 类别: 错误类别.鉴权, 错误码: 错误码.登录失效, 路径: 请求?.path ?? '' });
    失败响应(响应, 401, 取文案('通用', '令牌无效'), 错误码.登录失效);
    return;
  }
  响应归一化错误(响应, 错误, 模块, 请求);
}

/** 缓存操作失败（连接可用但命令失败）：与令牌无效区分，禁误判为鉴权失败 */
export function 响应缓存不可用(响应: Response, 模块: string, 错误: unknown, 请求?: Request): void {
  const 归一: 归一化结果 = {
    类别: 错误类别.依赖缺失,
    状态码: 取错误定义(错误码.缓存服务不可用)?.状态码 ?? 503,
    错误码: 错误码.缓存服务不可用,
    提示: 取文案('通用', '缓存不可用'),
  };
  记日志('错误', 模块, '缓存操作失败', 归一, 错误, 请求);
  失败响应(响应, 归一.状态码, 归一.提示, 归一.错误码, { fieldErrors: 归一.fieldErrors });
}

/** 持有「表缺失降级」文案的分组，降级入口只接受这些分组 */
export type 可降级文案分组 = '封禁' | '审核' | '审计' | '思考' | '统计';

/**
 * 只读查询的「表尚未迁移」降级入口（单一实现）。
 * 关系不存在 → 保持可恢复的 503 失败包络 + BIAO_QUE_SHI_JIANG_JI 契约；
 * 其余错误（列缺失、连接中断、鉴权外的一切）→ 归一化到各自错误码，禁止再一律吐表缺失。
 */
export function 响应查询降级(
  响应: Response,
  错误: unknown,
  模块: string,
  文案分组: 可降级文案分组,
  请求?: Request,
): void {
  if (可降级为表缺失(错误)) {
    日志.警告(模块, '表未迁移，只读查询降级', {
      类别: 错误类别.依赖缺失,
      错误码: 错误码.数据表未就绪,
      错误: 错误 instanceof Error ? 错误.message : String(错误),
      路径: 请求?.path ?? '',
    });
    失败响应(响应, 503, 取文案(文案分组, '表缺失降级'), 错误码.数据表未就绪);
    return;
  }
  响应归一化错误(响应, 错误, 模块, 请求);
}
