import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const 路由根 = path.resolve(__dirname, '../../src/路由');
const 前端根 = path.resolve(__dirname, '../../../管理前端/src');

function 读(目录: string, 相对路径: string): string {
  const 完整 = path.join(目录, 相对路径);
  if (!fs.existsSync(完整)) {
    throw new Error(`对端源文件缺失，列契约无法执行：${完整}`);
  }
  return fs.readFileSync(完整, 'utf8');
}

function 转义(文本: string): string {
  return 文本.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

function 按括号拆分(清单: string): string[] {
  const 段: string[] = [];
  let 当前 = '';
  let 深度 = 0;
  for (const 字 of 清单) {
    if (字 === '(') {
      深度 += 1;
    } else if (字 === ')') {
      深度 -= 1;
    }
    if (字 === ',' && 深度 === 0) {
      段.push(当前);
      当前 = '';
      continue;
    }
    当前 += 字;
  }
  段.push(当前);
  return 段;
}

function 取段列名(段: string): string | null {
  const 净 = 段.trim();
  const 别名 = /AS\s+"([^"]+)"$/.exec(净);
  if (别名) {
    return 别名[1];
  }
  const 原名 = /"([^"]+)"$/.exec(净);
  return 原名 ? 原名[1] : null;
}

function 解析列清单(清单: string): string[] {
  const 结果: string[] = [];
  for (const 段 of 按括号拆分(清单)) {
    if (段.trim().length === 0) {
      continue;
    }
    const 列名 = 取段列名(段);
    if (列名 === null) {
      throw new Error(`列片段解析不出列名：${段}`);
    }
    结果.push(列名);
  }
  if (结果.length === 0) {
    throw new Error('解析出的列清单为空，列契约无法执行');
  }
  return 结果;
}

function 取查询列(相对路径: string, 表名: string, 必含: string): string[] {
  const 源 = 读(路由根, 相对路径);
  const 候选: string[][] = [];
  for (const 匹配 of 源.matchAll(new RegExp(String.raw`SELECT([^;]*?)FROM "${转义(表名)}"`, 'g'))) {
    const 清单 = 匹配[1];
    if (清单.trim().startsWith('COUNT(') || !清单.includes(必含)) {
      continue;
    }
    候选.push(解析列清单(清单));
  }
  const 去重 = [...new Set(候选.map((项) => 项.join('|')))];
  if (去重.length !== 1) {
    throw new Error(`${相对路径} 的 ${表名} 查询命中 ${去重.length} 份不同列清单（必含 ${必含}），列契约无法判定`);
  }
  return 候选[0];
}

function 取常量原文(相对路径: string, 声明: string): string {
  const 源 = 读(路由根, 相对路径);
  const 命中 = new RegExp(String.raw`const ${转义(声明)} =\s*'([^']+)'`).exec(源);
  if (!命中) {
    throw new Error(`${相对路径} 里取不到常量 ${声明} 的列清单`);
  }
  return 命中[1];
}

function 取常量列(相对路径: string, 声明: string): string[] {
  return 解析列清单(取常量原文(相对路径, 声明).split(/\s+FROM\s/i)[0]);
}

function 取审核公共列(): string[] {
  const 源 = 读(路由根, '审核.ts');
  const 起 = 源.indexOf('function 审核列表列(');
  if (起 < 0) {
    throw new Error('审核.ts 里找不到 审核列表列，列契约无法执行');
  }
  const 体 = 源.slice(起, 源.indexOf('\n}', 起));
  const 分支 = [...体.matchAll(/return '([^']+)'/g)].map((匹配) => 解析列清单(匹配[1]));
  if (分支.length !== 5) {
    throw new Error(`审核列表列 应有五类目标各一条列清单，实际 ${分支.length} 条`);
  }
  return 分支[0].filter((列名) => 分支.every((清单) => 清单.includes(列名)));
}

