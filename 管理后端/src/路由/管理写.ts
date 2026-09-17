import { Router, type Request, type Response, type RequestHandler } from 'express';
import { 取文案 } from '../文案';
import { 成功响应, 失败响应 } from '../响应';
import { 日志 } from '../日志';
import {
  校验UUID,
  取可选字符串,
  校验失败,
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

async function 写审计(
  池: 查询池,
  请求: Request,
  事件类型: string,
  详情: string,
): Promise<void> {
  const 操作者 = (请求 as 认证请求).登录用户;
  const 查 = async (文本: string, 参数?: unknown[]) => 池.query(文本, 参数);
  const 落库 = async (查函数: (文本: string, 参数?: unknown[]) => Promise<unknown>): Promise<void> => {
    await 查函数('INSERT INTO "审计日志" ("用户ID", "IP", "事件类型", "详情", "类型") VALUES ($1, $2, $3, $4::jsonb, $5)', [
      操作者?.yongHuId ?? null,
      取真实IP(请求) ?? '',
      事件类型,
      详情,
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

export function 创建管理写路由(写限流: RequestHandler, 高危复核 = false): Router {
  const 路由 = Router();
  // YH-108 高危双人复核：授回收/夺舍写入仅超管可执行
  const 高危门禁: RequestHandler = (请求, 响应, 下一步) => {
    if (!高危复核) {
      下一步();
      return;
    }
    void import('../中间件/管理员').then(({ 高危操作门禁 }) => 高危操作门禁(请求, 响应, 下一步));
  };

  路由.post('/shou-quan', 写限流, 高危门禁, async (请求: Request, 响应: Response): Promise<void> => {
    const 池 = 取池(请求);
    if (!池) {
      失败响应(响应, 500, 取文案('通用', '服务器内部错误'), 'NEI_BU_CUO_WU');
      return;
    }
    const 正文 = (请求.body ?? {}) as Record<string, unknown>;
    const 用户编号 = 校验UUID('用户ID', 取可选字符串(正文['yong_hu_id']));
    const 操作者 = (请求 as 认证请求).登录用户;
    if (操作者?.yongHuId === 用户编号) {
      throw new 校验失败(`${取文案('通用', '参数错误')}：不能变更自身`);
    }
    const 查 = await 池.query('SELECT "管理员" FROM "用户" WHERE "ID" = $1 LIMIT 1', [用户编号]);
    if (查.rows.length === 0) {
      失败响应(响应, 404, 取文案('账号', '账号不存在'), 'WEI_ZHAO_DAO');
      return;
    }
    const 二次确认 = (正文['que_ren'] ?? 正文['queRen']) === true;
    if (二次确认 !== true) {
      失败响应(响应, 400, `${取文案('通用', '参数错误')}：高危操作需二次确认`, 'XU_YAO_QUE_REN');
      return;
    }
    if (池.用事务) {
      const 结果 = await 池.用事务(async (事务查) => {
        const 更新 = await 事务查('UPDATE "用户" SET "管理员" = TRUE, "更新时间" = NOW() WHERE "ID" = $1', [用户编号]);
        await 事务查('INSERT INTO "审计日志" ("用户ID", "IP", "事件类型", "详情", "类型") VALUES ($1, $2, $3, $4::jsonb, $5)', [
          操作者?.yongHuId ?? null,
          取真实IP(请求) ?? '',
          'guan_li_shou_quan',
          JSON.stringify({ 目标用户ID: 用户编号, 操作管理员: 操作者?.yongHuId ?? null }),
          'guan_li',
        ]);
        return { hang: 更新.rowCount ?? 0 };
      });
      if (结果.hang === 0) {
        失败响应(响应, 404, 取文案('账号', '账号不存在'), 'WEI_ZHAO_DAO');
        return;
      }
    } else {
      const 更新 = await 池.query('UPDATE "用户" SET "管理员" = TRUE, "更新时间" = NOW() WHERE "ID" = $1', [用户编号]);
      if ((更新.rowCount ?? 0) === 0) {
        失败响应(响应, 404, 取文案('账号', '账号不存在'), 'WEI_ZHAO_DAO');
        return;
      }
      await 写审计(池, 请求, 'guan_li_shou_quan', JSON.stringify({ 目标用户ID: 用户编号, 操作管理员: 操作者?.yongHuId ?? null }));
    }
    await 广播管理员失效(取缓存(请求), 用户编号);
    日志.信息('管理写操作', '授予管理员', { 目标用户: 用户编号 });
    成功响应(响应, { yi_chu_li: true });
  });

  路由.post('/hui-shou', 写限流, 高危门禁, async (请求: Request, 响应: Response): Promise<void> => {
    const 池 = 取池(请求);
    if (!池) {
      失败响应(响应, 500, 取文案('通用', '服务器内部错误'), 'NEI_BU_CUO_WU');
      return;
    }
    const 正文 = (请求.body ?? {}) as Record<string, unknown>;
    const 用户编号 = 校验UUID('用户ID', 取可选字符串(正文['yong_hu_id']));
    const 操作者 = (请求 as 认证请求).登录用户;
    if (操作者?.yongHuId === 用户编号) {
      throw new 校验失败(`${取文案('通用', '参数错误')}：不能变更自身`);
    }
    const 查 = await 池.query('SELECT "管理员" FROM "用户" WHERE "ID" = $1 LIMIT 1', [用户编号]);
    if (查.rows.length === 0) {
      失败响应(响应, 404, 取文案('账号', '账号不存在'), 'WEI_ZHAO_DAO');
      return;
    }
    const 二次确认 = (正文['que_ren'] ?? 正文['queRen']) === true;
    if (二次确认 !== true) {
      失败响应(响应, 400, `${取文案('通用', '参数错误')}：高危操作需二次确认`, 'XU_YAO_QUE_REN');
      return;
    }
    if (池.用事务) {
      const 结果 = await 池.用事务(async (事务查) => {
        const 更新 = await 事务查('UPDATE "用户" SET "管理员" = FALSE, "更新时间" = NOW() WHERE "ID" = $1', [用户编号]);
        await 事务查('INSERT INTO "审计日志" ("用户ID", "IP", "事件类型", "详情", "类型") VALUES ($1, $2, $3, $4::jsonb, $5)', [
          操作者?.yongHuId ?? null,
          取真实IP(请求) ?? '',
          'guan_li_hui_shou',
          JSON.stringify({ 目标用户ID: 用户编号, 操作管理员: 操作者?.yongHuId ?? null }),
          'guan_li',
        ]);
        return { hang: 更新.rowCount ?? 0 };
      });
      if (结果.hang === 0) {
        失败响应(响应, 404, 取文案('账号', '账号不存在'), 'WEI_ZHAO_DAO');
        return;
      }
    } else {
      const 更新 = await 池.query('UPDATE "用户" SET "管理员" = FALSE, "更新时间" = NOW() WHERE "ID" = $1', [用户编号]);
      if ((更新.rowCount ?? 0) === 0) {
        失败响应(响应, 404, 取文案('账号', '账号不存在'), 'WEI_ZHAO_DAO');
        return;
      }
      await 写审计(池, 请求, 'guan_li_hui_shou', JSON.stringify({ 目标用户ID: 用户编号, 操作管理员: 操作者?.yongHuId ?? null }));
    }
    await 广播管理员失效(取缓存(请求), 用户编号);
    const 缓存 = 取缓存(请求);
    if (缓存) {
      await 缓存.set(`jwt_yong_hu_cheXiao:${用户编号}`, String(Date.now()), 7 * 24 * 60 * 60);
    }
    日志.信息('管理写操作', '回收管理员', { 目标用户: 用户编号 });
    成功响应(响应, { yi_chu_li: true });
  });

  路由.post('/duo-she', 写限流, 高危门禁, async (请求: Request, 响应: Response): Promise<void> => {
    const 池 = 取池(请求);
    if (!池) {
      失败响应(响应, 500, 取文案('通用', '服务器内部错误'), 'NEI_BU_CUO_WU');
      return;
    }
    const 正文 = (请求.body ?? {}) as Record<string, unknown>;
    const 角色编号 = 校验UUID('角色ID', 取可选字符串(正文['jiao_se_id']));
    const 操作者 = (请求 as 认证请求).登录用户;
    const 角色 = await 池.query('SELECT "ID" FROM "角色" WHERE "ID" = $1 LIMIT 1', [角色编号]);
    if (角色.rows.length === 0) {
      失败响应(响应, 404, 取文案('通用', '未找到'), 'WEI_ZHAO_DAO');
      return;
    }
    const 落库 = async (查函数: (文本: string, 参数?: unknown[]) => Promise<unknown>): Promise<void> => {
      await 查函数('INSERT INTO "夺舍日志" ("管理员ID", "角色ID") VALUES ($1, $2)', [操作者?.yongHuId ?? null, 角色编号]);
      await 查函数('INSERT INTO "审计日志" ("用户ID", "IP", "事件类型", "详情", "类型") VALUES ($1, $2, $3, $4::jsonb, $5)', [
        操作者?.yongHuId ?? null,
        取真实IP(请求) ?? '',
        'guan_li_duo_she',
        JSON.stringify({ 角色ID: 角色编号, 操作管理员: 操作者?.yongHuId ?? null }),
        'guan_li',
      ]);
    };
    if (池.用事务) {
      await 池.用事务(async (事务查) => {
        await 落库(事务查);
      });
    } else {
      await 落库((文本, 参数) => 池.query(文本, 参数));
    }
    日志.信息('管理写操作', '夺舍角色', { 角色ID: 角色编号 });
    成功响应(响应, { yi_chu_li: true });
  });

  路由.post('/gui-huan', 写限流, async (请求: Request, 响应: Response): Promise<void> => {
    const 池 = 取池(请求);
    if (!池) {
      失败响应(响应, 500, 取文案('通用', '服务器内部错误'), 'NEI_BU_CUO_WU');
      return;
    }
    const 正文 = (请求.body ?? {}) as Record<string, unknown>;
    const 角色编号 = 校验UUID('角色ID', 取可选字符串(正文['jiao_se_id']));
    const 操作者 = (请求 as 认证请求).登录用户;
    const 落库 = async (查函数: (文本: string, 参数?: unknown[]) => Promise<unknown>): Promise<void> => {
      await 查函数(
        'UPDATE "夺舍日志" SET "结束时间" = NOW() WHERE "管理员ID" = $1 AND "角色ID" = $2 AND "结束时间" IS NULL',
        [操作者?.yongHuId ?? null, 角色编号],
      );
      await 查函数('INSERT INTO "审计日志" ("用户ID", "IP", "事件类型", "详情", "类型") VALUES ($1, $2, $3, $4::jsonb, $5)', [
        操作者?.yongHuId ?? null,
        取真实IP(请求) ?? '',
        'guan_li_gui_huan',
        JSON.stringify({ 角色ID: 角色编号, 操作管理员: 操作者?.yongHuId ?? null }),
        'guan_li',
      ]);
    };
    if (池.用事务) {
      await 池.用事务(async (事务查) => {
        await 落库(事务查);
      });
    } else {
      await 落库((文本, 参数) => 池.query(文本, 参数));
    }
    日志.信息('管理写操作', '归还角色', { 角色ID: 角色编号 });
    成功响应(响应, { yi_chu_li: true });
  });

  return 路由;
}
