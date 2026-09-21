import { Router, type Request, type Response } from 'express';
import { 取文案, 取文案列表 } from '../文案';
import { 成功响应 } from '../响应';
import { 校验白名单, 校验可选UUID, 校验UUID, 解析分页, 取可选字符串, 记录缺失 } from '../校验';
import type { 查询池 } from '../数据库';
import { 响应依赖缺失, 响应查询降级 } from '../错误归一化';

function 取池(请求: Request): 查询池 | undefined {
  return (请求.app.locals as { 池?: 查询池 }).池;
}

async function 分页查表(
  池: 查询池,
  表: string,
  列清单: string,
  查询: Record<string, unknown>,
  过滤列: Array<{ 键: string; 列: string }>,
): Promise<{ 行: Record<string, unknown>[]; 页码: number; 每页条数: number; 总数: number }> {
  const { 页码, 每页条数, 偏移量 } = 解析分页(查询);
  const 条件: string[] = [];
  const 参数: unknown[] = [];
  for (const 过滤 of 过滤列) {
    const 编号 = 校验可选UUID(过滤.键, 查询[过滤.键]);
    if (编号 !== undefined) {
      参数.push(编号);
      条件.push(`"${过滤.列}" = $${参数.length}`);
    }
  }
  const 条件子句 = 条件.length > 0 ? `WHERE ${条件.join(' AND ')}` : '';
  const 总数结果 = await 池.query(`SELECT COUNT(*) AS "总数" FROM "${表}" ${条件子句}`, [...参数]);
  const 总数 = Number(总数结果.rows[0]?.['总数'] ?? 0);
  参数.push(每页条数);
  const 条数占位 = `$${参数.length}`;
  参数.push(偏移量);
  const 偏移占位 = `$${参数.length}`;
  const 列表结果 = await 池.query(
    `SELECT ${列清单} FROM "${表}" ${条件子句} ORDER BY "创建时间" DESC LIMIT ${条数占位} OFFSET ${偏移占位}`,
    参数,
  );
  return { 行: 列表结果.rows, 页码, 每页条数, 总数 };
}

async function 思考查询(
  请求: Request,
  响应: Response,
  表: string,
  列清单: string,
  过滤列: Array<{ 键: string; 列: string }>,
): Promise<void> {
  const 池 = 取池(请求);
  if (!池) {
    响应依赖缺失(响应, '思考', '数据库', 请求);
    return;
  }
  const 结果 = await 分页查表(池, 表, 列清单, 请求.query as Record<string, unknown>, 过滤列);
  成功响应(响应, 结果.行, { ye_ma: 结果.页码, mei_ye_tiao_shu: 结果.每页条数, zong_shu: 结果.总数 });
}

const 用户角色过滤 = [
  { 键: 'yong_hu_id', 列: '用户ID' },
  { 键: 'jiao_se_id', 列: '角色ID' },
];

const 思考记录过滤 = [
  { 键: 'yong_hu_id', 列: '用户ID' },
  { 键: 'jiao_se_id', 列: '角色ID' },
];

const 记忆透传列 = '"ID", "用户ID", "角色ID", "内容", "重要度", "创建时间"';

const 对话摘要透传列 =
  '"ID", "用户ID", "角色ID", "摘要", "创建时间", "摘要内容", "概括消息数", "更新时间", "素材锚点时间"';

const 关键事件透传列 = '"ID", "用户ID", "角色ID", "事件类型", "描述", "创建时间"';

const 接管记录透传列 = '"ID", "管理员ID", "角色ID", "结束时间", "创建时间"';

const 评估透传列 =
  '"ID", "用户ID", "角色ID", "话题引导", "情感共鸣", "幽默感", "体贴度", "节奏把控", "总体评价", "改进建议", "创建时间"';

export const 思考事件白名单: readonly string[] = [
  'guan-li-yuan-shen-du-si-kao',
  'guan-li-yuan-gou-jian-guo-cheng',
  'guan-li-yuan-yin-cang-xin-xi',
  'guan-li-yuan-hao-gan-du-bian-hua',
];

