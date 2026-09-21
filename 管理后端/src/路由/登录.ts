import { Router, type Request, type Response, type RequestHandler } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { 取文案 } from '../文案';
import { 成功响应, 失败响应 } from '../响应';
import { 错误码 } from '../错误码';
import { 日志 } from '../日志';
import { 当前配置 } from '../配置';
import {
  校验手机号,
  取可选字符串,
  取必填字符串,
  校验失败,
} from '../校验';
import type { 查询池 } from '../数据库';
import type { 缓存客户端 } from '../缓存';
import { 响应依赖缺失, 响应缓存不可用 } from '../错误归一化';
import { 取管理角色, 取角色能力, type GuanLiJiaoSe } from '../中间件/管理员';
import type { 认证请求 } from '../中间件/认证';

function 取池(请求: Request): 查询池 | undefined {
  return (请求.app.locals as { 池?: 查询池 }).池;
}

function 取缓存(请求: Request): 缓存客户端 | undefined {
  return (请求.app.locals as { 缓存?: 缓存客户端 }).缓存;
}

/** YH-108 登录取用户语句导出为常量：真连库模式契约据此检出缺列，禁测试另抄一份 */
export const 登录取用户语句 =
  'SELECT "ID", "手机号", "用户名", "密码哈希", "管理员", "运营", "审核员" FROM "用户" WHERE "手机号" = $1 LIMIT 1';

