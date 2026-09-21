import { Router, type Request, type Response, type RequestHandler } from 'express';
import { 取文案 } from '../文案';
import { 成功响应, 失败响应 } from '../响应';
import { 错误码 } from '../错误码';
import { 日志 } from '../日志';
import {
  校验UUID,
  校验可选UUID,
  校验白名单,
  参数错误提示,
  解析分页,
  取可选字符串,
  取必填字符串,
  校验失败,
  审核目标类型白名单,
  审核状态白名单,
  审核动作白名单,
  审核伸缩结果白名单,
  工单优先级白名单,
} from '../校验';
import type { 查询池 } from '../数据库';
import type { 认证请求 } from '../中间件/认证';
import { 取真实IP } from '../真实IP';
import { 响应依赖缺失, 响应查询降级 } from '../错误归一化';

function 取池(请求: Request): 查询池 | undefined {
  return (请求.app.locals as { 池?: 查询池 }).池;
}

const 审核表名: Record<string, string> = {
  ju_bao: '举报',
  gong_dan: '工单',
  gong_gao: '公告',
  huo_dong: '活动',
  shi_yan: '实验',
};

const 审核事件名: Record<string, string> = {
  ju_bao: 'guan_li_shen_he_ju_bao',
  gong_dan: 'guan_li_shen_he_gong_dan',
  gong_gao: 'guan_li_shen_he_gong_gao',
  huo_dong: 'guan_li_shen_he_huo_dong',
  shi_yan: 'guan_li_shen_he_shi_yan',
};

const 审核超时小时: Record<string, number> = {
  ju_bao: 24,
  gong_dan: 48,
  gong_gao: 24,
  huo_dong: 72,
  shi_yan: 72,
};

type 查函数 = (文本: string, 参数?: unknown[]) => Promise<import('../数据库').查询结果>;

async function 记审核留痕(
  查: 查函数,
  目标类型: string,
  目标编号: string,
  动作: string,
  操作人: string | null,
  结果: string,
  备注: string,
): Promise<void> {
  await 查('INSERT INTO "审核留痕" ("目标类型", "目标ID", "动作", "操作人ID", "结果", "备注") VALUES ($1, $2, $3, $4, $5, $6)', [
    目标类型,
    目标编号,
    动作,
    操作人,
    结果,
    备注.slice(0, 500),
  ]);
}

async function 记管理审计(查: 查函数, 请求: Request, 事件类型: string, 详情: string): Promise<void> {
  const 操作者 = (请求 as 认证请求).登录用户;
  await 查('INSERT INTO "审计日志" ("用户ID", "IP", "事件类型", "详情", "类型") VALUES ($1, $2, $3, $4::jsonb, $5)', [
    操作者?.yongHuId ?? null,
    取真实IP(请求) ?? '',
    事件类型,
    详情,
    'guan_li',
  ]);
}

function 审核列表列(目标类型: string): string {
  if (目标类型 === 'ju_bao') {
    return '"ID", "举报人ID", "被举报用户ID", "被举报内容ID", "原因", "状态", "一审人ID", "一审结果", "一审时间", "二审人ID", "二审结果", "二审时间", "SLA到期", "创建时间", "更新时间"';
  }
  if (目标类型 === 'gong_dan') {
    return '"ID", "标题", "内容", "提交人ID", "指派人ID", "状态", "优先级", "一审人ID", "一审结果", "一审时间", "二审人ID", "二审结果", "二审时间", "SLA到期", "创建时间", "更新时间"';
  }
  if (目标类型 === 'gong_gao') {
    return '"ID", "标题", "内容", "发布人ID", "状态", "一审人ID", "一审结果", "一审时间", "二审人ID", "二审结果", "二审时间", "定时发布", "SLA到期", "创建时间", "更新时间"';
  }
  if (目标类型 === 'huo_dong') {
    return '"ID", "名称", "描述", "开始时间", "结束时间", "状态", "一审人ID", "一审结果", "一审时间", "二审人ID", "二审结果", "二审时间", "SLA到期", "创建时间", "更新时间"';
  }
  return '"ID", "名称", "描述", "分桶比例", "互斥组", "指标回传", "状态", "一审人ID", "一审结果", "一审时间", "二审人ID", "二审结果", "二审时间", "SLA到期", "创建时间", "更新时间"';
}