function 取账号行派生列(sql列: string[]): string[] {
  const 源 = 读(路由根, '账号.ts');
  const 起 = 源.indexOf('function 补角色(');
  if (起 < 0) {
    throw new Error('账号.ts 里找不到 补角色，列契约无法执行');
  }
  const 体 = 源.slice(起, 源.indexOf('\n}', 起));
  const 新增 = [...体.matchAll(/\{ \.\.\.行, ([^:,]+):/g)].map((匹配) => 匹配[1].trim());
  const 剔除 = [...体.matchAll(/delete 副本\['([^']+)'\]/g)].map((匹配) => 匹配[1]);
  if (新增.length === 0 || 剔除.length === 0) {
    throw new Error('补角色 的派生列读不到，列契约无法执行');
  }
  return [...sql列.filter((列名) => !剔除.includes(列名)), ...新增];
}

interface 透传页签绑定 {
  readonly 表: string;
  readonly 列常量: string;
}

function 解析透传页签(源: string): 透传页签绑定[] {
  if (/SELECT \* FROM "\$\{表\}"/.test(源)) {
    throw new Error('思考.ts 的透传查询仍是 SELECT *，列清单必须显式化并进列契约');
  }
  const 页签: 透传页签绑定[] = [...源.matchAll(/思考查询\(请求, 响应, '([^']+)',\s*([^\s,]+),/g)].map((匹配) => ({
    表: 匹配[1],
    列常量: 匹配[2],
  }));
  if (页签.length < 5) {
    throw new Error(`思考.ts 只解析出 ${页签.length} 个透传页签，少于五个，列契约无法判定`);
  }
  return 页签;
}

const 透传表对前端表: Readonly<Record<string, string>> = {
  记忆: '记忆',
  对话摘要: '对话摘要',
  关键事件: '关键事件',
  夺舍日志: '接管记录',
  评估: '评估',
};

function 取透传页签(): 透传页签绑定[] {
  const 页签 = 解析透传页签(读(路由根, '思考.ts'));
  const 未用 = Object.keys(透传表对前端表).filter((表) => !页签.some((项) => 项.表 === 表));
  if (未用.length > 0) {
    throw new Error(`透传出处登记里的 ${未用.join('、')} 已从 思考.ts 消失，登记要跟着删`);
  }
  return 页签;
}

function 透传前端表名(表: string): string {
  const 名 = 透传表对前端表[表];
  if (名 === undefined) {
    throw new Error(`透传页签 ${表} 未登记前端表名，列契约无法判定`);
  }
  return 名;
}

const 透传页签清单 = 取透传页签();

interface 契约登记 {
  readonly 标题: string;
  readonly 后端列: () => string[];
  readonly 前端表: readonly string[];
  readonly 未上屏: readonly string[];
}

