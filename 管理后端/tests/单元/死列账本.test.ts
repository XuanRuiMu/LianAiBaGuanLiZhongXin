import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';
import dotenv from 'dotenv';

const 后端根 = path.resolve(__dirname, '..', '..');
const 管理端根 = path.resolve(后端根, '..');

const 扫描面: ReadonlyArray<{ 名称: string; 根: string; 后缀: readonly string[] }> = [
  { 名称: '管理后端/src', 根: path.join(后端根, 'src'), 后缀: ['.ts'] },
  { 名称: '管理前端/src', 根: path.join(管理端根, '管理前端', 'src'), 后缀: ['.ts', '.vue'] },
];

const 死列 = '性别';

function 转义(文本: string): string {
  return 文本.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

interface 禁读形态 {
  readonly 名称: string;
  readonly 模式: RegExp;
  readonly 样张: readonly string[];
  readonly 为什么: string;
}

const 禁读形态清单: readonly 禁读形态[] = [
  {
    名称: 'SQL 限定列读',
    模式: new RegExp(String.raw`\w+\."${死列}"`),
    样张: ['SELECT u."ID", u."性别" FROM "用户" u', 'xx."性别"'],
    为什么: '按别名点出该列，删列即 PostgreSQL 42703 打挂账号列表/详情',
  },
  {
    名称: 'SQL 列标识符',
    模式: new RegExp(String.raw`"${死列}"`),
    样张: ['SELECT "性别" FROM "用户"', 'UPDATE "用户" SET "性别" = NULL'],
    为什么: '显式列清单里的裸列名（读与写同形），删列后语句无法解析',
  },
  {
    名称: '行对象属性读',
    模式: new RegExp(String.raw`\.(?:${死列}|xing_bie)(?![0-9A-Za-z_\u4e00-\u9fa5])`),
    样张: ['return row.性别;', '行.xing_bie'],
    为什么: '把该列当查询结果属性消费，删列后读到 undefined 仍是假陈述',
  },
  {
    名称: '下标键读',
    模式: new RegExp(String.raw`\[\s*['"](?:${死列}|xing_bie)['"]\s*\]`),
    样张: ["行['性别']", '详情["xing_bie"]'],
    为什么: '下标形态的属性读点，与点号形态等价',
  },
  {
    名称: '列定义数据键',
    模式: new RegExp(String.raw`列\w*\(\s*['"](?:${死列}|xing_bie)['"]`),
    样张: ["文本列('性别', ['账号', '性别'])"],
    为什么: '前端把该列登记成上屏数据键，后端一删列该键恒空',
  },
  {
    名称: '出参键名',
    模式: /xing_bie/,
    样张: ['xing_bie: row.性别', '"xing_bie"'],
    为什么: '死列在 和我恋爱吧 出参里的键名，管理中心不得消费',
  },
];

function 去注释(文本: string): string {
  return 文本.replace(/<!--[\s\S]*?-->/g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
}

function 源文件清单(根: string, 后缀: readonly string[]): string[] {
  const 结果: string[] = [];
  const 栈 = [根];
  while (栈.length > 0) {
    const 当前 = 栈.pop() as string;
    const 状态 = fs.statSync(当前);
    if (状态.isDirectory()) {
      for (const 子 of fs.readdirSync(当前)) {
        栈.push(path.join(当前, 子));
      }
    } else if (后缀.some((扩展) => 当前.endsWith(扩展))) {
      结果.push(当前);
    }
  }
  return 结果.sort();
}

function 扫描禁读命中(): string[] {
  const 命中: string[] = [];
  for (const 面 of 扫描面) {
    for (const 文件 of 源文件清单(面.根, 面.后缀)) {
      const 相对 = path.relative(管理端根, 文件).replace(/\\/g, '/');
      const 行们 = 去注释(fs.readFileSync(文件, 'utf8')).split(/\r?\n/);
      行们.forEach((行, 序号) => {
        for (const 形态 of 禁读形态清单) {
          if (形态.模式.test(行)) {
            命中.push(`${相对}:${序号 + 1} ${形态.名称}`);
          }
        }
      });
    }
  }
  return 命中.sort();
}

const 例外申报清单: readonly string[] = [];

function 取常量列(源: string, 声明: string): string[] {
  const 命中 = new RegExp(String.raw`const ${转义(声明)} =\s*'([^']+)'`).exec(源);
  if (命中 === null) {
    throw new Error(`账号.ts 里取不到常量 ${声明} 的列清单，死列账本拒绝空跑`);
  }
  return 命中[1].split(',').map((段) => 段.trim()).filter((段) => 段.length > 0);
}

const 后端账号源 = fs.readFileSync(path.join(后端根, 'src', '路由', '账号.ts'), 'utf8');
const 前端列定义源 = fs.readFileSync(path.join(管理端根, '管理前端', 'src', '列定义.ts'), 'utf8');
const 前端枚举出口源 = fs.readFileSync(path.join(管理端根, '管理前端', 'src', '枚举映射.ts'), 'utf8');
const 账号列清单 = 取常量列(后端账号源, '列表列');

function 真库连接串(): string {
  const 显式 = (process.env.TEST_DATABASE_URL ?? '').trim();
  if (显式 !== '') {
    return 显式;
  }
  const 运行 = (process.env.DATABASE_URL ?? '').trim();
  if (运行 !== '' && !运行.includes('localhost:5432/test')) {
    return 运行;
  }
  try {
    const 解析 = dotenv.parse(fs.readFileSync(path.join(后端根, '.env')));
    return (解析['DATABASE_URL'] ?? '').trim();
  } catch {
    return '';
  }
}

async function 取表列(表: string): Promise<Set<string> | null> {
  const 连接 = 真库连接串();
  if (连接 === '') {
    console.warn('[死列账本] 未配置真实库连接串（TEST_DATABASE_URL / DATABASE_URL / 管理后端/.env），真库只读核对跳过');
    return null;
  }
  const 池 = new Pool({ connectionString: 连接, connectionTimeoutMillis: 3000 });
  try {
    const 结果 = await 池.query(
      'SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = $1',
      [表],
    );
    return new Set(结果.rows.map((行) => String(行['column_name'])));
  } finally {
    await 池.end().catch(() => undefined);
  }
}

describe('FP-28a 用户.性别 死列读取账本（管理中心删列前置条件）', () => {
  it('扫描面与禁读形态本身非空，账本不允许空跑', () => {
    const 文件数 = 扫描面.reduce((计, 面) => 计 + 源文件清单(面.根, 面.后缀).length, 0);
    expect(扫描面.length).toBe(2);
    expect(文件数).toBeGreaterThanOrEqual(40);
    expect(禁读形态清单.length).toBeGreaterThanOrEqual(6);
    for (const 形态 of 禁读形态清单) {
      expect(形态.样张.length, `禁读形态 ${形态.名称} 没给样张 = 该形态从未被验证能判红`).toBeGreaterThan(0);
    }
  });

  it('管理端源码对 `用户.性别` 零读零写：禁读命中集与例外申报清单双向相等', () => {
    expect(扫描禁读命中()).toEqual(例外申报清单.slice().sort());
  });

  it('账本正向登记：管理中心唯一的性别口径读点是 `用户.默认性别`', () => {
    expect(账号列清单.filter((段) =>段 === 'u."默认性别"')).toHaveLength(1);
    expect(账号列清单.filter((段) =>段 === 'u."性别"')).toHaveLength(0);
    expect(前端列定义源).toContain("枚举列('默认性别', ['账号', '性别'], '性别')");
    expect(前端列定义源).not.toMatch(/文本列\('默认性别'/);
    const 族名集 = new Set(
      [...(/export type 徽标族 =([\s\S]*?);/.exec(前端枚举出口源)?.[1] ?? '').matchAll(/'([^']+)'/g)].map((匹配) => 匹配[1]),
    );
    expect(族名集.has('性别')).toBe(true);
    expect(前端枚举出口源).toContain("import { 性别族 } from './枚举映射/性别';");
    expect(前端枚举出口源).toContain('性别: 性别族,');
  });

  it('值域不混比：`性别` 族只承载 male/female，不得把 nan/nv 折进同一套值域', async () => {
    const 族源 = fs.readFileSync(path.join(管理端根, '管理前端', 'src', '枚举映射', '性别.ts'), 'utf8');
    const 键表体 = /性别文案键表 = \{([\s\S]*?)\} as const/.exec(族源)?.[1] ?? '';
    const 码集 = [...键表体.matchAll(/^\s+([^:]+):/gm)].map((匹配) => 匹配[1].trim()).sort();
    expect(码集).toEqual(['female', 'male']);
    expect(族源).not.toMatch(/'nan'|'nv'|=== 'female'|=== 'male'/);
  });

  it('真库只读核对：账号列清单的每一列都在真实库存在，且清单里没有 `性别`', async () => {
    const 用户列 = await 取表列('用户');
    if (用户列 === null) {
      return;
    }
    const 封禁列 = await 取表列('账号封禁');
    expect(封禁列).not.toBeNull();
    const 缺列: string[] = [];
    for (const 段 of 账号列清单) {
      const 命中 = /^(?:u|f)\."([^"]+)"(?:\s+AS\s+"([^"]+)")?$/.exec(段);
      if (命中 === null) {
        throw new Error(`账号列清单解析不出片段：${段}`);
      }
      const 表列 = 段.startsWith('u.') ? 用户列 : (封禁列 as Set<string>);
      if (!表列.has(命中[1])) {
        缺列.push(`${段.startsWith('u.') ? '用户' : '账号封禁'}.${命中[1]}`);
      }
    }
    expect(缺列, '账号列清单里有真实库不存在的列，删列或改列后账本未同步').toEqual([]);
    expect(用户列.has('默认性别'), '`默认性别` 需由 037 迁移补齐，未补齐的库上此读点即 42703').toBe(true);
    expect(账号列清单.some((段) => 段 === 'u."性别"')).toBe(false);
  });

  it('反证：把任一禁读形态塞回源码都要被账本判红，且放行合规行', () => {
    const 违例集: string[] = [];
    for (const 形态 of 禁读形态清单) {
      const 抓到 = 形态.样张.filter((样) => 形态.模式.test(样));
      if (抓到.length !== 形态.样张.length) {
        违例集.push(`禁读形态 ${形态.名称} 漏抓：${形态.样张.filter((样) => !形态.模式.test(样)).join(' / ')}`);
      }
    }
    expect(违例集).toEqual([]);
    const 合规 = [
      'u."默认性别"',
      "枚举列('默认性别', ['账号', '性别'], '性别')",
      'male: 账号枚举文案.性别男,',
      'const 性别 = 用户列.get(性别键)',
    ];
    for (const 行 of 合规) {
      for (const 形态 of 禁读形态清单) {
        expect(形态.模式.test(行), `合规行「${行}」被禁读形态 ${形态.名称} 误伤`).toBe(false);
      }
    }
    expect(扫描禁读命中()).toEqual([]);
    const 净行 = 去注释('// 注释里写 u."性别" 只是说明，不算读点\nconst 列 = \'u."性别"\';').split('\n');
    expect(禁读形态清单.some((形态) => 形态.模式.test(净行[0] ?? ''))).toBe(false);
    expect(禁读形态清单.some((形态) => 形态.模式.test(净行[1] ?? '')), '去注释不得把代码行一起豁免').toBe(true);
    expect(净行[1]).toContain('u."性别"');
  });
});
