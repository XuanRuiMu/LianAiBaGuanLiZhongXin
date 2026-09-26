import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { 创建隔离数据库池 } from '../测试数据库';

const 后端根 = path.resolve(__dirname, '..', '..');
const 思考源 = path.join(后端根, 'src', '路由', '思考.ts');
const 迁移根 = path.resolve(后端根, '..', '..', '和我恋爱吧', 'backend', 'database');
const 思考记录表 = '思考记录';
const 目标表名 = ['记忆', '对话摘要', '关键事件', '夺舍日志', '评估', 思考记录表];

function 读思考源(): string {
  if (!fs.existsSync(思考源)) {
    throw new Error(`后端源文件缺失，透传列清单核对无法执行：${思考源}`);
  }
  return fs.readFileSync(思考源, 'utf8');
}

function 拆列(清单: string): string[] {
  const 结果: string[] = [];
  for (const 段 of 清单.split(',')) {
    const 净 = 段.trim();
    const 命中 = /AS\s+"([^"]+)"$/.exec(净) ?? /"([^"]+)"$/.exec(净);
    if (命中 !== null) {
      结果.push(命中[1]);
    }
  }
  return 结果;
}

function 取透传绑定(源: string): Array<{ 表: string; 列常量: string }> {
  const 绑定 = [...源.matchAll(/'([^']+)',\s*([^\s,()']+透传列)/g)].map((匹配) => ({ 表: 匹配[1], 列常量: 匹配[2] }));
  if (绑定.length < 5) {
    throw new Error(`思考.ts 只解析出 ${绑定.length} 个透传页签，少于五个，真库核对无法判定`);
  }
  return 绑定;
}

function 取声明列(源: string, 声明: string): string[] {
  const 命中 = new RegExp(String.raw`const ${声明} =\s*'([^']+)'`).exec(源);
  if (命中 === null) {
    throw new Error(`思考.ts 里取不到常量 ${声明} 的列清单`);
  }
  const 列 = 拆列(命中[1]);
  if (列.length === 0) {
    throw new Error(`常量 ${声明} 解析出的列清单为空，真库核对无法执行`);
  }
  return 列;
}

function 剥行注释(文: string): string {
  return 文
    .split('\n')
    .map((行) => {
      const 位 = 行.indexOf('--');
      return 位 < 0 ? 行 : 行.slice(0, 位);
    })
    .join('\n');
}

function 找闭括号(文: string, 开: number): number {
  let 深 = 0;
  for (let 位 = 开; 位 < 文.length; 位 += 1) {
    if (文[位] === '(') {
      深 += 1;
    } else if (文[位] === ')') {
      深 -= 1;
      if (深 === 0) {
        return 位;
      }
    }
  }
  return -1;
}

function 按深度拆段(体: string): string[] {
  const 段: string[] = [];
  let 当前 = '';
  let 深 = 0;
  let 在引号内 = false;
  for (const 字 of 体) {
    if (字 === '"') {
      在引号内 = !在引号内;
    } else if (!在引号内 && 字 === '(') {
      深 += 1;
    } else if (!在引号内 && 字 === ')') {
      深 -= 1;
    }
    if (!在引号内 && 字 === ',' && 深 === 0) {
      段.push(当前);
      当前 = '';
      continue;
    }
    当前 += 字;
  }
  段.push(当前);
  return 段;
}

function 取引号串(文: string): string[] {
  return [...文.matchAll(/"([^"]+)"/g)].map((匹配) => 匹配[1]);
}

const 约束段 = /^(PRIMARY\s+KEY|UNIQUE|FOREIGN\s+KEY|CHECK|CONSTRAINT|EXCLUDE)\b/i;