async function 列表审核(请求: Request, 响应: Response, 目标类型: string): Promise<void> {
  const 池 = 取池(请求);
  if (!池) {
    响应依赖缺失(响应, '审核运营', '数据库', 请求);
    return;
  }
  try {
    const 查询 = 请求.query as Record<string, unknown>;
    const { 页码, 每页条数, 偏移量 } = 解析分页(查询);
    const 条件: string[] = [];
    const 参数: unknown[] = [];
    const 状态筛选 = 取可选字符串(查询['zhuang_tai']);
    if (状态筛选 !== undefined) {
      校验白名单('zhuang_tai', 状态筛选, 审核状态白名单);
      参数.push(状态筛选);
      条件.push(`"状态" = $${参数.length}`);
    }
    const 超时筛选 = 取可选字符串(查询['chao_shi']);
    if (超时筛选 !== undefined && 超时筛选 !== 'true' && 超时筛选 !== 'false') {
      throw new 校验失败(取文案('审核', '超时筛选有误'));
    }
    if (超时筛选 === 'true') {
      条件.push('"SLA到期" < NOW() AND "状态" IN (\'dai_yi_shen\', \'dai_er_shen\')');
    }
    const 条件子句 = 条件.length > 0 ? `WHERE ${条件.join(' AND ')}` : '';
    const 表 = 审核表名[目标类型];
    const 总数结果 = await 池.query(`SELECT COUNT(*) AS "总数" FROM "${表}" ${条件子句}`, [...参数]);
    const 总数 = Number(总数结果.rows[0]?.['总数'] ?? 0);
    参数.push(每页条数);
    const 条数占位 = `$${参数.length}`;
    参数.push(偏移量);
    const 偏移占位 = `$${参数.length}`;
    const 列表结果 = await 池.query(
      `SELECT ${审核列表列(目标类型)} FROM "${表}" ${条件子句} ORDER BY "创建时间" DESC LIMIT ${条数占位} OFFSET ${偏移占位}`,
      参数,
    );
    成功响应(响应, 列表结果.rows, { ye_ma: 页码, mei_ye_tiao_shu: 每页条数, zong_shu: 总数 });
  } catch (错误) {
    响应查询降级(响应, 错误, '审核运营', '审核', 请求);
  }
}

