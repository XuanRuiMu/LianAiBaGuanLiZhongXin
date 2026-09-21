process.env.DOTENV_CONFIG_QUIET = 'true';

import crypto from 'node:crypto';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { 当前配置, 启动前补齐主配置 } from '../src/配置';
import { 创建池, type 查询池 } from '../src/数据库';
import { 校验手机号, 校验失败 } from '../src/校验';

export const 测试超管手机号 = '13900000002';
export const 测试超管用户名 = '测试超级管理员';
export const 哈希代价 = 12;

const 口令随机字节 = 18;
const 口令最小长度 = 8;
const 口令最大长度 = 200;
const 口令生成重试上限 = 32;

/** 只插入、绝不改动既有行：手机号命中唯一键即跳过，二次执行不产生第二行 */
export const 建号语句 =
  'INSERT INTO "用户" ("手机号", "用户名", "密码哈希", "管理员", "运营", "审核员") ' +
  'VALUES ($1, $2, $3, TRUE, TRUE, TRUE) ' +
  'ON CONFLICT ("手机号") DO NOTHING RETURNING "ID"';

const 字母表达式 = /[A-Za-z]/;
const 数字表达式 = /[0-9]/;

/** 与 管理后端/src/路由/登录.ts 的管理端口令复杂度逐条同口径 */
export function 满足口令规则(口令: string): boolean {
  return (
    口令.length >= 口令最小长度 &&
    口令.length <= 口令最大长度 &&
    字母表达式.test(口令) &&
    数字表达式.test(口令)
  );
}

export function 生成口令(): string {
  for (let 次 = 0; 次 < 口令生成重试上限; 次 += 1) {
    const 候选 = crypto.randomBytes(口令随机字节).toString('base64url');
    if (满足口令规则(候选)) {
      return 候选;
    }
  }
  throw new Error('口令生成失败');
}

export async function 执行建号(
  池: 查询池,
  口令: string,
  手机号: string = 测试超管手机号,
  用户名: string = 测试超管用户名,
): Promise<'已创建' | '已存在'> {
  const 白名单手机号 = 校验手机号('shou_ji_hao', 手机号);
  if (!满足口令规则(口令)) {
    throw new 校验失败(`口令不满足管理端登录复杂度（${口令最小长度}-${口令最大长度} 位且同时含字母与数字）`);
  }
  const 哈希 = await bcrypt.hash(口令, 哈希代价);
  const 结果 = await 池.query(建号语句, [白名单手机号, 用户名, 哈希]);
  return 结果.rows.length > 0 ? '已创建' : '已存在';
}

const 连接类状态码 = new Set(['28000', '3D000', '08001', '08006', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'EHOSTUNREACH']);

const 处置提示表: Record<string, string> = {
  '23505': '建号未完成：该手机号或用户名已被占用，本脚本不改动既有账号；请换一个测试手机号，或先按 docs/运维手册.md 的删除回滚语句处理',
  '42P01': '建号未完成：共享库里没找到 用户 表，请确认连的是与游戏侧同一套数据库',
  '42501': '建号未完成：当前数据库账号没有写入 用户 表的权限，请换用有写权限的连接串',
  '42P10': '建号未完成：用户.手机号 上没有唯一约束，幂等插入无法成立；请确认连的是与游戏侧同一套已迁移的库',
  连接失败: '建号未完成：数据库连接失败，请确认共享库容器已启动，且 DATABASE_URL 已在 管理后端/.env 或与主仓同源补齐（本脚本不回显连接串）',
  未知: '建号未完成：数据库操作未成功，请确认在 管理后端 目录下运行且连接串可用；仍失败请把本行原文交给运维',
};

export function 建号失败提示(错误: unknown): string {
  const 状态码 = (错误 as { code?: unknown })?.code;
  const 键 = typeof 状态码 === 'string' ? 状态码 : '';
  if (处置提示表[键]) {
    return 处置提示表[键];
  }
  return 连接类状态码.has(键) ? 处置提示表['连接失败'] : 处置提示表['未知'];
}

export function 组装输出(结果: '已创建' | '已存在', 手机号: string, 口令: string): string {
  if (结果 === '已存在') {
    return [
      '测试超管账号已存在，本次未插入任何数据，也未改动既有行。',
      `手机号：${手机号}`,
      '要换口令请先按 docs/运维手册.md 的删除回滚语句删除该测试账号，再重跑本脚本。',
    ].join('\n');
  }
  return [
    '测试超管账号已创建（管理员/运营/审核员三旗标全开）。',
    `手机号：${手机号}`,
    `一次性口令：${口令}`,
    '口令只在此处输出一次，不写盘不入日志；忘记口令请按 docs/运维手册.md 的删除回滚语句删号后重跑本脚本。',
  ].join('\n');
}

interface 运行结果 {
  文本: string;
  退出码: number;
}

async function 主流程(): Promise<运行结果> {
  启动前补齐主配置(path.resolve(__dirname, '..'));
  if (当前配置().数据库连接串 === '') {
    return { 文本: 处置提示表['连接失败'], 退出码: 1 };
  }
  const 传入口令 = (process.env.CE_SHI_CHAO_GUAN_KOU_LING ?? '').trim();
  const 口令 = 传入口令 === '' ? 生成口令() : 传入口令;
  if (!满足口令规则(口令)) {
    return {
      文本: `建号未完成：传入的口令不满足管理端登录复杂度（${口令最小长度}-${口令最大长度} 位且同时含字母与数字）`,
      退出码: 1,
    };
  }
  const 池 = 创建池();
  try {
    const 结果 = await 执行建号(池, 口令);
    return { 文本: 组装输出(结果, 测试超管手机号, 口令), 退出码: 0 };
  } catch (错误) {
    return { 文本: 建号失败提示(错误), 退出码: 1 };
  }
}

if (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module) {
  const 交回 = (输出: 运行结果): void => {
    process.stdout.write(`${输出.文本}\n`, () => process.exit(输出.退出码));
  };
  主流程().then(交回).catch(() => 交回({ 文本: 处置提示表['未知'], 退出码: 1 }));
}