const 语句正则 =
  /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?"[^"]+"\s*\(|ALTER\s+TABLE\s+"[^"]+"\s+ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?"[^"]+"|DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?"[^"]+"/gi;

function 取迁移文件(根: string): string[] {
  const 迁移目录 = path.join(根, 'migrations');
  if (!fs.existsSync(迁移目录)) {
    throw new Error(`生产迁移目录不存在，V-04 列出处对账无法执行：${迁移目录}`);
  }
  const 迁移 = fs
    .readdirSync(迁移目录)
    .filter((名) => 名.endsWith('.sql'))
    .sort();
  if (迁移.length === 0) {
    throw new Error(`迁移目录里没有任何 .sql 文件，V-04 列出处对账无法执行：${迁移目录}`);
  }
  if (!fs.existsSync(path.join(根, 'init.sql'))) {
    throw new Error(`基线建表脚本缺失，V-04 列出处对账无法执行：${path.join(根, 'init.sql')}`);
  }
  return ['init.sql', ...迁移.map((名) => path.join('migrations', 名))];
}

function 解析迁移列(根: string = 迁移根): Map<string, string[]> {
  const 集合 = new Map<string, string[]>();
  const 并入 = (表: string, 列: string): void => {
    const 现有 = 集合.get(表) ?? [];
    if (!现有.includes(列)) {
      集合.set(表, [...现有, 列]);
    }
  };
  for (const 相对 of 取迁移文件(根)) {
    const 文 = 剥行注释(fs.readFileSync(path.join(根, 相对), 'utf8'));
    for (const 匹配 of 文.matchAll(语句正则)) {
      const 句子 = 匹配[0];
      const 名字 = 取引号串(句子);
      if (/^CREATE\s+TABLE/i.test(句子)) {
        const 表 = 名字[0];
        const 开 = 匹配.index + 句子.length - 1;
        const 闭 = 找闭括号(文, 开);
        if (闭 < 0) {
          throw new Error(`${相对} 里 ${表} 的建表语句括号不闭合，列集合解析不出来`);
        }
        for (const 段 of 按深度拆段(文.slice(开 + 1, 闭))) {
          const 净 = 段.trim();
          if (净.length === 0 || 约束段.test(净)) {
            continue;
          }
          const 列 = /^"([^"]+)"/.exec(净);
          if (列 !== null) {
            并入(表, 列[1]);
          }
        }
      } else if (/^ALTER\s+TABLE/i.test(句子)) {
        并入(名字[0], 名字[1]);
      } else {
        集合.delete(名字[0]);
      }
    }
  }
  return 集合;
}

function 按括号拆列(清单: string): string[] {
  const 列: string[] = [];
  for (const 段 of 按深度拆段(清单)) {
    const 净 = 段.trim();
    if (净.length === 0) {
      continue;
    }
    const 命中 = /AS\s+"([^"]+)"$/.exec(净) ?? /"([^"]+)"$/.exec(净);
    if (命中 === null) {
      throw new Error(`列片段解析不出列名：${净}`);
    }
    列.push(命中[1]);
  }
  if (列.length === 0) {
    throw new Error('解析出的列清单为空，V-04 对账无法执行');
  }
  return 列;
}

function 取思考记录声明列(源: string): string[] {
  const 候选 = [...源.matchAll(/SELECT([^;]*?)FROM "思考记录"/g)]
    .map((匹配) => 匹配[1])
    .filter((清单) => !清单.trim().startsWith('COUNT(') && 清单.includes('"摘要"'));
  if (候选.length === 0) {
    throw new Error('思考.ts 里取不到 思考记录 的显式列表列清单，V-04 对账无法执行');
  }
  return 按括号拆列(候选[候选.length - 1]);
}

type 登记表 = Readonly<Record<string, Readonly<Record<string, string>>>>;

const 派生列登记: 登记表 = {
  思考记录: {
    摘要:
      '列表查询写作 LEFT("内容", 200) AS "摘要"（见 思考.ts 的 si-kao-ji-lu 列清单），是从正文截断派生的表达式别名，思考记录 表本身没有 摘要 列（物理列见 018_思考记录.sql:17 的 内容）',
  },
};