async function 新建审核(请求: Request, 响应: Response, 目标类型: string): Promise<void> {
  const 池 = 取池(请求);
  if (!池) {
    响应依赖缺失(响应, '审核运营', '数据库', 请求);
    return;
  }
  const 正文 = (请求.body ?? {}) as Record<string, unknown>;
  const 操作者 = (请求 as 认证请求).登录用户;
  const 操作人 = 操作者?.yongHuId ?? null;
  let 插入语句 = '';
  let 插入参数: unknown[] = [];
  const 超时小时 = 审核超时小时[目标类型];
  if (目标类型 === 'ju_bao') {
    const 被举报用户 = 校验可选UUID('bei_ju_bao_yong_hu_id', 正文['bei_ju_bao_yong_hu_id']);
    const 被举报内容 = 取可选字符串(正文['bei_ju_bao_nei_rong_id']) ?? '';
    if (被举报用户 === undefined && 被举报内容 === '') {
      throw new 校验失败(取文案('审核', '缺少举报目标'));
    }
    const 原因 = 取必填字符串(取可选字符串(正文['yuan_yin']), 'yuan_yin', 500);
    插入语句 = 'INSERT INTO "举报" ("举报人ID", "被举报用户ID", "被举报内容ID", "原因", "状态", "SLA到期") VALUES ($1, $2, $3, $4, \'dai_yi_shen\', NOW() + make_interval(hours => $5)) RETURNING "ID"';
    插入参数 = [操作人, 被举报用户 ?? null, 被举报内容, 原因, 超时小时];
  } else if (目标类型 === 'gong_dan') {
    const 标题 = 取必填字符串(取可选字符串(正文['biao_ti']), 'biao_ti', 200);
    const 内容 = 取必填字符串(取可选字符串(正文['nei_rong']), 'nei_rong', 2000);
    const 优先级 = 校验白名单('you_xian_ji', 取可选字符串(正文['you_xian_ji']) ?? 'zhong', 工单优先级白名单);
    const 指派人 = 校验可选UUID('zhi_pai_ren_id', 正文['zhi_pai_ren_id']);
    插入语句 = 'INSERT INTO "工单" ("标题", "内容", "提交人ID", "指派人ID", "优先级", "状态", "SLA到期") VALUES ($1, $2, $3, $4, $5, \'dai_yi_shen\', NOW() + make_interval(hours => $6)) RETURNING "ID"';
    插入参数 = [标题, 内容, 操作人, 指派人 ?? null, 优先级, 超时小时];
  } else if (目标类型 === 'gong_gao') {
    const 标题 = 取必填字符串(取可选字符串(正文['biao_ti']), 'biao_ti', 200);
    const 内容 = 取必填字符串(取可选字符串(正文['nei_rong']), 'nei_rong', 5000);
    const 定时文本 = 取可选字符串(正文['ding_shi_fa_bu']);
    let 定时发布: string | null = null;
    if (定时文本 !== undefined) {
      const 毫秒 = Date.parse(定时文本);
      if (Number.isNaN(毫秒)) {
        throw new 校验失败(参数错误提示('ding_shi_fa_bu'));
      }
      定时发布 = new Date(毫秒).toISOString();
    }
    插入语句 = 'INSERT INTO "公告" ("标题", "内容", "发布人ID", "定时发布", "状态", "SLA到期") VALUES ($1, $2, $3, $4, \'dai_yi_shen\', NOW() + make_interval(hours => $5)) RETURNING "ID"';
    插入参数 = [标题, 内容, 操作人, 定时发布, 超时小时];
  } else if (目标类型 === 'huo_dong') {
    const 名称 = 取必填字符串(取可选字符串(正文['ming_cheng']), 'ming_cheng', 200);
    const 描述 = 取可选字符串(正文['miao_shu']) ?? '';
    if (描述.length > 2000) {
      throw new 校验失败(参数错误提示('miao_shu'));
    }
    const 开始文本 = 取可选字符串(正文['kai_shi_shi_jian']);
    const 结束文本 = 取可选字符串(正文['jie_shu_shi_jian']);
    let 开始: string | null = null;
    let 结束: string | null = null;
    if (开始文本 !== undefined) {
      const 毫秒 = Date.parse(开始文本);
      if (Number.isNaN(毫秒)) {
        throw new 校验失败(参数错误提示('kai_shi_shi_jian'));
      }
      开始 = new Date(毫秒).toISOString();
    }
    if (结束文本 !== undefined) {
      const 毫秒 = Date.parse(结束文本);
      if (Number.isNaN(毫秒)) {
        throw new 校验失败(参数错误提示('jie_shu_shi_jian'));
      }
      结束 = new Date(毫秒).toISOString();
    }
    if (开始 !== null && 结束 !== null && 开始 > 结束) {
      throw new 校验失败(取文案('通用', '时间范围有误'));
    }
    插入语句 = 'INSERT INTO "活动" ("名称", "描述", "开始时间", "结束时间", "状态", "SLA到期") VALUES ($1, $2, $3, $4, \'dai_yi_shen\', NOW() + make_interval(hours => $5)) RETURNING "ID"';
    插入参数 = [名称, 描述, 开始, 结束, 超时小时];
  } else {
    const 名称 = 取必填字符串(取可选字符串(正文['ming_cheng']), 'ming_cheng', 200);
    const 描述 = 取可选字符串(正文['miao_shu']) ?? '';
    if (描述.length > 2000) {
      throw new 校验失败(参数错误提示('miao_shu'));
    }
    const 互斥组 = 取可选字符串(正文['hu_chi_zu']) ?? '';
    if (互斥组.length > 100) {
      throw new 校验失败(参数错误提示('hu_chi_zu'));
    }
    插入语句 = 'INSERT INTO "实验" ("名称", "描述", "互斥组", "状态", "SLA到期") VALUES ($1, $2, $3, \'dai_yi_shen\', NOW() + make_interval(hours => $4)) RETURNING "ID"';
    插入参数 = [名称, 描述, 互斥组, 超时小时];
  }
  const 落库 = async (查: 查函数): Promise<string> => {
    const 新增 = await 查(插入语句, 插入参数);
    const 新编号 = String(新增.rows[0]?.['ID'] ?? '');
    await 记审核留痕(查, 目标类型, 新编号, 'chuang_jian', 操作人, '', 'xin_jian');
    await 记管理审计(查, 请求, 审核事件名[目标类型], JSON.stringify({ 目标类型, 目标ID: 新编号, 操作管理员: 操作人 }));
    return 新编号;
  };
  const 目标编号 = 池.用事务
    ? await 池.用事务(async (事务查) => 落库(事务查))
    : await 落库((文本, 参数) => 池.query(文本, 参数));
  日志.信息('审核运营', '新建审核单', { 目标类型, 目标编号 });
  成功响应(响应, { yi_chu_li: true, mu_biao_id: 目标编号 }, undefined, 201);
}

