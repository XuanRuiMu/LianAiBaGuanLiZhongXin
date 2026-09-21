import { Router, type Request, type Response } from 'express';
import { 成功响应 } from '../响应';
import {
  校验可选UUID,
  校验发送方,
  校验排序方向,
  解析分页,
  解析时间范围,
} from '../校验';
import type { 查询池 } from '../数据库';
import { 响应依赖缺失 } from '../错误归一化';

function 取池(请求: Request): 查询池 | undefined {
  return (请求.app.locals as { 池?: 查询池 }).池;
}

const 消息列 =
  '"ID", "用户ID", "角色ID", "内容", "发送者", "类型", "已读", "已撤回", "客户端序号", "创建时间"';

const 好友消息列 = '"ID", "发送者ID", "接收者ID", "内容", "类型", "已读", "撤回", "创建时间"';

export function 创建聊天路由(): Router {
  const 路由 = Router();

  路由.get('/xiao-xi', async (请求: Request, 响应: Response): Promise<void> => {
    const 池 = 取池(请求);
    if (!池) {
      响应依赖缺失(响应, '聊天', '数据库', 请求);
      return;
    }
    const 查询 = 请求.query as Record<string, unknown>;
    const { 页码, 每页条数, 偏移量 } = 解析分页(查询);
    const 用户编号 = 校验可选UUID('yong_hu_id', 查询['yong_hu_id']);
    const 角色编号 = 校验可选UUID('jiao_se_id', 查询['jiao_se_id']);
    const 发送方 = 校验发送方(查询['fa_song_fang']);
    const 方向 = 校验排序方向(查询['pai_xu']);
    const { 开始, 结束 } = 解析时间范围(查询);
    const 条件: string[] = [];
    const 参数: unknown[] = [];
    if (用户编号 !== undefined) {
      参数.push(用户编号);
      条件.push(`"用户ID" = $${参数.length}`);
    }
    if (角色编号 !== undefined) {
      参数.push(角色编号);
      条件.push(`"角色ID" = $${参数.length}`);
    }
    if (发送方 !== '') {
      参数.push(发送方);
      条件.push(`"发送者" = $${参数.length}`);
    }
    if (开始 !== undefined) {
      参数.push(开始);
      条件.push(`"创建时间" >= $${参数.length}`);
    }
    if (结束 !== undefined) {
      参数.push(结束);
      条件.push(`"创建时间" <= $${参数.length}`);
    }
    const 条件子句 = 条件.length > 0 ? `WHERE ${条件.join(' AND ')}` : '';
    const 总数结果 = await 池.query(`SELECT COUNT(*) AS "总数" FROM "消息" ${条件子句}`, [...参数]);
    const 总数 = Number(总数结果.rows[0]?.['总数'] ?? 0);
    参数.push(每页条数);
    const 条数占位 = `$${参数.length}`;
    参数.push(偏移量);
    const 偏移占位 = `$${参数.length}`;
    const 列表结果 = await 池.query(
      `SELECT ${消息列} FROM "消息" ${条件子句} ORDER BY "创建时间" ${方向} LIMIT ${条数占位} OFFSET ${偏移占位}`,
      参数,
    );
    成功响应(响应, 列表结果.rows, { ye_ma: 页码, mei_ye_tiao_shu: 每页条数, zong_shu: 总数 });
  });

  路由.get('/hao-you-xiao-xi', async (请求: Request, 响应: Response): Promise<void> => {
    const 池 = 取池(请求);
    if (!池) {
      响应依赖缺失(响应, '聊天', '数据库', 请求);
      return;
    }
    const 查询 = 请求.query as Record<string, unknown>;
    const { 页码, 每页条数, 偏移量 } = 解析分页(查询);
    const 发送者编号 = 校验可选UUID('fa_song_zhe_id', 查询['fa_song_zhe_id']);
    const 接收者编号 = 校验可选UUID('jie_shou_zhe_id', 查询['jie_shou_zhe_id']);
    const { 开始, 结束 } = 解析时间范围(查询);
    const 条件: string[] = [];
    const 参数: unknown[] = [];
    if (发送者编号 !== undefined) {
      参数.push(发送者编号);
      条件.push(`"发送者ID" = $${参数.length}`);
    }
    if (接收者编号 !== undefined) {
      参数.push(接收者编号);
      条件.push(`"接收者ID" = $${参数.length}`);
    }
    if (开始 !== undefined) {
      参数.push(开始);
      条件.push(`"创建时间" >= $${参数.length}`);
    }
    if (结束 !== undefined) {
      参数.push(结束);
      条件.push(`"创建时间" <= $${参数.length}`);
    }
    const 条件子句 = 条件.length > 0 ? `WHERE ${条件.join(' AND ')}` : '';
    const 总数结果 = await 池.query(`SELECT COUNT(*) AS "总数" FROM "好友消息" ${条件子句}`, [...参数]);
    const 总数 = Number(总数结果.rows[0]?.['总数'] ?? 0);
    参数.push(每页条数);
    const 条数占位 = `$${参数.length}`;
    参数.push(偏移量);
    const 偏移占位 = `$${参数.length}`;
    const 列表结果 = await 池.query(
      `SELECT ${好友消息列} FROM "好友消息" ${条件子句} ORDER BY "创建时间" DESC LIMIT ${条数占位} OFFSET ${偏移占位}`,
      参数,
    );
    成功响应(响应, 列表结果.rows, { ye_ma: 页码, mei_ye_tiao_shu: 每页条数, zong_shu: 总数 });
  });

  return 路由;
}
