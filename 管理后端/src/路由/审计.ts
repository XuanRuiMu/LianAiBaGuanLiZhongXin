import { Router, type Request, type Response } from 'express';
import { 取文案 } from '../文案';
import { 成功响应, 失败响应 } from '../响应';
import { 解析分页, 取可选字符串, 校验失败, 校验可选UUID, 解析时间范围, 审计事件白名单 } from '../校验';
import type { 查询池 } from '../数据库';
import type { 认证请求 } from '../中间件/认证';
import { 取真实IP } from '../真实IP';

function 取池(请求: Request): 查询池 | undefined {
  return (请求.app.locals as { 池?: 查询池 }).池;
}

async function 记敏感读审计(池: 查询池, 请求: Request, 动作明细: string): Promise<void> {
  const 操作者 = (请求 as 认证请求).登录用户;
  const 查 = async (文本: string, 参数?: unknown[]) => 池.query(文本, 参数);
  const 落库 = async (查函数: (文本: string, 参数?: unknown[]) => Promise<unknown>): Promise<void> => {
    await 查函数('INSERT INTO "审计日志" ("用户ID", "IP", "事件类型", "详情", "类型") VALUES ($1, $2, $3, $4::jsonb, $5)', [
      操作者?.yongHuId ?? null,
      取真实IP(请求) ?? '',
      'guan_li_cha_kan_shen_ji',
      JSON.stringify({ 操作管理员: 操作者?.yongHuId ?? null, 动作明细, 路径: 请求.path }),
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

export function 创建审计路由(): Router {
  const 路由 = Router();

  路由.get('/shen-ji-ri-zhi', async (请求: Request, 响应: Response): Promise<void> => {
    const 池 = 取池(请求);
    if (!池) {
      失败响应(响应, 500, 取文案('通用', '服务器内部错误'), 'NEI_BU_CUO_WU');
      return;
    }
    const 查询 = 请求.query as Record<string, unknown>;
    const { 页码, 每页条数, 偏移量 } = 解析分页(查询);
    const 条件: string[] = [];
    const 参数: unknown[] = [];
    const 事件类型 = 取可选字符串(查询['shi_jian_lei_xing']);
    if (事件类型 !== undefined) {
      const 白名单事件 = 审计事件白名单 as readonly string[];
      if (!白名单事件.includes(事件类型)) {
        参数.push(`%${事件类型.slice(0, 50).replace(/[\\%_]/g, (字符) => `\\${字符}`)}%`);
        条件.push(`"事件类型" LIKE $${参数.length} ESCAPE '\\'`);
      } else {
        参数.push(事件类型);
        条件.push(`"事件类型" = $${参数.length}`);
      }
    }
    const 用户编号 = 校验可选UUID('用户ID', 查询['yong_hu_id']);
    if (用户编号 !== undefined) {
      参数.push(用户编号);
      条件.push(`"用户ID" = $${参数.length}`);
    }
    const 类型名 = 取可选字符串(查询['lei_xing']);
    if (类型名 !== undefined) {
      参数.push(类型名);
      条件.push(`"类型" = $${参数.length}`);
    }
    const { 开始, 结束 } = 解析时间范围(查询);
    if (开始 !== undefined) {
      参数.push(开始);
      条件.push(`"创建时间" >= $${参数.length}`);
    }
    if (结束 !== undefined) {
      参数.push(结束);
      条件.push(`"创建时间" <= $${参数.length}`);
    }
    const 条件子句 = 条件.length > 0 ? `WHERE ${条件.join(' AND ')}` : '';
    const 总数结果 = await 池.query(`SELECT COUNT(*) AS "总数" FROM "审计日志" ${条件子句}`, [...参数]);
    const 总数 = Number(总数结果.rows[0]?.['总数'] ?? 0);
    参数.push(每页条数);
    const 条数占位 = `$${参数.length}`;
    参数.push(偏移量);
    const 偏移占位 = `$${参数.length}`;
    const 列表结果 = await 池.query(
      `SELECT "ID", "用户ID", "IP", "事件类型", "详情", "类型", "创建时间" FROM "审计日志" ${条件子句} ORDER BY "创建时间" DESC LIMIT ${条数占位} OFFSET ${偏移占位}`,
      参数,
    );
    await 记敏感读审计(池, 请求, 'lie_biao_cha_xun');
    成功响应(响应, 列表结果.rows, { ye_ma: 页码, mei_ye_tiao_shu: 每页条数, zong_shu: 总数 });
  });

  路由.get('/shen-ji-bao-liu', async (请求: Request, 响应: Response): Promise<void> => {
    const 池 = 取池(请求);
    if (!池) {
      失败响应(响应, 500, 取文案('通用', '服务器内部错误'), 'NEI_BU_CUO_WU');
      return;
    }
    try {
      const 保留结果 = await 池.query(
        'SELECT COUNT(*) AS "总数", MIN("创建时间") AS "最早", MAX("创建时间") AS "最晚" FROM "审计日志"',
        [],
      );
      const 按类型 = await 池.query('SELECT "事件类型" AS "事件类型", COUNT(*) AS "数量" FROM "审计日志" GROUP BY "事件类型" ORDER BY COUNT(*) DESC LIMIT 50', []);
      成功响应(响应, {
        zong_shu: Number(保留结果.rows[0]?.['总数'] ?? 0),
        zui_zao: 保留结果.rows[0]?.['最早'] ?? null,
        zui_wan: 保留结果.rows[0]?.['最晚'] ?? null,
        an_lei_xing: 按类型.rows,
        bao_liu_ce_lue: 取文案('审计', '保留策略'),
      });
    } catch {
      失败响应(响应, 200, 取文案('审计', '表缺失降级'), 'BIAO_QUE_SHI_JIANG_JI');
    }
  });

  路由.get('/shen-ji-dao-chu', async (请求: Request, 响应: Response): Promise<void> => {
    const 池 = 取池(请求);
    if (!池) {
      失败响应(响应, 500, 取文案('通用', '服务器内部错误'), 'NEI_BU_CUO_WU');
      return;
    }
    const 查询 = 请求.query as Record<string, unknown>;
    const 审批单 = 取可选字符串(查询['shen_pi_dan']);
    if (审批单 === undefined || 审批单.trim().length === 0) {
      失败响应(响应, 400, `${取文案('通用', '参数错误')}：导出需审批单`, 'XU_SHEN_PI_DAN');
      return;
    }
    if (!/^[A-Za-z0-9][A-Za-z0-9\-_]{0,63}$/.test(审批单.trim())) {
      throw new 校验失败(`${取文案('通用', '参数错误')}：审批单`);
    }
    const { 页码, 每页条数, 偏移量 } = 解析分页(查询);
    const 条件: string[] = [];
    const 参数: unknown[] = [];
    const 事件类型 = 取可选字符串(查询['shi_jian_lei_xing']);
    if (事件类型 !== undefined) {
      const 白名单事件 = 审计事件白名单 as readonly string[];
      if (!白名单事件.includes(事件类型)) {
        参数.push(`%${事件类型.slice(0, 50).replace(/[\\%_]/g, (字符) => `\\${字符}`)}%`);
        条件.push(`"事件类型" LIKE $${参数.length} ESCAPE '\\'`);
      } else {
        参数.push(事件类型);
        条件.push(`"事件类型" = $${参数.length}`);
      }
    }
    const 条件子句 = 条件.length > 0 ? `WHERE ${条件.join(' AND ')}` : '';
    参数.push(Math.min(每页条数, 200));
    const 条数占位 = `$${参数.length}`;
    参数.push(偏移量);
    const 偏移占位 = `$${参数.length}`;
    const 列表结果 = await 池.query(
      `SELECT "ID", "用户ID", "IP", "事件类型", "详情", "类型", "创建时间" FROM "审计日志" ${条件子句} ORDER BY "创建时间" DESC LIMIT ${条数占位} OFFSET ${偏移占位}`,
      参数,
    );
    const 水印 = `dao_chu_shui_yin:${(请求 as 认证请求).登录用户?.yongHuId ?? 'wei_zhi'}:${new Date().toISOString()}:${审批单.trim()}`;
    await 记敏感读审计(池, 请求, 'dao_chu');
    成功响应(响应, { shui_yin: 水印, shen_pi_dan: 审批单.trim(), lie_biao: 列表结果.rows }, { ye_ma: 页码, mei_ye_tiao_shu: 每页条数, zong_shu: 列表结果.rows.length });
  });

  return 路由;
}