const 契约清单: readonly 契约登记[] = [
  {
    标题: '账号行（列表 / 详情 / 概览共用一次查询）',
    后端列: () => 取账号行派生列(取常量列('账号.ts', '列表列')),
    前端表: ['账号列表', '账号详情', '账号概览'],
    未上屏: [],
  },
  {
    标题: '单聊消息',
    后端列: () => 取常量列('聊天.ts', '消息列'),
    前端表: ['单聊消息'],
    未上屏: ['ID', '用户ID', '角色ID', '已读', '已撤回', '客户端序号'],
  },
  {
    标题: '好友消息',
    后端列: () => 取常量列('聊天.ts', '好友消息列'),
    前端表: ['好友消息'],
    未上屏: ['ID', '接收者ID', '已读', '撤回'],
  },
  {
    标题: '思考记录',
    后端列: () => 取查询列('思考.ts', '思考记录', '"摘要"'),
    前端表: ['思考记录'],
    未上屏: [],
  },
  {
    标题: '封禁记录',
    后端列: () => 取查询列('封禁.ts', '封禁记录', '"原因"'),
    前端表: ['封禁记录'],
    未上屏: ['ID', '解封时间'],
  },
  {
    标题: '账号封禁与申诉',
    后端列: () => 取查询列('封禁.ts', '账号封禁', '"最后原因"'),
    前端表: ['账号封禁'],
    未上屏: ['违规次数', '解封时间'],
  },
  {
    标题: '审计日志',
    后端列: () => 取查询列('审计.ts', '审计日志', '"详情"'),
    前端表: ['审计日志'],
    未上屏: ['ID'],
  },
  {
    标题: '审核列表（五类目标公共列）',
    后端列: 取审核公共列,
    前端表: ['审核列表'],
    未上屏: ['一审人ID', '一审结果', '一审时间', '二审人ID', '二审结果', '二审时间', 'SLA到期', '更新时间'],
  },
  {
    标题: '审核留痕',
    后端列: () => 取查询列('审核.ts', '审核留痕', '"目标ID"'),
    前端表: ['审核留痕'],
    未上屏: ['ID', '目标类型', '动作', '操作人ID', '结果', '备注'],
  },
  {
    标题: '注册统计',
    后端列: () => 取查询列('统计.ts', '用户', '"日期"'),
    前端表: ['注册统计'],
    未上屏: [],
  },
  {
    标题: '消息统计',
    后端列: () => 取查询列('统计.ts', '消息', '"发送方"'),
    前端表: ['消息统计'],
    未上屏: [],
  },
  {
    标题: '留存统计',
    后端列: () => 取查询列('统计.ts', '消息', 'DISTINCT'),
    前端表: ['留存统计'],
    未上屏: [],
  },
  {
    标题: '好感度总览',
    后端列: () => 取常量列('统计.ts', '好感总览'),
    前端表: ['好感总览'],
    未上屏: [],
  },
  {
    标题: '好感度分阶段',
    后端列: () => 取常量列('统计.ts', '好感按阶段'),
    前端表: ['好感阶段'],
    未上屏: [],
  },
  {
    标题: '用量统计',
    后端列: () => 取查询列('统计.ts', 'LLM用量', '"模型类型"'),
    前端表: ['用量统计'],
    未上屏: ['模型', '次数', '输入', '输出'],
  },
  ...透传页签清单.map((项) => ({
    标题: `透传 ${项.表}（列清单 ${项.列常量}）`,
    后端列: () => 取常量列('思考.ts', 项.列常量),
    前端表: [透传前端表名(项.表)],
    未上屏: [] as readonly string[],
  })),
];

