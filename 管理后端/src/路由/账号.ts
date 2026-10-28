import { Router, type Request, type Response } from 'express';
import { 取文案 } from '../文案';
import { 成功响应 } from '../响应';
import {
  校验UUID,
  校验手机号,
  解析分页,
  取可选字符串,
  记录缺失,
} from '../校验';
import type { 查询池 } from '../数据库';
import type { 认证请求 } from '../中间件/认证';
import { 取管理角色, 敏感读门禁 } from '../中间件/管理员';
import { 清洗行, 清洗行列表, type 字段清洗项 } from '../文本清洗';
import { 取真实IP } from '../真实IP';
import { 响应依赖缺失 } from '../错误归一化';

function 取池(请求: Request): 查询池 | undefined {
  return (请求.app.locals as { 池?: 查询池 }).池;
}

function 掩码手机号(原始: unknown): string {
  if (typeof 原始 !== 'string' || !/^1[3-9]\d{9}$/.test(原始)) {
    return '';
  }
  return `${原始.slice(0, 3)}****${原始.slice(7)}`;
}

/** YH-108 三角色口径：角色由服务端按三旗标列推导，三列原始布尔一律不外传，前端不得拿任一单列当二值权限判断 */
function 补角色(行: Record<string, unknown>): Record<string, unknown> {
  const 副本: Record<string, unknown> = { ...行, 角色: 取管理角色(行) };
  delete 副本['管理员'];
  delete 副本['运营'];
  delete 副本['审核员'];
  return 副本;
}

function 脱敏列表行(行: Record<string, unknown>): Record<string, unknown> {
  const 副本 = 补角色(行);
  副本['手机号'] = 掩码手机号(副本['手机号']);
  return 副本;
}

/**
 * 输出安全（与 路由/封禁、路由/聊天、路由/思考、路由/审核 同口径）：
 * 账号资料里的 昵称 / 签名 / 人设标签 都是玩家自由文本，历史存量可能带控制字符或超长，
 * 读出口必须再过一层 文本清洗，否则控制字符会被管理端界面放大展示。
 * 上限按各字段在管理端的展示合理值定：昵称 50、签名 500、人设标签 200。
 */
const 账号文本字段: readonly 字段清洗项[] = [
  { 字段: '昵称', 上限: 50 },
  { 字段: '签名', 上限: 500 },
  { 字段: '人设标签', 上限: 200 },
];

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
  'u."ID", u."手机号", u."用户名", u."昵称", u."默认性别", u."管理员", u."运营", u."审核员", u."人设标签", u."签名", u."创建时间", f."级别" AS "封禁级别", f."违规次数" AS "违规次数", f."申诉状态" AS "申诉状态", f."解封时间" AS "账号解封时间"';
const 列表来源 = 'FROM "用户" u LEFT JOIN "账号封禁" f ON f."用户ID" = u."ID"';

export function 创建账号路由(): Router {
  const 路由 = Router();

  路由.get('/zhang-hao-lie-biao', async (请求: Request, 响应: Response): Promise<void> => {
    const 池 = 取池(请求);
    if (!池) {
      响应依赖缺失(响应, '账号', '数据库', 请求);
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
      校验手机号('shou_ji_hao', 手机号);
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
    成功响应(响应, 清洗行列表(列表结果.rows.map(脱敏列表行), 账号文本字段), { ye_ma: 页码, mei_ye_tiao_shu: 每页条数, zong_shu: 总数 });
  });

  路由.get('/zhang-hao-xiang-qing/:yongHuId', async (请求: Request, 响应: Response): Promise<void> => {
    const 池 = 取池(请求);
    if (!池) {
      响应依赖缺失(响应, '账号', '数据库', 请求);
      return;
    }
    const 用户编号 = 校验UUID('yong_hu_id', 请求.params.yongHuId);
    const 结果 = await 池.query(
      `SELECT ${列表列} ${列表来源} WHERE u."ID" = $1 LIMIT 1`,
      [用户编号],
    );
    if (结果.rows.length === 0) {
      throw new 记录缺失(取文案('账号', '账号不存在'));
    }
    await 记敏感读审计(池, 请求, 用户编号, 'guan_li_cha_kan_zhang_hao_xiang_qing');
    成功响应(响应, 清洗行(脱敏列表行(结果.rows[0]), 账号文本字段));
  });

  // 所见即所得：手机号明文接口收口到超管专属。前端无任何调用入口（全仓 grep 零命中），
  // 此前挂在通用只读门禁下＝任一持 cha_kan 的角色都能直连取走明文，审计只是事后留痕。
  路由.get('/zhang-hao-jie-mi/:yongHuId', 敏感读门禁, async (请求: Request, 响应: Response): Promise<void> => {
    const 池 = 取池(请求);
    if (!池) {
      响应依赖缺失(响应, '账号', '数据库', 请求);
      return;
    }
    const 用户编号 = 校验UUID('yong_hu_id', 请求.params.yongHuId);
    const 结果 = await 池.query(
      `SELECT ${列表列} ${列表来源} WHERE u."ID" = $1 LIMIT 1`,
      [用户编号],
    );
    if (结果.rows.length === 0) {
      throw new 记录缺失(取文案('账号', '账号不存在'));
    }
    await 记敏感读审计(池, 请求, 用户编号, 'guan_li_jie_mi_shou_ji_hao');
    成功响应(响应, 清洗行(补角色(结果.rows[0]), 账号文本字段));
  });

  return 路由;
}