async function 评审审核(请求: Request, 响应: Response, 目标类型: string, 轮次: 'yi_shen' | 'er_shen'): Promise<void> {
  const 池 = 取池(请求);
  if (!池) {
    响应依赖缺失(响应, '审核运营', '数据库', 请求);
    return;
  }
  const 正文 = (请求.body ?? {}) as Record<string, unknown>;
  const 目标编号 = 校验UUID('mu_biao_id', 取可选字符串(正文['mu_biao_id']));
  const 通过原始 = 正文['tong_guo'];
  if (typeof 通过原始 !== 'boolean') {
    throw new 校验失败(取文案('审核', '评审结论必选'));
  }
  const 备注 = (取可选字符串(正文['bei_zhu']) ?? '').slice(0, 500);
  const 结果 = 通过原始 ? 'tong_guo' : 'bo_hui';
  校验白名单('tong_guo', 结果, 审核伸缩结果白名单);
  const 操作者 = (请求 as 认证请求).登录用户;
  const 操作人 = 操作者?.yongHuId ?? null;
  const 表 = 审核表名[目标类型];
  const 期望态 = 轮次 === 'yi_shen' ? 'dai_yi_shen' : 'dai_er_shen';
  const 下一态 = 轮次 === 'yi_shen' ? (通过原始 ? 'dai_er_shen' : 'bo_hui') : 通过原始 ? 'yi_tong_guo' : 'bo_hui';
  const 一审列 = 轮次 === 'yi_shen';
  const 更新语句 = 一审列
    ? `UPDATE "${表}" SET "状态" = $2, "一审人ID" = $3, "一审结果" = $4, "一审时间" = NOW(), "更新时间" = NOW() WHERE "ID" = $1 AND "状态" = $5`
    : `UPDATE "${表}" SET "状态" = $2, "二审人ID" = $3, "二审结果" = $4, "二审时间" = NOW(), "更新时间" = NOW() WHERE "ID" = $1 AND "状态" = $5`;
  const 落库 = async (查: 查函数): Promise<number> => {
    const 更新 = await 查(更新语句, [目标编号, 下一态, 操作人, 结果, 期望态]);
    const 命中行 = 更新.rowCount ?? 0;
    if (命中行 === 0) {
      return 0;
    }
    await 记审核留痕(查, 目标类型, 目标编号, 轮次, 操作人, 结果, 备注);
    await 记管理审计(查, 请求, 审核事件名[目标类型], JSON.stringify({ 目标类型, 目标ID: 目标编号, 轮次, 结果, 操作管理员: 操作人 }));
    return 命中行;
  };
  const 命中 = 池.用事务
    ? await 池.用事务(async (事务查) => 落库(事务查))
    : await 落库((文本, 参数) => 池.query(文本, 参数));
  if (命中 === 0) {
    失败响应(响应, 404, 取文案('审核', '对象已变化'), 错误码.审核对象已变);
    return;
  }
  日志.信息('审核运营', '评审审核单', { 目标类型, 目标编号, 轮次, 结果 });
  成功响应(响应, { yi_chu_li: true });
}

