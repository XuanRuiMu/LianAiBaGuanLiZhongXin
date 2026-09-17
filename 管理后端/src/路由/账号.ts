import { Router, type Request, type Response } from 'express';
import { 取文案 } from '../文案';
import { 成功响应, 失败响应 } from '../响应';
import {
  校验UUID,
  校验手机号,
  解析分页,
  取可选字符串,
  记录缺失,
} from '../校验';
import type { 查询池 } from '../数据库';
import type { 认证请求 } from '../中间件/认证';
import { 取真实IP } from '../真实IP';

function 取池(请求: Request): 查询池 | undefined {
  return (请求.app.locals as { 池?: 查询池 }).池;
}

function 掩码手机号(原始: unknown): string {
  if (typeof 原始 !== 'string' || !/^1[3-9]\d{9}$/.test(原始)) {
    return '';
  }
  return `${原始.slice(0, 3)}****${原始.slice(7)}`;
}

function 脱敏列表行(行: Record<string, unknown>): Record<string, unknown> {
  const 副本 = { ...行 };
  副本['手机号'] = 掩码手机号(副本['手机号']);
  return 副本;
}

async function 记敏感读审计(池: 查询池, 请求: Request, 目标用户: string, 动作: string): Promise<void> {
  const 操作者 = (请求 as 认证请求).登录用户;
  const 查 = async (文本: string, 参数?: unknown[]) => 池.query(文本, 参数);
  const 落库 = async (查函数: (文本: string, 参数?: unknown[]) => Promise<unknown>): Promise<void> => {
    await 查函数('INSERT INTO "审计日志" ("用户ID", "IP", "事件类型", "详情", "类型") VALUES ($1, $2, $3, $4::jsonb, $5)', [
      操作者?.yongHuId ?? null,
      // YH-016 审计IP用真实IP推导，不用客户端可控XFF
      取真实IP(请求) ?? '',
      动作,
      JSON.stringify({ 目标用户ID: 目标用户, 操作管理员: 操作者?.yongHuId ?? null }),
      'guan_li',
    ]);
  };
  if (池.用事务) {
    await 池.用事务(async (事务查) => {
      await 落库(事务查);
    });
  } else {
    await 落库(查);
  }
}

const 列表列 =
  'u."ID", u."手机号", u."用户名", u."昵称", u."性别", u."管理员", u."人设标签", u."签名", u."创建时间", f."级别" AS "封禁级别", f."违规次数" AS "违规次数", f."申诉状态" AS "申诉状态", f."解封时间" AS "账号解封时间"';
const 列表来源 = 'FROM "用户" u LEFT JOIN "账号封禁" f ON f."用户ID" = u."ID"';

export function 创建账号路由(): Router {
  const 路由 = Router();

  路由.get('/zhang-hao-lie-biao', async (请求: Request, 响应: Response): Promise<void> => {
    const 池 = 取池(请求);
    if (!池) {
      失败响应(响应, 500, 取文案('通用', '服务器内部错误'), 'NEI_BU_CUO_WU');
      return;
    }
    const 查询 = 请求.query as Record<string, unknown>;
    const { 页码, 每页条数, 偏移量 } = 解析分页(查询);
    const 条件: string[] = [];
    const 参数: unknown[] = [];
    const 关键词 = 取可选字符串(查询['guan_jian_ci']);
    if (关键词 !== undefined) {
      // YH-028 LIKE通配符转义：禁%_枚举注入，参数化+ESCAPE纵深
      const 转义 = 关键词.slice(0, 50).replace(/[\\%_]/g, (字符) => `\\${字符}`);
      参数.push(`%${转义}%`);
      条件.push(`(u."昵称" LIKE $${参数.length} ESCAPE '\\' OR u."用户名" LIKE $${参数.length} ESCAPE '\\' OR u."手机号" LIKE $${参数.length} ESCAPE '\\')`);
    }
    const 手机号 = 取可选字符串(查询['shou_ji_hao']);
    if (手机号 !== undefined) {
      校验手机号('手机号', 手机号);
      参数.push(手机号);
      条件.push(`u."手机号" = $${参数.length}`);
    }
    const 条件子句 = 条件.length > 0 ? `WHERE ${条件.join(' AND ')}` : '';
    const 总数结果 = await 池.query(`SELECT COUNT(*) AS "总数" ${列表来源} ${条件子句}`, [...参数]);
    const 总数 = Number(总数结果.rows[0]?.['总数'] ?? 0);
    参数.push(每页条数);
    const 条数占位 = `$${参数.length}`;
    参数.push(偏移量);
    const 偏移占位 = `$${参数.length}`;
    const 列表结果 = await 池.query(
      `SELECT ${列表列} ${列表来源} ${条件子句} ORDER BY u."创建时间" DESC LIMIT ${条数占位} OFFSET ${偏移占位}`,
      参数,
    );
    成功响应(响应, 列表结果.rows.map(脱敏列表行), { ye_ma: 页码, mei_ye_tiao_shu: 每页条数, zong_shu: 总数 });
  });

  路由.get('/zhang-hao-xiang-qing/:yongHuId', async (请求: Request, 响应: Response): Promise<void> => {
    const 池 = 取池(请求);
    if (!池) {
      失败响应(响应, 500, 取文案('通用', '服务器内部错误'), 'NEI_BU_CUO_WU');
      return;
    }
    const 用户编号 = 校验UUID('用户ID', 请求.params.yongHuId);
    const 结果 = await 池.query(
      `SELECT ${列表列} ${列表来源} WHERE u."ID" = $1 LIMIT 1`,
      [用户编号],
    );
    if (结果.rows.length === 0) {
      throw new 记录缺失(取文案('账号', '账号不存在'));
    }
    await 记敏感读审计(池, 请求, 用户编号, 'guan_li_cha_kan_zhang_hao_xiang_qing');
    成功响应(响应, 脱敏列表行(结果.rows[0]));
  });

  路由.get('/zhang-hao-jie-mi/:yongHuId', async (请求: Request, 响应: Response): Promise<void> => {
    const 池 = 取池(请求);
    if (!池) {
      失败响应(响应, 500, 取文案('通用', '服务器内部错误'), 'NEI_BU_CUO_WU');
      return;
    }
    const 用户编号 = 校验UUID('用户ID', 请求.params.yongHuId);
    const 结果 = await 池.query(
      `SELECT ${列表列} ${列表来源} WHERE u."ID" = $1 LIMIT 1`,
      [用户编号],
    );
    if (结果.rows.length === 0) {
      throw new 记录缺失(取文案('账号', '账号不存在'));
    }
    await 记敏感读审计(池, 请求, 用户编号, 'guan_li_jie_mi_shou_ji_hao');
    成功响应(响应, 结果.rows[0]);
  });

  return 路由;
}
