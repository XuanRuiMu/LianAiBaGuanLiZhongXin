import { Router, type Request, type Response } from 'express';
import { 取文案 } from '../文案';
import { 成功响应, 失败响应 } from '../响应';
import { 校验天数 } from '../校验';
import { 埋点事件字典 } from '../埋点';
import type { 查询池 } from '../数据库';
import type { 认证请求 } from '../中间件/认证';
import { 取真实IP } from '../真实IP';

function 取池(请求: Request): 查询池 | undefined {
  return (请求.app.locals as { 池?: 查询池 }).池;
}

async function 记统计读审计(池: 查询池, 请求: Request): Promise<void> {
  const 操作者 = (请求 as 认证请求).登录用户;
  const 落库 = async (查函数: (文本: string, 参数?: unknown[]) => Promise<unknown>): Promise<void> => {
    await 查函数('INSERT INTO "审计日志" ("用户ID", "IP", "事件类型", "详情", "类型") VALUES ($1, $2, $3, $4::jsonb, $5)', [
      操作者?.yongHuId ?? null,
      取真实IP(请求) ?? '',
      'guan_li_cha_kan_tong_ji',
      JSON.stringify({ 操作管理员: 操作者?.yongHuId ?? null, 路径: 请求.path }),
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
}

const 注册聚合 =
  'SELECT DATE("创建时间") AS "日期", COUNT(*) AS "数量" FROM "用户" ' +
  'WHERE "创建时间" >= NOW() - make_interval(days => $1) ' +
  'GROUP BY DATE("创建时间") ORDER BY DATE("创建时间") ASC';

const 消息聚合 =
  'SELECT DATE("创建时间") AS "日期", "发送者" AS "发送方", COUNT(*) AS "数量" FROM "消息" ' +
  'WHERE "创建时间" >= NOW() - make_interval(days => $1) ' +
  'GROUP BY DATE("创建时间"), "发送者" ORDER BY DATE("创建时间") ASC';

const 好感总览 = 'SELECT COUNT(*) AS "总数", AVG("总分") AS "平均分", MAX("总分") AS "最高分", MIN("总分") AS "最低分" FROM "好感度"';

const 好感按阶段 =
  'SELECT "关系阶段" AS "阶段", COUNT(*) AS "数量", AVG("总分") AS "平均分" FROM "好感度" GROUP BY "关系阶段"';

export function 创建统计路由(): Router {
  const 路由 = Router();

  路由.get('/tong-ji/zhu-ce', async (请求: Request, 响应: Response): Promise<void> => {
    const 池 = 取池(请求);
    if (!池) {
      失败响应(响应, 500, 取文案('通用', '服务器内部错误'), 'NEI_BU_CUO_WU');
      return;
    }
    const 天数 = 校验天数((请求.query as Record<string, unknown>)['tian_shu']);
    const 结果 = await 池.query(注册聚合, [天数]);
    const 总数结果 = await 池.query('SELECT COUNT(*) AS "总数" FROM "用户"', []);
    const 总数 = Number(总数结果.rows[0]?.['总数'] ?? 0);
    await 记统计读审计(池, 请求);
    成功响应(响应, { lie_biao: 结果.rows, zong_shu: 总数, tian_shu: 天数 });
  });

  路由.get('/tong-ji/xiao-xi', async (请求: Request, 响应: Response): Promise<void> => {
    const 池 = 取池(请求);
    if (!池) {
      失败响应(响应, 500, 取文案('通用', '服务器内部错误'), 'NEI_BU_CUO_WU');
      return;
    }
    const 天数 = 校验天数((请求.query as Record<string, unknown>)['tian_shu']);
    const 结果 = await 池.query(消息聚合, [天数]);
    await 记统计读审计(池, 请求);
    成功响应(响应, { lie_biao: 结果.rows, tian_shu: 天数 });
  });

  路由.get('/tong-ji/hao-gan-du', async (请求: Request, 响应: Response): Promise<void> => {
    const 池 = 取池(请求);
    if (!池) {
      失败响应(响应, 500, 取文案('通用', '服务器内部错误'), 'NEI_BU_CUO_WU');
      return;
    }
    const 总览 = await 池.query(好感总览, []);
    const 按阶段 = await 池.query(好感按阶段, []);
    await 记统计读审计(池, 请求);
    成功响应(响应, { zong_lan: 总览.rows[0] ?? {}, an_jie_duan: 按阶段.rows });
  });

  路由.get('/tong-ji/liu-cun', async (请求: Request, 响应: Response): Promise<void> => {
    const 池 = 取池(请求);
    if (!池) {
      失败响应(响应, 500, 取文案('通用', '服务器内部错误'), 'NEI_BU_CUO_WU');
      return;
    }
    const 天数 = 校验天数((请求.query as Record<string, unknown>)['tian_shu']);
    try {
      const 留存 = await 池.query(
        'SELECT DATE("创建时间") AS "日期", COUNT(DISTINCT "用户ID") AS "数量" FROM "消息" WHERE "创建时间" >= NOW() - make_interval(days => $1) GROUP BY DATE("创建时间") ORDER BY DATE("创建时间") ASC',
        [天数],
      );
      await 记统计读审计(池, 请求);
      成功响应(响应, { lie_biao: 留存.rows, tian_shu: 天数 });
    } catch {
      失败响应(响应, 200, 取文案('统计', '表缺失降级'), 'BIAO_QUE_SHI_JIANG_JI');
    }
  });

  路由.get('/tong-ji/ai-yong-liang', async (请求: Request, 响应: Response): Promise<void> => {
    const 池 = 取池(请求);
    if (!池) {
      失败响应(响应, 500, 取文案('通用', '服务器内部错误'), 'NEI_BU_CUO_WU');
      return;
    }
    try {
      const 用量 = await 池.query(
        'SELECT "日期" AS "日期", "模型类型" AS "模型类型", "模型" AS "模型", "次数" AS "次数", "输入Token" AS "输入", "输出Token" AS "输出", "总Token" AS "总数" FROM "LLM用量" ORDER BY "日期" DESC LIMIT 90',
        [],
      );
      await 记统计读审计(池, 请求);
      成功响应(响应, { lie_biao: 用量.rows, kou_jing: 取文案('统计', '用量口径') });
    } catch {
      失败响应(响应, 200, 取文案('统计', '表缺失降级'), 'BIAO_QUE_SHI_JIANG_JI');
    }
  });

  路由.get('/tong-ji/mai-dian-zi-dian', async (_请求: Request, 响应: Response): Promise<void> => {
    成功响应(响应, { lie_biao: [...埋点事件字典], zong_shu: 埋点事件字典.length });
  });

  return 路由;
}
