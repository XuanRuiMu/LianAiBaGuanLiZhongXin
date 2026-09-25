import { Router, type Request, type Response, type RequestHandler } from 'express';
import { 取文案 } from '../文案';
import { 成功响应, 失败响应 } from '../响应';
import { 错误码 } from '../错误码';
import { 按用户吊销前缀 } from '../会话';
import { 日志 } from '../日志';
import {
  校验UUID,
  校验白名单,
  取可选字符串,
  校验失败,
} from '../校验';
import type { 查询池 } from '../数据库';
import type { 认证请求 } from '../中间件/认证';
import type { 缓存客户端 } from '../缓存';
import {
  广播管理员失效,
  管理角色清单,
  type GuanLiJiaoSe,
} from '../中间件/管理员';
import { 取真实IP } from '../真实IP';
import { 响应依赖缺失 } from '../错误归一化';

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

// YH-108 三角色授予/回收：列标识只出自本表常量，入参先过角色白名单，禁任意标识进SQL
const 角色授予语句: Record<GuanLiJiaoSe, string> = {
  chao_guan: 'UPDATE "用户" SET "管理员" = TRUE, "更新时间" = NOW() WHERE "ID" = $1',
  yun_ying: 'UPDATE "用户" SET "运营" = TRUE, "更新时间" = NOW() WHERE "ID" = $1',
  shen_he_yuan: 'UPDATE "用户" SET "审核员" = TRUE, "更新时间" = NOW() WHERE "ID" = $1',
};

const 角色回收语句: Record<GuanLiJiaoSe, string> = {
  chao_guan: 'UPDATE "用户" SET "管理员" = FALSE, "更新时间" = NOW() WHERE "ID" = $1',
  yun_ying: 'UPDATE "用户" SET "运营" = FALSE, "更新时间" = NOW() WHERE "ID" = $1',
  shen_he_yuan: 'UPDATE "用户" SET "审核员" = FALSE, "更新时间" = NOW() WHERE "ID" = $1',
};

/** YH-108 缺省角色保持旧契约口径：不带 jiao_se 的调用等同授予/回收超管 */
function 取申报角色(正文: Record<string, unknown>): GuanLiJiaoSe {
  const 文本 = 取可选字符串(正文['jiao_se']) ?? 'chao_guan';
  return 校验白名单('jiao_se', 文本, 管理角色清单) as GuanLiJiaoSe;
}