function 解析前端列定义(): Map<string, string[]> {
  const 源 = 读(前端根, '列定义.ts');
  const 命中 = /export const 列定义登记 = \{([\s\S]*?)\n\} as const;/.exec(源);
  if (!命中) {
    throw new Error('前端源里取不到 列定义登记 的登记表，列契约无法执行');
  }
  const 结果 = new Map<string, string[]>();
  for (const 匹配 of 命中[1].matchAll(/(\S+): \[([\s\S]*?)\] as const/g)) {
    const 列名清单 = [...匹配[2].matchAll(/列\(\s*(?:'([^']*)'\s*,\s*)?/g)]
      .map((项) => 项[1])
      .filter((项): 项 is string => typeof 项 === 'string' && 项.length > 0);
    if (列名清单.length === 0) {
      throw new Error(`${匹配[1]} 未解析出任何数据键`);
    }
    结果.set(匹配[1], [...new Set(列名清单)]);
  }
  if (结果.size < 9) {
    throw new Error(`前端列定义只解析出 ${结果.size} 张表，少于九张，列契约无法执行`);
  }
  return 结果;
}

const 前端表清单 = 解析前端列定义();
const 登记面 = new Set<string>(契约清单.map((项) => 项.前端表).flat());

function 比对契约(后端: readonly string[], 前端: readonly string[], 未上屏: readonly string[]): string[] {
  const 后端集 = new Set(后端);
  const 前端集 = new Set(前端);
  const 未上屏集 = new Set(未上屏);
  const 违例: string[] = [];
  for (const 列名 of 前端集) {
    if (!后端集.has(列名)) {
      违例.push(`前端声明的数据键 ${列名} 不是后端返回列`);
    }
  }
  const 应属未上屏 = 后端.filter((列名) => !前端集.has(列名));
  for (const 列名 of 未上屏集) {
    if (前端集.has(列名)) {
      违例.push(`${列名} 同时登记为已上屏与未上屏`);
    }
    if (!后端集.has(列名)) {
      违例.push(`未上屏登记里的 ${列名} 后端已不再返回，登记要跟着删`);
    }
  }
  for (const 列名 of 应属未上屏) {
    if (!未上屏集.has(列名)) {
      违例.push(`后端列 ${列名} 既没进列定义也没登记未上屏`);
    }
  }
  return 违例;
}

describe('FP-03 列定义与后端返回列双向契约', () => {
  it('前端每张表的列定义都在契约里登记，两侧不留下无人认领的表', () => {
    expect(前端表清单.size).toBeGreaterThanOrEqual(9);
    for (const 表 of 前端表清单.keys()) {
      expect(登记面.has(表), `列定义.ts 新增的表 ${表} 未登记到列契约`).toBe(true);
    }
    for (const 表 of 登记面) {
      expect(前端表清单.has(表), `契约登记的表 ${表} 已从列定义.ts 消失`).toBe(true);
    }
  });

  it('每张表：前端数据键集合与后端实际返回列双向吻合', () => {
    const 违例: string[] = [];
    for (const 项 of 契约清单) {
      const 后端 = 项.后端列();
      const 前端 = 项.前端表.flatMap((表) => 前端表清单.get(表) ?? []);
      违例.push(...比对契约(后端, 前端, 项.未上屏).map((条) => `${项.标题}：${条}`));
    }
    expect(违例).toEqual([]);
  });

  it('透传页签：五页签各自绑定一份显式列清单，快照列与后端列双向相等且不留未上屏', () => {
    expect(透传页签清单.length).toBeGreaterThanOrEqual(5);
    const 违例: string[] = [];
    for (const 项 of 透传页签清单) {
      const 前端表 = 透传前端表名(项.表);
      const 后端 = 取常量列('思考.ts', 项.列常量);
      const 前端 = 前端表清单.get(前端表) ?? [];
      if (后端.length === 0) {
        违例.push(`${项.表} 的列清单 ${项.列常量} 解析为空`);
      }
      if (前端.length === 0) {
        违例.push(`前端表 ${前端表} 未登记任何列`);
      }
      违例.push(...比对契约(后端, 前端, []).map((条) => `${项.表}：${条}`));
    }
    expect(违例).toEqual([]);
  });

  it('思考记录：列表查询的每一列都进了前端列定义，未上屏登记已解冻', () => {
    const 后端 = 取查询列('思考.ts', '思考记录', '"摘要"');
    const 前端 = 前端表清单.get('思考记录') ?? [];
    expect(后端.length).toBeGreaterThanOrEqual(11);
    expect(比对契约(后端, 前端, [])).toEqual([]);
  });

  it('反证：漏一列、多一列、后端改名、登记不删都要判红', () => {
    const 后端 = ['用户编号', '昵称', '封禁级别'];
    expect(比对契约(后端, ['用户编号', '昵称'], ['封禁级别'])).toEqual([]);
    expect(比对契约(后端, ['用户编号'], ['封禁级别'])).toEqual(['后端列 昵称 既没进列定义也没登记未上屏']);
    expect(比对契约(后端, ['用户编号', '昵称', '级别'], ['封禁级别'])).toEqual([
      '前端声明的数据键 级别 不是后端返回列',
    ]);
    expect(比对契约(后端, ['用户编号', '昵称', '封禁级别'], ['封禁级别'])).toEqual([
      '封禁级别 同时登记为已上屏与未上屏',
    ]);
    expect(比对契约(['用户编号', '昵称'], ['用户编号', '昵称', '手机号'], [])).toEqual([
      '前端声明的数据键 手机号 不是后端返回列',
    ]);
    expect(比对契约(后端, ['用户编号', '昵称'], ['封禁级别', '已删列'])).toEqual([
      '未上屏登记里的 已删列 后端已不再返回，登记要跟着删',
    ]);
    expect(比对契约(['用户编号', '昵称'], ['用户编号'], [])).toEqual(['后端列 昵称 既没进列定义也没登记未上屏']);
    expect(() => 取查询列('审计.ts', '不存在的表', '"详情"')).toThrow();
    expect(() => 取常量列('账号.ts', '不存在的常量')).toThrow();
    expect(() => 解析透传页签("await 思考查询(请求, 响应, '记忆', 用户角色过滤);")).toThrow();
    expect(() =>
      解析透传页签('`SELECT * FROM "${表}"`' + "await 思考查询(请求, 响应, '记忆', 记忆透传列, 用户角色过滤);".repeat(5)),
    ).toThrow();
    expect(() => 解析列清单('LEFT("内容", 200)')).toThrow();
  });
});