export function 创建登录路由(写限流: RequestHandler): Router {
  const 路由 = Router();

  路由.post('/deng-lu', 写限流, async (请求: Request, 响应: Response): Promise<void> => {
    const 池 = 取池(请求);
    if (!池) {
      响应依赖缺失(响应, '管理登录', '数据库', 请求);
      return;
    }
    const 正文 = (请求.body ?? {}) as Record<string, unknown>;
    const 手机号 = 校验手机号('shou_ji_hao', 取可选字符串(正文['shou_ji_hao']));
    const 密码 = 取必填字符串(取可选字符串(正文['mi_ma']), 'mi_ma', 200);
    // YH-031 管理端密码复杂度收敛：与游戏端同口径8位加字母数字，禁弱口令黑名单
    if (密码.length < 8 || 密码.length > 200 || !/[A-Za-z]/.test(密码) || !/[0-9]/.test(密码)) {
      throw new 校验失败(取文案('登录', '账号或密码错误'));
    }
    const 行 = await 池.query(登录取用户语句, [手机号]);
    if (行.rows.length === 0) {
      await bcrypt.hash(密码, 12);
      throw new 校验失败(取文案('登录', '账号或密码错误'));
    }
    const 目标 = 行.rows[0];
    const 哈希 = typeof 目标['密码哈希'] === 'string' ? String(目标['密码哈希']) : '';
    const 通过 = 哈希 ? await bcrypt.compare(密码, 哈希) : false;
    if (!通过) {
      throw new 校验失败(取文案('登录', '账号或密码错误'));
    }
    // YH-108 三角色登录链路接通：超管/运营/审核员任一旗标即可登录，无旗标403
    const 角色 = 取管理角色(目标);
    if (角色 === null) {
      失败响应(响应, 403, 取文案('通用', '无管理员权限'), 错误码.无管理身份);
      return;
    }
    const 用户编号 = String(目标['ID']);
    const 令牌有效期 = 当前配置().令牌有效期;
    // YH-031 签发算法白名单HS256显式声明；jiaoSe仅作回显标识，后续请求角色一律服务端查库（按用户编号取角色）
    const 令牌 = jwt.sign(
      { yongHuId: 用户编号, jiaoSe: 角色, qianFaHaoMiao: Date.now() },
      当前配置().令牌密钥,
      { expiresIn: 令牌有效期, algorithm: 'HS256', jwtid: `guan-li-${Date.now()}-${用户编号.slice(0, 8)}` } as jwt.SignOptions,
    );
    const 缓存 = 取缓存(请求);
    if (缓存) {
      try {
        await 缓存.set(`guan_li_deng_lu:${用户编号}`, String(Date.now()), 15 * 60);
      } catch (错误) {
        日志.警告('管理登录', '登录留痕写入缓存失败', { 错误: 错误 instanceof Error ? 错误.message : String(错误) });
      }
    }
    const 刷新有效秒 = 当前配置().刷新有效秒;
    const 刷新编号 = `guan-li-shua-xin-${Date.now()}-${用户编号.slice(0, 8)}`;
    if (缓存) {
      try {
        await 缓存.set(`guan_li_shua_xin:${刷新编号}`, 用户编号, 刷新有效秒);
      } catch (错误) {
        日志.警告('管理登录', '刷新令牌写入缓存失败', { 错误: 错误 instanceof Error ? 错误.message : String(错误) });
      }
    }
    日志.信息('管理登录', '管理身份登录成功', { 用户编号, 角色 });
    const 安全 = 请求.secure || 请求.headers['x-forwarded-proto'] === 'https' || 当前配置().运行环境 !== 'prod';
    响应.cookie('guan_li_ling_pai', 令牌, {
      httpOnly: true,
      secure: 安全,
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000,
      path: '/api/guan-li',
    });
    响应.cookie('guan_li_shua_xin', 刷新编号, {
      httpOnly: true,
      secure: 安全,
      sameSite: 'strict',
      maxAge: 刷新有效秒 * 1000,
      path: '/api/guan-li/shua-xin',
    });
    成功响应(响应, {
      yong_hu_id: 用户编号,
      yong_hu_ming: 目标['用户名'] === null ? null : String(目标['用户名']),
      jiao_se: 角色,
      // YH-108 能力随角色一并回传，前端首屏权限视图与门禁同读一张角色能力矩阵，不留未知窗口
      neng_li: [...取角色能力(角色)],
    });
  });

  路由.post('/shua-xin', 写限流, async (请求: Request, 响应: Response): Promise<void> => {
    const 池 = 取池(请求);
    if (!池) {
      响应依赖缺失(响应, '管理登录', '数据库', 请求);
      return;
    }
    const 缓存 = 取缓存(请求);
    if (!缓存) {
      响应依赖缺失(响应, '管理登录', '缓存', 请求);
      return;
    }
    const 正文 = (请求.body ?? {}) as Record<string, unknown>;
    const 刷新令牌 = 取可选字符串(正文['shua_xin_ling_pai']) ?? (typeof 请求.cookies?.['guan_li_shua_xin'] === 'string' ? String(请求.cookies['guan_li_shua_xin']) : undefined);
    if (刷新令牌 === undefined) {
      失败响应(响应, 400, 取文案('通用', '参数错误'), 错误码.参数有误);
      return;
    }
    let 目标编号: string | null;
    try {
      目标编号 = await 缓存.get(`guan_li_shua_xin:${刷新令牌}`);
    } catch (错误) {
      响应缓存不可用(响应, '管理登录', 错误, 请求);
      return;
    }
    if (目标编号 === null) {
      失败响应(响应, 401, 取文案('登录', '刷新令牌无效'), 错误码.登录失效);
      return;
    }
    try {
      await 缓存.del(`guan_li_shua_xin:${刷新令牌}`);
    } catch (错误) {
      响应缓存不可用(响应, '管理登录', 错误, 请求);
      return;
    }
    const 查 = await 池.query('SELECT "管理员", "运营", "审核员" FROM "用户" WHERE "ID" = $1 LIMIT 1', [目标编号]);
    // YH-108 签票同口径：三角色任一可续，签票角色以本次查库结果为权威
    const 角色 = 查.rows.length === 0 ? null : 取管理角色(查.rows[0]);
    if (角色 === null) {
      失败响应(响应, 401, 取文案('登录', '刷新令牌无效'), 错误码.登录失效);
      return;
    }
    const 令牌有效期 = 当前配置().令牌有效期;
    const 新令牌 = jwt.sign(
      { yongHuId: 目标编号, jiaoSe: 角色, qianFaHaoMiao: Date.now() },
      当前配置().令牌密钥,
      { expiresIn: 令牌有效期, algorithm: 'HS256', jwtid: `guan-li-${Date.now()}-${目标编号.slice(0, 8)}` } as jwt.SignOptions,
    );
    const 新刷新编号 = `guan-li-shua-xin-${Date.now()}-${目标编号.slice(0, 8)}`;
    try {
      await 缓存.set(`guan_li_shua_xin:${新刷新编号}`, 目标编号, 当前配置().刷新有效秒);
    } catch (错误) {
      响应缓存不可用(响应, '管理登录', 错误, 请求);
      return;
    }
    日志.信息('管理登录', '管理令牌轮换成功', { 用户编号: 目标编号, 角色 });
    const 安全 = 请求.secure || 请求.headers['x-forwarded-proto'] === 'https' || 当前配置().运行环境 !== 'prod';
    响应.cookie('guan_li_ling_pai', 新令牌, {
      httpOnly: true,
      secure: 安全,
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000,
      path: '/api/guan-li',
    });
    响应.cookie('guan_li_shua_xin', 新刷新编号, {
      httpOnly: true,
      secure: 安全,
      sameSite: 'strict',
      maxAge: 当前配置().刷新有效秒 * 1000,
      path: '/api/guan-li/shua-xin',
    });
    成功响应(响应, { yong_hu_id: 目标编号, jiao_se: 角色, neng_li: [...取角色能力(角色)] });
  });

  return 路由;
}

/**
 * YH-108 当前身份路由：挂在认证+管理员门禁之后，角色与能力一律取服务端查库结果，
 * 供前端刷新页面后重建权限视图（前端隐藏不是安全边界，门禁仍逐请求生效）。
 */
export function 创建身份路由(): Router {
  const 路由 = Router();

  路由.get('/wo-de-jiao-se', (请求: Request, 响应: Response): void => {
    const 带角色请求 = 请求 as 认证请求 & { 管理角色?: GuanLiJiaoSe };
    const 角色 = 带角色请求.管理角色 ?? null;
    成功响应(响应, {
      yong_hu_id: 带角色请求.登录用户?.yongHuId ?? '',
      jiao_se: 角色,
      neng_li: [...取角色能力(角色)],
    });
  });

  return 路由;
}