const 未上屏登记: 登记表 = {
  思考记录: {
    内容:
      '正文整列不进列表快照（管理前端 列定义.ts 的 思考记录 未登记 内容 数据键，术语表八、14 禁未登记键上屏），只以派生列 摘要 上屏，原文由 /si-kao-ji-lu/:记_录_ID 详情接口单条取（018_思考记录.sql:17）',
  },
};

function 登记项(登记: 登记表, 表: string): Readonly<Record<string, string>> {
  return 登记[表] ?? {};
}

function 校验登记(登记: 登记表, 名称: string): void {
  const 条目 = Object.entries(登记).flatMap(([表, 项]) =>
    Object.entries(项).map(([列, 理由]) => ({ 表, 列, 理由 })),
  );
  if (条目.length === 0) {
    throw new Error(`${名称} 为空 = 没做过逐列对账，禁止用空登记把差异全放行`);
  }
  for (const 项 of 条目) {
    if (项.理由.trim().length === 0) {
      throw new Error(`${名称} 的 ${项.表}.${项.列} 没写理由，登记不成立`);
    }
  }
}

function 对账列(
  表: string,
  声明: readonly string[],
  迁移: readonly string[],
  派生: Readonly<Record<string, string>>,
  未上屏: Readonly<Record<string, string>>,
): string[] {
  if (声明.length === 0) {
    throw new Error(`表 ${表} 的声明列解析为空，V-04 对账无法执行`);
  }
  if (迁移.length === 0) {
    throw new Error(`生产迁移 SQL 里解析不出表 ${表} 的任何列，V-04 禁止"解析不到就通过"`);
  }
  const 违例: string[] = [];
  for (const 列 of 声明) {
    if (!迁移.includes(列) && !(列 in 派生)) {
      违例.push(`${表}：声明列 ${列} 在迁移 SQL 里找不到出处，也不是登记的派生列`);
    }
  }
  for (const 列 of 迁移) {
    if (!声明.includes(列) && !(列 in 未上屏)) {
      违例.push(`${表}：迁移列 ${列} 既没进声明列清单也没登记为未上屏，属未对账的新增列`);
    }
  }
  for (const 列 of Object.keys(派生)) {
    if (迁移.includes(列)) {
      违例.push(`${表}：派生列登记里的 ${列} 如今能在迁移 SQL 里找到出处，登记该删`);
    }
  }
  for (const 列 of Object.keys(未上屏)) {
    if (声明.includes(列)) {
      违例.push(`${表}：未上屏登记里的 ${列} 如今已在声明列清单里，登记该删`);
    }
  }
  return 违例;
}