async function 批量评审(请求: Request, 响应: Response, 目标类型: string): Promise<void> {
  const 池 = 取池(请求);
  if (!池) {
    响应依赖缺失(响应, '审核运营', '数据库', 请求);
    return;
  }
  const 正文 = (请求.body ?? {}) as Record<string, unknown>;
  const 原始列表 = 正文['mu_biao_ids'];
  if (!Array.isArray(原始列表) || 原始列表.length === 0) {
    throw new 校验失败(参数错误提示('mu_biao_id'));
  }
  if (原始列表.length > 50) {
    throw new 校验失败(取文案('审核', '多项目标超限'));
  }
  const 去重 = [...new Set(原始列表)];
  const 目标列表: string[] = [];
  for (const 项 of 去重) {
    目标列表.push(校验UUID('mu_biao_id', 项));
  }
  const 轮次原始 = 取可选字符串(正文['lun_ci']) ?? 'yi_shen';
  if (轮次原始 !== 'yi_shen' && 轮次原始 !== 'er_shen') {
    throw new 校验失败(取文案('审核', '评审轮次有误'));
  }
  const 通过原始 = 正文['tong_guo'];
  if (typeof 通过原始 !== 'boolean') {
    throw new 校验失败(取文案('审核', '评审结论必选'));
  }
  const 结果 = 通过原始 ? 'tong_guo' : 'bo_hui';
  const 操作者 = (请求 as 认证请求).登录用户;
  const 操作人 = 操作者?.yongHuId ?? null;
  const 表 = 审核表名[目标类型];
  const 期望态 = 轮次原始 === 'yi_shen' ? 'dai_yi_shen' : 'dai_er_shen';
  const 下一态 = 轮次原始 === 'yi_shen' ? (通过原始 ? 'dai_er_shen' : 'bo_hui') : 通过原始 ? 'yi_tong_guo' : 'bo_hui';
  const 一审列 = 轮次原始 === 'yi_shen';
  const 更新语句 = 一审列
    ? `UPDATE "${表}" SET "状态" = $2, "一审人ID" = $3, "一审结果" = $4, "一审时间" = NOW(), "更新时间" = NOW() WHERE "ID" = $1 AND "状态" = $5`
    : `UPDATE "${表}" SET "状态" = $2, "二审人ID" = $3, "二审结果" = $4, "二审时间" = NOW(), "更新时间" = NOW() WHERE "ID" = $1 AND "状态" = $5`;
  const 批量落库 = async (查: 查函数): Promise<number> => {
    let 批量命中 = 0;
    for (const 目标编号 of 目标列表) {
      const 更新 = await 查(更新语句, [目标编号, 下一态, 操作人, 结果, 期望态]);
      if ((更新.rowCount ?? 0) === 0) {
        throw new 校验失败(取文案('审核', '多项状态已变'));
      }
      await 记审核留痕(查, 目标类型, 目标编号, 'pi_liang', 操作人, 结果, 轮次原始);
      批量命中 += 1;
    }
    await 记管理审计(查, 请求, 'guan_li_pi_liang_shen_he', JSON.stringify({ 目标类型, 轮次: 轮次原始, 结果, 数量: 批量命中, 操作管理员: 操作人 }));
    return 批量命中;
  };
  const 批量命中数 = 池.用事务
    ? await 池.用事务(async (事务查) => 批量落库(事务查))
    : await 批量落库((文本, 参数) => 池.query(文本, 参数));
  日志.信息('审核运营', '批量评审', { 目标类型, 数量: 批量命中数, 结果 });
  成功响应(响应, { yi_chu_li: true, shu_liang: 批量命中数 });
}