export function 创建思考路由(): Router {
  const 路由 = Router();

  路由.get('/si-kao-ji-lu', async (请求: Request, 响应: Response): Promise<void> => {
    const 池 = 取池(请求);
    if (!池) {
      响应依赖缺失(响应, '思考', '数据库', 请求);
      return;
    }
    const 查询 = 请求.query as Record<string, unknown>;
    const { 页码, 每页条数, 偏移量 } = 解析分页(查询);
    const 条件: string[] = [];
    const 参数: unknown[] = [];
    for (const 过滤 of 思考记录过滤) {
      const 编号 = 校验可选UUID(过滤.键, 查询[过滤.键]);
      if (编号 !== undefined) {
        参数.push(编号);
        条件.push(`"${过滤.列}" = $${参数.length}`);
      }
    }
    const 事件名 = 取可选字符串(查询['shi_jian']);
    if (事件名 !== undefined) {
      校验白名单('shi_jian', 事件名, 思考事件白名单);
      参数.push(事件名);
      条件.push(`"事件" = $${参数.length}`);
    }
    const 条件子句 = 条件.length > 0 ? `WHERE ${条件.join(' AND ')}` : '';
    try {
      const 总数结果 = await 池.query(`SELECT COUNT(*) AS "总数" FROM "思考记录" ${条件子句}`, [...参数]);
      const 总数 = Number(总数结果.rows[0]?.['总数'] ?? 0);
      参数.push(每页条数);
      const 条数占位 = `$${参数.length}`;
      参数.push(偏移量);
      const 偏移占位 = `$${参数.length}`;
      const 列表结果 = await 池.query(
        `SELECT "ID", "用户ID", "角色ID", "事件", "来源", "阶段", "类型", "轮次", LEFT("内容", 200) AS "摘要", "原文长度", "创建时间" FROM "思考记录" ${条件子句} ORDER BY "创建时间" DESC LIMIT ${条数占位} OFFSET ${偏移占位}`,
        参数,
      );
      成功响应(响应, 列表结果.rows, { ye_ma: 页码, mei_ye_tiao_shu: 每页条数, zong_shu: 总数 });
    } catch (错误) {
      响应查询降级(响应, 错误, '思考', '思考', 请求);
    }
  });

  路由.get('/si-kao-ji-lu/:记_录_ID', async (请求: Request, 响应: Response): Promise<void> => {
    const 池 = 取池(请求);
    if (!池) {
      响应依赖缺失(响应, '思考', '数据库', 请求);
      return;
    }
    try {
      const 记录编号 = 校验UUID('ji_lu_id', 请求.params.记_录_ID);
      const 结果 = await 池.query('SELECT * FROM "思考记录" WHERE "ID" = $1 LIMIT 1', [记录编号]);
      if (结果.rows.length === 0) {
        throw new 记录缺失(取文案('通用', '未找到'));
      }
      成功响应(响应, 结果.rows[0]);
    } catch (错误) {
      响应查询降级(响应, 错误, '思考', '思考', 请求);
    }
  });

  路由.get('/ji-yi', async (请求: Request, 响应: Response): Promise<void> => {
    await 思考查询(请求, 响应, '记忆', 记忆透传列, 用户角色过滤);
  });

  路由.get('/dui-hua-zhai-yao', async (请求: Request, 响应: Response): Promise<void> => {
    await 思考查询(请求, 响应, '对话摘要', 对话摘要透传列, 用户角色过滤);
  });

  路由.get('/guan-jian-shi-jian', async (请求: Request, 响应: Response): Promise<void> => {
    await 思考查询(请求, 响应, '关键事件', 关键事件透传列, 用户角色过滤);
  });

  路由.get('/duo-she-ri-zhi', async (请求: Request, 响应: Response): Promise<void> => {
    await 思考查询(请求, 响应, '夺舍日志', 接管记录透传列, [
      { 键: 'guan_li_yuan_id', 列: '管理员ID' },
      { 键: 'jiao_se_id', 列: '角色ID' },
    ]);
  });

  路由.get('/ping-gu', async (请求: Request, 响应: Response): Promise<void> => {
    await 思考查询(请求, 响应, '评估', 评估透传列, 用户角色过滤);
  });

  路由.get('/si-kao-shuo-ming', (_请求: Request, 响应: Response): void => {
    成功响应(响应, {
      you_du_li_si_kao_chi_jiu_hua_biao: true,
      sheng_ming: 取文案('思考', '无持久化声明'),
      hui_fang_zhun_ze: 取文案('思考', '回放准则'),
      shi_shi_shi_jian: ['管理员_深度思考', '管理员_构建过程'],
      shi_shi_shuo_ming: 取文案('思考', '实时事件说明'),
      dan_tiao_jie_duan_zi_fu_shu: 1500,
      yi_chi_jiu_hua_cha_xun: ['思考记录', '记忆', '对话摘要', '关键事件', '夺舍日志', '评估'],
      dai_bu_chong_shuo_ming: 取文案('思考', '待补充说明'),
      dai_bu_chong: 取文案列表('思考', '待补充项'),
    });
  });

  return 路由;
}
