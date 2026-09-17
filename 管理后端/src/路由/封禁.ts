import { Router, type Request, type Response, type RequestHandler } from 'express';
import { 取文案 } from '../文案';
import { 成功响应, 失败响应 } from '../响应';
import { 日志 } from '../日志';
import {
  校验UUID,
  校验IP,
  校验白名单,
  解析分页,
  取可选字符串,
  取必填字符串,
  校验失败,
  账号封禁级别白名单,
  账号封禁写入级别白名单,
  账号申诉状态白名单,
  严重程度白名单,
} from '../校验';
import type { 查询池 } from '../数据库';
import type { 认证请求 } from '../中间件/认证';
import type { 缓存客户端 } from '../缓存';
import { 广播管理员失效 } from '../中间件/管理员';
import { 取真实IP } from '../真实IP';

function 取池(请求: Request): 查询池 | undefined {
  return (请求.app.locals as { 池?: 查询池 }).池;
}

function 取缓存(请求: Request): 缓存客户端 | undefined {
  return (请求.app.locals as { 缓存?: 缓存客户端 }).缓存;
}

export function 创建封禁路由(写限流: RequestHandler): Router {
  const 路由 = Router();
  // YH-108 封禁写入高危双人复核：仅超管可写，审核员/运营越权403
  const 高危门禁: RequestHandler = (请求, 响应, 下一步) => {
    void import('../中间件/管理员').then(({ 高危操作门禁 }) => 高危操作门禁(请求, 响应, 下一步));
  };

  路由.get('/feng-jin-ji-lu', async (请求: Request, 响应: Response): Promise<void> => {
    const 池 = 取池(请求);
    if (!池) {
      失败响应(响应, 500, 取文案('通用', '服务器内部错误'), 'NEI_BU_CUO_WU');
      return;
    }
    const 查询 = 请求.query as Record<string, unknown>;
    const { 页码, 每页条数, 偏移量 } = 解析分页(查询);
    const 条件: string[] = [];
    const 参数: unknown[] = [];
    const 地址 = 取可选字符串(查询['ip']);
    if (地址 !== undefined) {
      校验IP('IP', 地址);
      参数.push(地址);
      条件.push(`"IP" = $${参数.length}`);
    }
    const 条件子句 = 条件.length > 0 ? `WHERE ${条件.join(' AND ')}` : '';
    const 总数结果 = await 池.query(`SELECT COUNT(*) AS "总数" FROM "封禁记录" ${条件子句}`, [...参数]);
    const 总数 = Number(总数结果.rows[0]?.['总数'] ?? 0);
    参数.push(每页条数);
    const 条数占位 = `$${参数.length}`;
    参数.push(偏移量);
    const 偏移占位 = `$${参数.length}`;
    const 列表结果 = await 池.query(
      `SELECT "ID", "IP", "原因", "严重程度", "解封时间", "创建时间" FROM "封禁记录" ${条件子句} ORDER BY "创建时间" DESC LIMIT ${条数占位} OFFSET ${偏移占位}`,
      参数,
    );
    成功响应(响应, 列表结果.rows, { ye_ma: 页码, mei_ye_tiao_shu: 每页条数, zong_shu: 总数 });
  });

  路由.post('/feng-jin', 写限流, 高危门禁, async (请求: Request, 响应: Response): Promise<void> => {
    const 池 = 取池(请求);
    if (!池) {
      失败响应(响应, 500, 取文案('通用', '服务器内部错误'), 'NEI_BU_CUO_WU');
      return;
    }
    const 正文 = (请求.body ?? {}) as Record<string, unknown>;
    const 用户编号文本 = 取可选字符串(正文['yong_hu_id']);
    const 地址文本 = 取可选字符串(正文['ip']);
    if (用户编号文本 === undefined && 地址文本 === undefined) {
      throw new 校验失败(取文案('封禁', '缺少目标'));
    }
    const 用户编号 = 用户编号文本 === undefined ? undefined : 校验UUID('用户ID', 用户编号文本);
    const 地址 = 地址文本 === undefined ? undefined : 校验IP('IP', 地址文本);
    const 原因文本 = 取可选字符串(正文['yuan_yin']);
    if (原因文本 === undefined || 原因文本.trim().length === 0) {
      throw new 校验失败(取文案('封禁', '缺少原因'));
    }
    const 原因 = 取必填字符串(原因文本, '原因');
    // YH-111+YH-118 封禁语义统一：写入禁正常态，未迁移显式400由调用方先迁移015
    const 级别 = 校验白名单('级别', 取可选字符串(正文['ji_bie']) ?? 'feng_jin_1_tian', 账号封禁写入级别白名单);
    const 严重程度 = 校验白名单('严重程度', 取可选字符串(正文['yan_zhong_cheng_du']) ?? '中等', 严重程度白名单);
    const 解封文本 = 取可选字符串(正文['jie_feng_shi_jian']);
    let 解封时间: string | null = null;
    if (解封文本 !== undefined) {
      const 毫秒 = Date.parse(解封文本);
      if (Number.isNaN(毫秒)) {
        throw new 校验失败(`${取文案('通用', '参数错误')}：解封时间`);
      }
      解封时间 = new Date(毫秒).toISOString();
    }
    type 查函数 = (文本: string, 参数?: unknown[]) => Promise<unknown>;
    const 操作者 = (请求 as 认证请求).登录用户;
    const 详情 = JSON.stringify({
      目标用户ID: 用户编号 ?? null,
      目标IP: 地址 ?? null,
      原因,
      级别,
      严重程度,
      执行方式: 地址 === undefined ? '账号封禁并留痕' : 'IP封禁并留痕',
      操作管理员: 操作者?.yongHuId ?? null,
    });
    const 二写合一 = async (查: 查函数): Promise<void> => {
      if (用户编号 !== undefined) {
        await 查(
          'INSERT INTO "账号封禁" ("用户ID", "违规次数", "级别", "解封时间", "最后原因", "申诉状态", "更新时间") VALUES ($1, 1, $2, $3, $4, \'wu\', NOW()) ON CONFLICT ("用户ID") DO UPDATE SET "违规次数" = "账号封禁"."违规次数" + 1, "级别" = $2, "解封时间" = $3, "最后原因" = $4, "申诉状态" = \'wu\', "更新时间" = NOW()',
          [用户编号, 级别, 解封时间, 原因],
        );
      }
      if (地址 !== undefined) {
        await 查('INSERT INTO "封禁记录" ("IP", "原因", "严重程度", "解封时间") VALUES ($1, $2, $3, $4)', [
          地址,
          原因,
          严重程度,
          解封时间,
        ]);
      }
      await 查('INSERT INTO "审计日志" ("用户ID", "IP", "事件类型", "详情", "类型") VALUES ($1, $2, $3, $4::jsonb, $5)', [
        操作者?.yongHuId ?? null,
        取真实IP(请求) ?? '',
        'guan_li_feng_jin',
        详情,
        'guan_li',
      ]);
    };
    if (池.用事务) {
      await 池.用事务(async (查) => {
        await 二写合一(查);
      });
    } else {
      const 直查: 查函数 = (文本, 参数) => 池.query(文本, 参数);
      await 二写合一(直查);
    }
    await 广播管理员失效(取缓存(请求), 用户编号);
    if (用户编号 !== undefined) {
      const 缓存 = 取缓存(请求);
      if (缓存) {
        await 缓存.set(`jwt_yong_hu_cheXiao:${用户编号}`, String(Date.now()), 7 * 24 * 60 * 60);
      }
    }
    日志.信息('封禁操作', '管理员执行封禁', { 目标用户: 用户编号 ?? '', 目标IP: 地址 ?? '' });
    成功响应(响应, { yi_chu_li: true }, undefined, 201);
  });

  路由.get('/zhang-hao-feng-jin', async (请求: Request, 响应: Response): Promise<void> => {
    const 池 = 取池(请求);
    if (!池) {
      失败响应(响应, 500, 取文案('通用', '服务器内部错误'), 'NEI_BU_CUO_WU');
      return;
    }
    try {
      const 查询 = 请求.query as Record<string, unknown>;
      const { 页码, 每页条数, 偏移量 } = 解析分页(查询);
      const 条件: string[] = [];
      const 参数: unknown[] = [];
      const 级别筛选 = 取可选字符串(查询['ji_bie']);
      if (级别筛选 !== undefined) {
        校验白名单('级别', 级别筛选, 账号封禁级别白名单);
        参数.push(级别筛选);
        条件.push(`"级别" = $${参数.length}`);
      }
      const 申诉筛选 = 取可选字符串(查询['shen_su']);
      if (申诉筛选 !== undefined) {
        校验白名单('申诉', 申诉筛选, 账号申诉状态白名单);
        参数.push(申诉筛选);
        条件.push(`"申诉状态" = $${参数.length}`);
      }
      const 条件子句 = 条件.length > 0 ? `WHERE ${条件.join(' AND ')}` : '';
      const 总数结果 = await 池.query(`SELECT COUNT(*) AS "总数" FROM "账号封禁" ${条件子句}`, [...参数]);
      const 总数 = Number(总数结果.rows[0]?.['总数'] ?? 0);
      参数.push(每页条数);
      const 条数占位 = `$${参数.length}`;
      参数.push(偏移量);
      const 偏移占位 = `$${参数.length}`;
      const 列表结果 = await 池.query(
        `SELECT "用户ID" AS "用户ID", "违规次数" AS "违规次数", "级别" AS "级别", "解封时间" AS "解封时间", "申诉状态" AS "申诉状态", "最后原因" AS "最后原因" FROM "账号封禁" ${条件子句} ORDER BY "更新时间" DESC LIMIT ${条数占位} OFFSET ${偏移占位}`,
        参数,
      );
      成功响应(响应, 列表结果.rows, { ye_ma: 页码, mei_ye_tiao_shu: 每页条数, zong_shu: 总数 });
    } catch (错误) {
      if (错误 instanceof 校验失败) {
        throw 错误;
      }
      失败响应(响应, 200, 取文案('封禁', '表缺失降级'), 'BIAO_QUE_SHI_JIANG_JI');
    }
  });

  路由.post('/zhang-hao-feng-jin/jie-feng', 写限流, 高危门禁, async (请求: Request, 响应: Response): Promise<void> => {
    const 池 = 取池(请求);
    if (!池) {
      失败响应(响应, 500, 取文案('通用', '服务器内部错误'), 'NEI_BU_CUO_WU');
      return;
    }
    const 正文 = (请求.body ?? {}) as Record<string, unknown>;
    const 用户编号 = 校验UUID('用户ID', 取可选字符串(正文['yong_hu_id']));
    const 操作者 = (请求 as 认证请求).登录用户;
    const 查 = async (文本: string, 参数?: unknown[]) => 池.query(文本, 参数);
    // YH-118 封禁校验禁写正常态：解封仅命中非正常态行，rowCount幂等断言
    const 执行 = async (): Promise<{ jieFengHang: number }> => {
      const 更新 = await 查(
        'UPDATE "账号封禁" SET "级别" = \'zheng_chang\', "解封时间" = NULL, "申诉状态" = \'yi_jie_chu\', "更新时间" = NOW() WHERE "用户ID" = $1 AND "级别" <> \'zheng_chang\'',
        [用户编号],
      );
      await 查('INSERT INTO "审计日志" ("用户ID", "IP", "事件类型", "详情", "类型") VALUES ($1, $2, $3, $4::jsonb, $5)', [
        操作者?.yongHuId ?? null,
        取真实IP(请求) ?? '',
        'guan_li_jie_chu_feng_jin',
        JSON.stringify({ 目标用户ID: 用户编号, 操作管理员: 操作者?.yongHuId ?? null }),
        'guan_li',
      ]);
      return { jieFengHang: 更新.rowCount ?? 0 };
    };
    if (池.用事务) {
      const 结果 = await 池.用事务(async (事务查) => {
        const 查事务 = async (文本: string, 参数?: unknown[]) => 事务查(文本, 参数);
        const 更新 = await 查事务(
          'UPDATE "账号封禁" SET "级别" = \'zheng_chang\', "解封时间" = NULL, "申诉状态" = \'yi_jie_chu\', "更新时间" = NOW() WHERE "用户ID" = $1 AND "级别" <> \'zheng_chang\'',
          [用户编号],
        );
        await 查事务('INSERT INTO "审计日志" ("用户ID", "IP", "事件类型", "详情", "类型") VALUES ($1, $2, $3, $4::jsonb, $5)', [
          操作者?.yongHuId ?? null,
          取真实IP(请求) ?? '',
          'guan_li_jie_chu_feng_jin',
          JSON.stringify({ 目标用户ID: 用户编号, 操作管理员: 操作者?.yongHuId ?? null }),
          'guan_li',
        ]);
        return { jieFengHang: 更新.rowCount ?? 0 };
      });
      if (结果.jieFengHang === 0) {
        失败响应(响应, 404, 取文案('账号', '账号不存在'), 'WEI_ZHAO_DAO');
        return;
      }
    } else {
      const 结果 = await 执行();
      if (结果.jieFengHang === 0) {
        失败响应(响应, 404, 取文案('账号', '账号不存在'), 'WEI_ZHAO_DAO');
        return;
      }
    }
    成功响应(响应, { yi_chu_li: true });
  });

  路由.post('/shen-su/shen-he', 写限流, 高危门禁, async (请求: Request, 响应: Response): Promise<void> => {
    const 池 = 取池(请求);
    if (!池) {
      失败响应(响应, 500, 取文案('通用', '服务器内部错误'), 'NEI_BU_CUO_WU');
      return;
    }
    const 正文 = (请求.body ?? {}) as Record<string, unknown>;
    const 用户编号 = 校验UUID('用户ID', 取可选字符串(正文['yong_hu_id']));
    const 通过原始 = 正文['tong_guo'];
    if (typeof 通过原始 !== 'boolean') {
      throw new 校验失败(`${取文案('通用', '参数错误')}：是否通过`);
    }
    const 操作者 = (请求 as 认证请求).登录用户;
    const 审计详情 = JSON.stringify({
      目标用户ID: 用户编号,
      是否通过: 通过原始,
      操作管理员: 操作者?.yongHuId ?? null,
    });
    const 写审计 = async (查: (文本: string, 参数?: unknown[]) => Promise<unknown>): Promise<void> => {
      await 查('INSERT INTO "审计日志" ("用户ID", "IP", "事件类型", "详情", "类型") VALUES ($1, $2, $3, $4::jsonb, $5)', [
        操作者?.yongHuId ?? null,
        取真实IP(请求) ?? '',
        'guan_li_shen_he_shen_su',
        审计详情,
        'guan_li',
      ]);
    };
    if (通过原始) {
      // YH-118 rowCount幂等：删除命中0行视为目标不存在，禁报成功
      if (池.用事务) {
        const 结果 = await 池.用事务(async (事务查) => {
          const 删除 = await 事务查('DELETE FROM "账号封禁" WHERE "用户ID" = $1', [用户编号]);
          await 写审计(事务查);
          return { hang: 删除.rowCount ?? 0 };
        });
        if (结果.hang === 0) {
          失败响应(响应, 404, 取文案('账号', '账号不存在'), 'WEI_ZHAO_DAO');
          return;
        }
      } else {
        const 删除 = await 池.query('DELETE FROM "账号封禁" WHERE "用户ID" = $1', [用户编号]);
        if ((删除.rowCount ?? 0) === 0) {
          失败响应(响应, 404, 取文案('账号', '账号不存在'), 'WEI_ZHAO_DAO');
          return;
        }
        await 写审计((文本, 参数) => 池.query(文本, 参数));
      }
    } else {
      // YH-118 驳回仅命中申诉中行，rowCount幂等断言
      if (池.用事务) {
        const 结果 = await 池.用事务(async (事务查) => {
          const 更新 = await 事务查('UPDATE "账号封禁" SET "申诉状态" = \'bo_hui\', "更新时间" = NOW() WHERE "用户ID" = $1 AND "申诉状态" = \'shen_su_zhong\'', [用户编号]);
          await 写审计(事务查);
          return { hang: 更新.rowCount ?? 0 };
        });
        if (结果.hang === 0) {
          失败响应(响应, 404, 取文案('账号', '账号不存在'), 'WEI_ZHAO_DAO');
          return;
        }
      } else {
        const 更新 = await 池.query('UPDATE "账号封禁" SET "申诉状态" = \'bo_hui\', "更新时间" = NOW() WHERE "用户ID" = $1 AND "申诉状态" = \'shen_su_zhong\'', [用户编号]);
        if ((更新.rowCount ?? 0) === 0) {
          失败响应(响应, 404, 取文案('账号', '账号不存在'), 'WEI_ZHAO_DAO');
          return;
        }
        await 写审计((文本, 参数) => 池.query(文本, 参数));
      }
    }
    成功响应(响应, { yi_chu_li: true });
  });

  return 路由;
}