async function 发布下线(请求: Request, 响应: Response, 目标类型: 'gong_gao' | 'huo_dong' | 'shi_yan'): Promise<void> {
  const 池 = 取池(请求);
  if (!池) {
    响应依赖缺失(响应, '审核运营', '数据库', 请求);
    return;
  }
  const 正文 = (请求.body ?? {}) as Record<string, unknown>;
  const 目标编号 = 校验UUID('mu_biao_id', 取可选字符串(正文['mu_biao_id']));
  const 动作原始 = 取可选字符串(正文['dong_zuo']) ?? 'fa_bu';
  if (动作原始 !== 'fa_bu' && 动作原始 !== 'xia_xian' && 动作原始 !== 'jie_shu' && 动作原始 !== 'guan_bi') {
    throw new 校验失败(参数错误提示('dong_zuo'));
  }
  校验白名单('dong_zuo', 动作原始, 审核动作白名单);
  const 期望映射: Record<string, string> = { fa_bu: 'yi_tong_guo', xia_xian: 'yi_fa_bu', jie_shu: 'jin_xing_zhong', guan_bi: 'dai_er_shen' };
  const 下一映射: Record<string, Record<string, string>> = {
    gong_gao: { fa_bu: 'yi_fa_bu', xia_xian: 'yi_xia_xian' },
    huo_dong: { fa_bu: 'jin_xing_zhong', jie_shu: 'yi_jie_shu' },
    shi_yan: { fa_bu: 'yun_xing_zhong', jie_shu: 'yi_jie_shu' },
  };
  const 下一态 = 下一映射[目标类型][动作原始];
  if (下一态 === undefined) {
    throw new 校验失败(参数错误提示('dong_zuo'));
  }
  const 表 = 审核表名[目标类型];
  const 期望态 = 期望映射[动作原始];
  const 操作者 = (请求 as 认证请求).登录用户;
  const 操作人 = 操作者?.yongHuId ?? null;
  const 落库 = async (查: 查函数): Promise<number> => {
    const 更新 = await 查(`UPDATE "${表}" SET "状态" = $2, "更新时间" = NOW() WHERE "ID" = $1 AND "状态" = $3`, [目标编号, 下一态, 期望态]);
    const 命中行 = 更新.rowCount ?? 0;
    if (命中行 === 0) {
      return 0;
    }
    await 记审核留痕(查, 目标类型, 目标编号, 动作原始, 操作人, 下一态, '');
    await 记管理审计(查, 请求, 审核事件名[目标类型], JSON.stringify({ 目标类型, 目标ID: 目标编号, 动作: 动作原始, 操作管理员: 操作人 }));
    return 命中行;
  };
  const 命中 = 池.用事务
    ? await 池.用事务(async (事务查) => 落库(事务查))
    : await 落库((文本, 参数) => 池.query(文本, 参数));
  if (命中 === 0) {
    失败响应(响应, 404, 取文案('审核', '对象已变化'), 错误码.审核对象已变);
    return;
  }
  成功响应(响应, { yi_chu_li: true });
}