describe('FP-11 透传列清单与真实库模式双向一致', () => {
  it('五个透传页签的显式列清单等于 information_schema 的实际列集合', async () => {
    const 池 = await 创建隔离数据库池();
    const 源 = 读思考源();
    try {
      for (const 项 of 取透传绑定(源)) {
        const 声明 = 取声明列(源, 项.列常量);
        const 结果 = await 池.query(
          'SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = $1 ORDER BY ordinal_position',
          [项.表],
        );
        const 实际 = 结果.rows.map((行) => String(行['column_name']));
        expect(实际.length, `真实库里读不到表 ${项.表} 的列，显式列清单没有出处`).toBeGreaterThan(0);
        expect([...声明].sort(), `表 ${项.表} 的显式列清单与真实库列集合不一致`).toEqual([...实际].sort());
      }
    } finally {
      await 池.end().catch(() => undefined);
    }
  }, 20000);

  it('五个透传页签与 思考记录 的声明列全部能在生产迁移 SQL 里找到出处，且迁移列不得有未登记的新增（V-04）', () => {
    校验登记(派生列登记, '派生列登记');
    校验登记(未上屏登记, '未上屏登记');
    const 源 = 读思考源();
    const 迁移 = 解析迁移列();
    const 目标表: Array<{ 表: string; 声明: string[] }> = [
      ...取透传绑定(源).map((项) => ({ 表: 项.表, 声明: 取声明列(源, 项.列常量) })),
      { 表: 思考记录表, 声明: 取思考记录声明列(源) },
    ];
    expect(目标表.map((项) => 项.表).sort(), 'V-04 对账必须正好覆盖五个透传页签与 思考记录').toEqual(
      [...目标表名].sort(),
    );
    const 违例: string[] = [];
    for (const 项 of 目标表) {
      违例.push(
        ...对账列(项.表, 项.声明, 迁移.get(项.表) ?? [], 登记项(派生列登记, 项.表), 登记项(未上屏登记, 项.表)),
      );
    }
    expect(违例).toEqual([]);
    const 脏列 = [...迁移].flatMap(([表, 列]) => 列.filter((名) => /[()]/.test(名)).map((名) => `${表}.${名}`));
    expect(脏列, '迁移解析把带函数调用或表级约束的片段错当列名').toEqual([]);
    const 旧记忆列 = ['关键词', '摘要', '过期时间', '事件类型'];
    expect(
      (迁移.get('记忆') ?? []).filter((名) => 旧记忆列.includes(名)),
      '记忆 仍带着 006 已删除、007 未重建的 init 旧列，DROP TABLE 没被解析器认账',
    ).toEqual([]);
  });

  it('反证：无出处的声明列、未登记的迁移新增列、失效登记与零列解析都必须判红（V-04）', () => {
    const 源 = 读思考源();
    const 迁移 = 解析迁移列();
    const 思考记录声明 = 取思考记录声明列(源);
    const 思考记录列 = 迁移.get(思考记录表) ?? [];
    const 记忆声明 = 取声明列(源, '记忆透传列');
    const 记忆列 = 迁移.get('记忆') ?? [];

    const 无出处 = 对账列(
      思考记录表,
      [...思考记录声明, '根本不存在的列'],
      思考记录列,
      登记项(派生列登记, 思考记录表),
      登记项(未上屏登记, 思考记录表),
    );
    expect(无出处).toHaveLength(1);
    expect(无出处[0]).toContain('根本不存在的列');

    const 未登记新增 = 对账列(
      思考记录表,
      思考记录声明,
      [...思考记录列, '悄悄加的列'],
      登记项(派生列登记, 思考记录表),
      登记项(未上屏登记, 思考记录表),
    );
    expect(未登记新增).toHaveLength(1);
    expect(未登记新增[0]).toContain('悄悄加的列');

    expect(() => 对账列('夺舍日志', ['ID'], [], {}, {})).toThrow('解析不出表 夺舍日志 的任何列');
    expect(() => 解析迁移列(path.join(迁移根, '不存在'))).toThrow('生产迁移目录不存在');

    const 派生已失效 = 对账列('记忆', 记忆声明, 记忆列, { 内容: '样张：内容本就有物理列' }, {});
    expect(派生已失效).toHaveLength(1);
    expect(派生已失效[0]).toContain('登记该删');
    const 未上屏已失效 = 对账列('记忆', 记忆声明, 记忆列, {}, { 内容: '样张：内容已上屏' });
    expect(未上屏已失效).toHaveLength(1);
    expect(未上屏已失效[0]).toContain('登记该删');

    expect(() => 校验登记({}, '派生列登记')).toThrow('为空 = 没做过逐列对账');
    expect(() => 校验登记({ 记忆: { 某列: '   ' } }, '未上屏登记')).toThrow('没写理由，登记不成立');
  });

  it('反证：解析不到透传页签与解析不出列名都必须抛错', () => {
    expect(() => 取透传绑定("const 思考查询 = '占位';")).toThrow('只解析出 0 个透传页签');
    expect(() => 取声明列("const 甲透传列 = '\"ID\"';", '乙透传列')).toThrow('取不到常量 乙透传列 的列清单');
    expect(() => 取声明列("const 甲透传列 = 'ID';", '甲透传列')).toThrow('解析出的列清单为空');
  });
});