export function 创建管理写路由(写限流: RequestHandler): Router {
  const 路由 = Router();
  // YH-108 高危写入口无旁路开关：授回收/夺舍/归还仅超管可执行，门禁缺失即静默提权
  const 高危门禁: RequestHandler = (请求, 响应, 下一步) => {
    void import('../中间件/管理员.js').then(({ 高危操作门禁 }) => 高危操作门禁(请求, 响应, 下一步));
  };

  路由.post('/shou-quan', 写限流, 高危门禁, async (请求: Request, 响应: Response): Promise<void> => {
    const 池 = 取池(请求);
    if (!池) {
      响应依赖缺失(响应, '管理写操作', '数据库', 请求);
      return;
    }
    const 正文 = (请求.body ?? {}) as Record<string, unknown>;
    const 用户编号 = 校验UUID('yong_hu_id', 取可选字符串(正文['yong_hu_id']));
    const 操作者 = (请求 as 认证请求).登录用户;
    if (操作者?.yongHuId === 用户编号) {
      throw new 校验失败(取文案('管理写', '不能变更自己'));
    }
    const 查 = await 池.query('SELECT "管理员", "运营", "审核员" FROM "用户" WHERE "ID" = $1 LIMIT 1', [用户编号]);
    if (查.rows.length === 0) {
      失败响应(响应, 404, 取文案('账号', '账号不存在'), 错误码.记录未找到);
      return;
    }
    const 二次确认 = (正文['que_ren'] ?? 正文['queRen']) === true;
    if (二次确认 !== true) {
      失败响应(响应, 400, 取文案('管理写', '需再次确认'), 错误码.需再次确认);
      return;
    }
    const 角色 = 取申报角色(正文);
    const 授予 = 角色授予语句[角色];
    const 审计详情 = JSON.stringify({
      目标用户ID: 用户编号,
      角色,
      操作管理员: 操作者?.yongHuId ?? null,
    });
    if (池.用事务) {
      const 结果 = await 池.用事务(async (事务查) => {
        const 更新 = await 事务查(授予, [用户编号]);
        await 事务查('INSERT INTO "审计日志" ("用户ID", "IP", "事件类型", "详情", "类型") VALUES ($1, $2, $3, $4::jsonb, $5)', [
          操作者?.yongHuId ?? null,
          取真实IP(请求) ?? '',
          'guan_li_shou_quan',
          审计详情,
          'guan_li',
        ]);
        return { hang: 更新.rowCount ?? 0 };
      });
      if (结果.hang === 0) {
        失败响应(响应, 404, 取文案('账号', '账号不存在'), 错误码.记录未找到);
        return;
      }
    } else {
      const 更新 = await 池.query(授予, [用户编号]);
      if ((更新.rowCount ?? 0) === 0) {
        失败响应(响应, 404, 取文案('账号', '账号不存在'), 错误码.记录未找到);
        return;
      }
      await 写审计(池, 请求, 'guan_li_shou_quan', 审计详情);
    }
    await 广播管理员失效(取缓存(请求), 用户编号);
    日志.信息('管理写操作', '授予管理角色', { 目标用户: 用户编号, 角色 });
    成功响应(响应, { yi_chu_li: true });
  });

  路由.post('/hui-shou', 写限流, 高危门禁, async (请求: Request, 响应: Response): Promise<void> => {
    const 池 = 取池(请求);
    if (!池) {
      响应依赖缺失(响应, '管理写操作', '数据库', 请求);
      return;
    }
    const 正文 = (请求.body ?? {}) as Record<string, unknown>;
    const 用户编号 = 校验UUID('yong_hu_id', 取可选字符串(正文['yong_hu_id']));
    const 操作者 = (请求 as 认证请求).登录用户;
    if (操作者?.yongHuId === 用户编号) {
      throw new 校验失败(取文案('管理写', '不能变更自己'));
    }
    const 查 = await 池.query('SELECT "管理员", "运营", "审核员" FROM "用户" WHERE "ID" = $1 LIMIT 1', [用户编号]);
    if (查.rows.length === 0) {
      失败响应(响应, 404, 取文案('账号', '账号不存在'), 错误码.记录未找到);
      return;
    }
    const 二次确认 = (正文['que_ren'] ?? 正文['queRen']) === true;
    if (二次确认 !== true) {
      失败响应(响应, 400, 取文案('管理写', '需再次确认'), 错误码.需再次确认);
      return;
    }
    const 角色 = 取申报角色(正文);
    const 回收 = 角色回收语句[角色];
    const 审计详情 = JSON.stringify({
      目标用户ID: 用户编号,
      角色,
      操作管理员: 操作者?.yongHuId ?? null,
    });
    if (池.用事务) {
      const 结果 = await 池.用事务(async (事务查) => {
        const 更新 = await 事务查(回收, [用户编号]);
        await 事务查('INSERT INTO "审计日志" ("用户ID", "IP", "事件类型", "详情", "类型") VALUES ($1, $2, $3, $4::jsonb, $5)', [
          操作者?.yongHuId ?? null,
          取真实IP(请求) ?? '',
          'guan_li_hui_shou',
          审计详情,
          'guan_li',
        ]);
        return { hang: 更新.rowCount ?? 0 };
      });
      if (结果.hang === 0) {
        失败响应(响应, 404, 取文案('账号', '账号不存在'), 错误码.记录未找到);
        return;
      }
    } else {
      const 更新 = await 池.query(回收, [用户编号]);
      if ((更新.rowCount ?? 0) === 0) {
        失败响应(响应, 404, 取文案('账号', '账号不存在'), 错误码.记录未找到);
        return;
      }
      await 写审计(池, 请求, 'guan_li_hui_shou', 审计详情);
    }
    await 广播管理员失效(取缓存(请求), 用户编号);
    const 缓存 = 取缓存(请求);
    if (缓存) {
      // YH-108 任一角色回收即吊销既有会话：改完权限不等令牌自然过期
      await 缓存.set(`${按用户吊销前缀}${用户编号}`, String(Date.now()), 7 * 24 * 60 * 60);
    }
    日志.信息('管理写操作', '回收管理角色', { 目标用户: 用户编号, 角色 });
    成功响应(响应, { yi_chu_li: true });
  });

  路由.post('/duo-she', 写限流, 高危门禁, async (请求: Request, 响应: Response): Promise<void> => {
    const 池 = 取池(请求);
    if (!池) {
      响应依赖缺失(响应, '管理写操作', '数据库', 请求);
      return;
    }
    const 正文 = (请求.body ?? {}) as Record<string, unknown>;
    const 角色编号 = 校验UUID('jiao_se_id', 取可选字符串(正文['jiao_se_id']));
    const 操作者 = (请求 as 认证请求).登录用户;
    const 角色 = await 池.query('SELECT "ID" FROM "角色" WHERE "ID" = $1 LIMIT 1', [角色编号]);
    if (角色.rows.length === 0) {
      失败响应(响应, 404, 取文案('账号', '角色不存在'), 错误码.记录未找到);
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

  // YH-108 归还与夺舍写同一张 夺舍日志，门禁必须同级，否则非超管可留下/改写夺舍结束时间
  路由.post('/gui-huan', 写限流, 高危门禁, async (请求: Request, 响应: Response): Promise<void> => {
    const 池 = 取池(请求);
    if (!池) {
      响应依赖缺失(响应, '管理写操作', '数据库', 请求);
      return;
    }
    const 正文 = (请求.body ?? {}) as Record<string, unknown>;
    const 角色编号 = 校验UUID('jiao_se_id', 取可选字符串(正文['jiao_se_id']));
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