export function 创建审核路由(写限流: RequestHandler): Router {
  const 路由 = Router();
  const 高危门禁: RequestHandler = (请求, 响应, 下一步) => {
    void import('../中间件/管理员').then(({ 高危操作门禁 }) => 高危操作门禁(请求, 响应, 下一步));
  };

  const 注册目标 = (目标类型: string, 路径段: string): void => {
    路由.get(`/${路径段}-lie-biao`, async (请求: Request, 响应: Response): Promise<void> => {
      await 列表审核(请求, 响应, 目标类型);
    });
    路由.post(`/${路径段}-xin-jian`, 写限流, 高危门禁, async (请求: Request, 响应: Response): Promise<void> => {
      await 新建审核(请求, 响应, 目标类型);
    });
    路由.post(`/${路径段}-yi-shen`, 写限流, 高危门禁, async (请求: Request, 响应: Response): Promise<void> => {
      await 评审审核(请求, 响应, 目标类型, 'yi_shen');
    });
    路由.post(`/${路径段}-er-shen`, 写限流, 高危门禁, async (请求: Request, 响应: Response): Promise<void> => {
      await 评审审核(请求, 响应, 目标类型, 'er_shen');
    });
    路由.post(`/${路径段}-pi-liang`, 写限流, 高危门禁, async (请求: Request, 响应: Response): Promise<void> => {
      await 批量评审(请求, 响应, 目标类型);
    });
  };

  注册目标('ju_bao', 'ju-bao');
  注册目标('gong_dan', 'gong-dan');
  注册目标('gong_gao', 'gong-gao');
  注册目标('huo_dong', 'huo-dong');
  注册目标('shi_yan', 'shi-yan');
  路由.post('/gong-gao-fa-bu', 写限流, 高危门禁, async (请求: Request, 响应: Response): Promise<void> => {
    await 发布下线(请求, 响应, 'gong_gao');
  });
  路由.post('/huo-dong-fa-bu', 写限流, 高危门禁, async (请求: Request, 响应: Response): Promise<void> => {
    await 发布下线(请求, 响应, 'huo_dong');
  });
  路由.post('/shi-yan-fa-bu', 写限流, 高危门禁, async (请求: Request, 响应: Response): Promise<void> => {
    await 发布下线(请求, 响应, 'shi_yan');
  });
  路由.get('/liu-hen', async (请求: Request, 响应: Response): Promise<void> => {
    const 池 = 取池(请求);
    if (!池) {
      响应依赖缺失(响应, '审核运营', '数据库', 请求);
      return;
    }
    try {
      const 查询 = 请求.query as Record<string, unknown>;
      const { 页码, 每页条数, 偏移量 } = 解析分页(查询);
      const 条件: string[] = [];
      const 参数: unknown[] = [];
      const 目标类型 = 取可选字符串(查询['mu_biao_lei_xing']);
      if (目标类型 !== undefined) {
        校验白名单('mu_biao_lei_xing', 目标类型, 审核目标类型白名单);
        参数.push(目标类型);
        条件.push(`"目标类型" = $${参数.length}`);
      }
      const 目标编号 = 校验可选UUID('mu_biao_id', 查询['mu_biao_id']);
      if (目标编号 !== undefined) {
        参数.push(目标编号);
        条件.push(`"目标ID" = $${参数.length}`);
      }
      const 条件子句 = 条件.length > 0 ? `WHERE ${条件.join(' AND ')}` : '';
      const 总数结果 = await 池.query(`SELECT COUNT(*) AS "总数" FROM "审核留痕" ${条件子句}`, [...参数]);
      const 总数 = Number(总数结果.rows[0]?.['总数'] ?? 0);
      参数.push(每页条数);
      const 条数占位 = `$${参数.length}`;
      参数.push(偏移量);
      const 偏移占位 = `$${参数.length}`;
      const 列表结果 = await 池.query(
        `SELECT "ID", "目标类型", "目标ID", "动作", "操作人ID", "结果", "备注", "创建时间" FROM "审核留痕" ${条件子句} ORDER BY "创建时间" DESC LIMIT ${条数占位} OFFSET ${偏移占位}`,
        参数,
      );
      成功响应(响应, 列表结果.rows, { ye_ma: 页码, mei_ye_tiao_shu: 每页条数, zong_shu: 总数 });
    } catch (错误) {
      响应查询降级(响应, 错误, '审核运营', '审核', 请求);
    }
  });

  return 路由;
}
