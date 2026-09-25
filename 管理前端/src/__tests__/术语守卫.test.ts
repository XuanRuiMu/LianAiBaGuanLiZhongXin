import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { 文案 } from '../文案/聚合';
import { 术语, 禁用别名, 风格规约 } from '../术语';
import { 账号枚举文案 } from '../文案/账号枚举';
import { 审核枚举文案 } from '../文案/审核枚举';
import { 审计枚举文案 } from '../文案/审计枚举';
import { 封禁枚举文案 } from '../文案/封禁枚举';
import { 统计枚举文案 } from '../文案/统计枚举';
import { 聊天枚举文案 } from '../文案/聊天枚举';
import { 思考枚举文案 } from '../文案/思考枚举';
import { 列定义登记 } from '../列定义';

const 词典目录 = 'src/文案';
const 术语表源路径 = '../docs/术语表.md';
const 扫描目录 = ['src/views', 'src/components', 'src/router', 'src/stores', 'src/api', 'src/枚举映射'];
const 扫描文件 = ['src/App.vue', 'src/枚举映射.ts', 'src/列定义.ts'];
const 首屏可达文件 = ['src/App.vue', 'src/main.ts', 'src/router/index.ts', 'src/api/请求.ts', 'src/api/探针.ts', 'src/stores/登录.ts'];

function 读(路径: string): string {
  return fs.readFileSync(路径, 'utf8');
}

function 词典域文件(): string[] {
  return fs
    .readdirSync(词典目录)
    .filter((名) => 名.endsWith('.ts') && 名 !== '聚合.ts')
    .sort()
    .map((名) => `${词典目录}/${名}`);
}

const 词典文件清单 = 词典域文件();

const 枚举映射目录 = 'src/枚举映射';

function 枚举映射文件清单(): string[] {
  return fs
    .readdirSync(枚举映射目录)
    .filter((名) => 名.endsWith('.ts'))
    .sort()
    .map((名) => `${枚举映射目录}/${名}`);
}

function 枚举映射可达词典(起点: string): string[] {
  const 已访问 = new Set<string>();
  const 词典域 = new Set<string>();
  const 栈 = [起点];
  while (栈.length > 0) {
    const 当前 = 栈.pop() as string;
    if (已访问.has(当前)) {
      continue;
    }
    已访问.add(当前);
    for (const 匹配 of 读(当前).matchAll(/from '([^']+)'/g)) {
      const 指向 = 匹配[1];
      if (指向.startsWith('../文案/')) {
        词典域.add(指向.slice('../文案/'.length));
      } else if (指向.startsWith('../枚举映射/')) {
        栈.push(`src/${指向.slice(3)}`);
      } else if (指向.startsWith('./') && 当前.startsWith(`${枚举映射目录}/`)) {
        栈.push(`${枚举映射目录}/${指向.slice(2)}.ts`);
      }
    }
  }
  return [...词典域].sort();
}

function 收集源文件(): string[] {
  const 结果: string[] = [...扫描文件, ...词典文件清单];
  const 栈 = [...扫描目录];
  while (栈.length > 0) {
    const 当前 = 栈.pop() as string;
    let 状态: ReturnType<typeof fs.statSync>;
    try {
      状态 = fs.statSync(当前);
    } catch {
      continue;
    }
    if (状态.isDirectory()) {
      for (const 子 of fs.readdirSync(当前)) {
        栈.push(`${当前}/${子}`);
      }
    } else if (/\.(vue|ts)$/.test(当前)) {
      结果.push(当前);
    }
  }
  return 结果;
}

const 源文件清单 = 收集源文件();

function 全部源文本(): string {
  return 源文件清单.map((路径) => 去注释(读(路径))).join('\n');
}

function 去注释(文本: string): string {
  return 文本.replace(/<!--[\s\S]*?-->/g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
}

function 空白违例(条目列表: ReadonlyArray<{ 路径: string; 值: string }>): string[] {
  return 条目列表
    .filter((项) => typeof 项.值 !== 'string' || 项.值.trim().length === 0)
    .map((项) => `${项.路径} 为空串或纯空白`);
}

function 遍历词典值(词典: Record<string, unknown>): Array<{ 路径: string; 值: string }> {
  const 结果: Array<{ 路径: string; 值: string }> = [];
  for (const [分类, 子表] of Object.entries(词典)) {
    if (typeof 子表 !== 'object' || 子表 === null) {
      continue;
    }
    for (const [键, 值] of Object.entries(子表 as Record<string, unknown>)) {
      if (typeof 值 === 'string') {
        结果.push({ 路径: `${分类}.${键}`, 值 });
      }
    }
  }
  return 结果;
}

function 词典键名全集(): Set<string> {
  const 集合 = new Set<string>();
  for (const [分类, 子表] of Object.entries(文案)) {
    集合.add(分类);
    for (const 键 of Object.keys(子表 as Record<string, unknown>)) {
      集合.add(键);
    }
  }
  return 集合;
}

function 模板文本节点(源文本: string): string[] {
  const 命中 = /<template>([\s\S]*)<\/template>/.exec(源文本);
  const 模板 = 命中 ? 命中[1] : '';
  const 结果: string[] = [];
  for (const 匹配 of 模板.matchAll(/>([^<>]+)</g)) {
    const 文本 = 匹配[1].trim();
    if (文本.length === 0 || !/[一-鿿]/.test(文本) || 文本.includes('{{') || 文本.includes('}}')) {
      continue;
    }
    结果.push(文本);
  }
  return 结果;
}

const 渲染文本豁免: ReadonlyArray<{ 文件: string; 片段: string; 归属: string }> = [];

function 已豁免(文件: string, 片段: string): boolean {
  return 渲染文本豁免.some((项) => 项.文件 === 文件 && 片段.includes(项.片段));
}

interface 渲染文本 {
  来源: string;
  文本: string;
}

function 扫描渲染文本(条目列表: ReadonlyArray<渲染文本>, 禁用词: ReadonlyArray<string>): string[] {
  const 违例: string[] = [];
  for (const 条目 of 条目列表) {
    for (const 词 of 禁用词) {
      if (条目.文本.includes(词) && !已豁免(条目.来源, 词)) {
        违例.push(`${条目.来源} 命中禁用词「${词}」：${条目.文本}`);
      }
    }
  }
  return 违例;
}

function 键名命中(键清单: readonly string[]): string[] {
  const 违例: string[] = [];
  for (const 键 of 键清单) {
    for (const 词 of 别名清单) {
      if (整词命中(键, 词)) {
        违例.push(`键名 ${键} 命中旧称「${词}」`);
      }
    }
  }
  return 违例;
}

function 词典全部分类(): Array<keyof typeof 文案> {
  return Object.keys(文案) as Array<keyof typeof 文案>;
}

function 词典键名(分类: keyof typeof 文案): string[] {
  return Object.keys(文案[分类] as object);
}

function 词典渲染条目(): 渲染文本[] {
  return 遍历词典值(文案 as unknown as Record<string, unknown>).map((项) => ({
    来源: `文案.${项.路径}`,
    文本: 项.值,
  }));
}

function 术语渲染条目(): 渲染文本[] {
  return Object.entries(术语).map(([键, 值]) => ({ 来源: `术语.${键}`, 文本: 值 }));
}

function 模板渲染条目(): 渲染文本[] {
  const 结果: 渲染文本[] = [];
  for (const 文件 of 源文件清单) {
    if (!文件.endsWith('.vue')) {
      continue;
    }
    for (const 文本 of 模板文本节点(去注释(读(文件)))) {
      结果.push({ 来源: 文件.replace(/^src\//, ''), 文本 });
    }
  }
  return 结果;
}

const 别名清单: string[] = [
  ...new Set(Object.values(禁用别名).flat()),
].filter((项): 项 is string => typeof 项 === 'string');

const 已知词全集: string[] = [
  ...new Set([...Object.keys(术语), ...Object.values(术语), ...别名清单]),
];

function 出现位置(文本: string, 片段: string): number[] {
  const 位置: number[] = [];
  let 游标 = 文本.indexOf(片段);
  while (游标 >= 0) {
    位置.push(游标);
    游标 = 文本.indexOf(片段, 游标 + 1);
  }
  return 位置;
}

function 整词命中(键: string, 别名: string): boolean {
  return 出现位置(键, 别名).some((位) => !已知词全集.some(
    (词) => 词.length > 别名.length
      && 出现位置(键, 词).some((起) => 起 <= 位 && 位 + 别名.length <= 起 + 词.length),
  ));
}

function 解析术语表条目(): Map<string, { 显示名: string; 别名: string[] }> {
  const 结果 = new Map<string, { 显示名: string; 别名: string[] }>();
  let 在术语表内 = false;
  for (const 行 of 读(术语表源路径).split(/\r?\n/)) {
    if (行.trim().startsWith('|') && 行.includes('术语键')) {
      在术语表内 = true;
      continue;
    }
    if (!行.trim().startsWith('|')) {
      在术语表内 = false;
      continue;
    }
    if (!在术语表内) {
      continue;
    }
    const 单元 = 行.split('|').slice(1, -1).map((项) => 项.trim());
    if (单元.length < 4 || 单元[0] === '术语键' || /^-+$/.test(单元[0])) {
      continue;
    }
    const [键, 显示名, 别名列] = 单元;
    const 别名 = 别名列 === '—' || 别名列.length === 0 ? [] : 别名列.split('、');
    结果.set(键, { 显示名, 别名 });
  }
  return 结果;
}

function 校验术语表同步(文档条目: Map<string, { 显示名: string; 别名: string[] }>): string[] {
  const 违例: string[] = [];
  for (const [键, 值] of Object.entries(术语)) {
    const 条目 = 文档条目.get(键);
    if (!条目) {
      违例.push(`代码有术语「${键}」，术语表缺条目`);
      continue;
    }
    if (条目.显示名 !== 值) {
      违例.push(`术语「${键}」显示名不一致：代码「${值}」/ 术语表「${条目.显示名}」`);
    }
    const 代码别名 = [...(禁用别名[键 as keyof typeof 禁用别名] ?? [])].sort();
    const 文档别名 = [...条目.别名].sort();
    if (代码别名.join('|') !== 文档别名.join('|')) {
      违例.push(`术语「${键}」禁用别名不一致：代码[${代码别名.join(',')}] / 术语表[${文档别名.join(',')}]`);
    }
  }
  for (const 键 of 文档条目.keys()) {
    if (!(键 in 术语)) {
      违例.push(`术语表有条目「${键}」，代码 术语 常量里没有`);
    }
  }
  return 违例;
}

function 键名后缀档位(键: string): keyof typeof 风格规约.长度预算 {
  for (const [后缀, 档位] of Object.entries(风格规约.键名后缀预算)) {
    if (键.endsWith(后缀)) {
      return 档位 as keyof typeof 风格规约.长度预算;
    }
  }
  return '默认';
}

function 校验长度预算(条目列表: ReadonlyArray<{ 路径: string; 值: string }>): string[] {
  const 违例: string[] = [];
  for (const 条目 of 条目列表) {
    const 键 = 条目.路径.split('.').pop() as string;
    const 档位 = 键名后缀档位(键);
    const 上限 = 风格规约.长度预算[档位];
    if ([...条目.值].length > 上限) {
      违例.push(`${条目.路径} 超出${档位}预算 ${上限}：${条目.值}`);
    }
  }
  return 违例;
}

const 已登记拉丁: ReadonlySet<string> = new Set(
  [...Object.values(术语)].flatMap((值) => [...值.matchAll(/[A-Za-z][A-Za-z0-9_]*/g)].map((匹配) => 匹配[0])),
);

const 错误码形态 = /^[A-Z][A-Z0-9_]*[_][A-Z0-9_]*$|^[A-Z][A-Z0-9_]{3,}$/;

function 校验裸拉丁占位(条目列表: ReadonlyArray<{ 路径: string; 值: string }>): string[] {
  const 违例: string[] = [];
  for (const 条目 of 条目列表) {
    for (const 匹配 of 条目.值.matchAll(/[A-Za-z][A-Za-z0-9_]*/g)) {
      const 词元 = 匹配[0];
      if (已登记拉丁.has(词元) || 错误码形态.test(词元)) {
        continue;
      }
      违例.push(`${条目.路径} 含未登记的拉丁占位「${词元}」：${条目.值}`);
    }
  }
  return 违例;
}

function 校验排版(条目列表: ReadonlyArray<{ 路径: string; 值: string }>): string[] {
  const 违例: string[] = [];
  const 汉到英数 = /[一-鿿][A-Za-z0-9]/;
  const 英数到汉 = /[A-Za-z0-9][一-鿿]/;
  for (const 条目 of 条目列表) {
    if (汉到英数.test(条目.值) || 英数到汉.test(条目.值)) {
      违例.push(`${条目.路径} 中英数字之间缺半角空格：${条目.值}`);
    }
  }
  return 违例;
}

function 转义(文本: string): string {
  return 文本.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const 引用形态属性名 = '键|文案键|表头键|标签键|页签键';

function 引用形态(分类: string, 键: string): RegExp[] {
  const 类 = 转义(分类);
  const 名 = 转义(键);
  const 尾 = '(?![0-9A-Za-z_\\u4e00-\\u9fa5])';
  return [
    new RegExp(`(?:${类}文案|${类}页面文案|${类}枚举文案)\\['"${名}"'\\]`),
    new RegExp(`(?:${类}文案|${类}页面文案|${类}枚举文案)\\.${名}${尾}`),
    new RegExp(`文案\\.${类}\\.${名}${尾}`),
    new RegExp(`取文案\\(\\s*['"]${类}['"]\\s*,\\s*['"]${名}['"]\\s*\\)`),
    new RegExp(`\\[\\s*['"]${类}['"]\\s*,\\s*['"]${名}['"]\\s*\\]`),
    new RegExp(`(?:${引用形态属性名})\\s*:\\s*['"]${名}['"]`),
  ];
}

function 已引用(分类: string, 键: string, 语料: string): boolean {
  return 引用形态(分类, 键).some((形态) => 形态.test(语料));
}

function 校验引用完整(全部键: string[], 语料 = 全部源文本()): string[] {
  const 违例: string[] = [];
  for (const 项 of 全部键) {
    const [分类, 键] = 项.split('.');
    if (!已引用(分类, 键, 语料)) {
      违例.push(`死键 ${分类}.${键} 无任何引用`);
    }
  }
  return 违例;
}

function 校验单源(源文本: string): string[] {
  const 允许标识 = 词典键名全集();
  const 原子值 = new Set<string>(Object.values(术语));
  const 违例: string[] = [];
  for (const 匹配 of 去注释(源文本).matchAll(/'([^'\n]*)'|"([^"\n]*)"/g)) {
    const 字面量 = (匹配[1] ?? 匹配[2]) as string;
    if (!/[一-鿿]/.test(字面量) || 字面量.startsWith('./') || 字面量.startsWith('../')) {
      continue;
    }
    if (允许标识.has(字面量)) {
      continue;
    }
    if (原子值.has(字面量)) {
      违例.push(`词典手写了术语已登记的字面量「${字面量}」，必须改为引用 术语`);
    }
  }
  return 违例;
}

const 词典键路径 = Object.entries(文案).flatMap(([分类, 子表]) =>
  Object.keys(子表 as Record<string, unknown>).map((键) => `${分类}.${键}`),
);

const 枚举子表: Record<string, Readonly<Record<string, string>>> = {
  账号枚举文案,
  审核枚举文案,
  审计枚举文案,
  封禁枚举文案,
  统计枚举文案,
  聊天枚举文案,
  思考枚举文案,
};

const 枚举显示名清单: string[] = [
  ...new Set(Object.values(枚举子表).flatMap((子表) => Object.values(子表))),
];

const 显示名已知词: string[] = [
  ...new Set([
    ...Object.keys(术语),
    ...Object.values(术语),
    ...词典键名全集(),
    ...枚举显示名清单,
    ...Object.values(列定义登记 as unknown as Record<string, ReadonlyArray<{ 数据键: string | null }>>)
      .flat()
      .map((项) => 项.数据键)
      .filter((项): 项 is string => typeof 项 === 'string'),
    ...别名清单,
  ]),
];

function 内嵌显示名(文本: string): string[] {
  const 命中: string[] = [];
  for (const 词 of 枚举显示名清单) {
    if (词.length < 2) {
      continue;
    }
    for (const 位 of 出现位置(文本, 词)) {
      const 被覆盖 = 显示名已知词.some(
        (长) =>
          长.length > 词.length &&
          出现位置(文本, 长).some((起) => 起 <= 位 && 位 + 词.length <= 起 + 长.length),
      );
      if (!被覆盖) {
        命中.push(词);
      }
    }
  }
  return [...new Set(命中)];
}

function 扫描显示名内嵌(路径: string, 源 = 读(路径)): string[] {
  const 违例: string[] = [];
  for (const 匹配 of 去注释(源).matchAll(/^ {2}([^\s:]+): ('[^']*'|`[^`]*`|"[^"]*")/gm)) {
    const 原文 = 匹配[2].slice(1, -1);
    const 净文本 = 原文.replace(/\$\{[^}]*\}/g, '');
    const 命中 = 内嵌显示名(净文本);
    if (命中.length > 0) {
      违例.push(`${路径} 的 ${匹配[1]} 内嵌显示名「${命中.join('、')}」未走原子拼接：${原文}`);
    }
  }
  return 违例;
}

const 引用豁免清单: ReadonlyArray<{ 路径: string; 归属: string }> = [];

describe('FP-01 术语单源守卫', () => {
  it('术语表与 术语.ts 双向一致', () => {
    const 文档条目 = 解析术语表条目();
    expect(文档条目.size).toBeGreaterThan(0);
    expect(校验术语表同步(文档条目)).toEqual([]);
  });

  it('禁用别名全部指向已登记术语', () => {
    expect(Object.keys(禁用别名).filter((键) => !(键 in 术语))).toEqual([]);
    expect(别名清单.length).toBeGreaterThanOrEqual(15);
  });

  it('词典条目值与术语原子不出现任何禁用别名', () => {
    expect(扫描渲染文本([...词典渲染条目(), ...术语渲染条目()], 别名清单)).toEqual([]);
  });

  it('视图模板文本节点不出现禁用别名', () => {
    expect(源文件清单.filter((路径) => 路径.startsWith('src/views/')).length).toBeGreaterThanOrEqual(9);
    const 模板条目 = 模板渲染条目();
    expect(扫描渲染文本(模板条目, 别名清单)).toEqual([]);
  });

  it('词典键名不沿用旧称：全部分类键名扫描命中零', () => {
    const 分类清单 = 词典全部分类();
    const 键清单 = 分类清单.flatMap((分类) => 词典键名(分类));
    expect(分类清单).toHaveLength(10);
    expect(键清单.length).toBeGreaterThanOrEqual(260);
    expect(键名命中(键清单)).toEqual([]);
    expect(键清单.some((键) => 键.includes('夺舍'))).toBe(false);
    expect(词典键名('思考')).toContain('接管记录标签');
    expect(键清单).toEqual(expect.arrayContaining([
      '接管角色按钮',
      '结束接管按钮',
      '授予角色按钮',
      '回收角色按钮',
      '初审按钮',
      '复审按钮',
      '处理多项按钮',
      '处理多项成功',
    ]));
  });

  it('反证：旧称键名必须判红，整词边界不误伤已登记词', () => {
    expect(键名命中(['夺舍日志标签']).some((项) => 项.includes('命中旧称「夺舍日志」'))).toBe(true);
    expect(键名命中(['夺舍按钮']).some((项) => 项.includes('命中旧称「夺舍」'))).toBe(true);
    expect(键名命中(['接管记录标签', '记忆标签'])).toEqual([]);
    expect(键名命中(['账号编号列'])).not.toEqual([]);
    expect(键名命中(['授权按钮'])).not.toEqual([]);
    expect(键名命中(['一审按钮', '二审按钮', '批量按钮', '批量成功'])).toHaveLength(4);
    expect(键名命中(['严重度', '严重度列'])).toHaveLength(2);
    expect(键名命中(['严重程度', '严重程度轻微', '严重程度列'])).toEqual([]);
  });

  it('可见文本不叙述实现细节、不带括号填充', () => {
    const 禁用词 = [...风格规约.禁用叙述, ...风格规约.填充词];
    expect(扫描渲染文本([...词典渲染条目(), ...术语渲染条目()], 禁用词)).toEqual([]);
    expect(扫描渲染文本(模板渲染条目(), 禁用词)).toEqual([]);
  });

  it('词典域文件不重复手打术语原子', () => {
    expect(词典文件清单).toEqual(
      expect.arrayContaining(['通用', '导航', '登录', '账号', '聊天', '思考', '封禁', '审计', '统计', '审核'].map((分类) => `${词典目录}/${分类}.ts`)),
    );
    expect(词典文件清单.length).toBe(17);
    expect(词典文件清单.flatMap((路径) => 校验单源(读(路径)))).toEqual([]);
  });

  it('枚举与角色显示名在词典里只有原子一处，句子内嵌一律走模板拼接（V-08）', () => {
    expect(枚举显示名清单.length).toBeGreaterThanOrEqual(70);
    expect(枚举显示名清单).toEqual(
      expect.arrayContaining([账号枚举文案.角色超级管理员, '运营', '审核员', '通过', '结束接管', 思考枚举文案.事件深度思考]),
    );
    expect(枚举显示名清单).not.toContain('超管');
    expect(词典文件清单.flatMap((路径) => 扫描显示名内嵌(路径))).toEqual([]);
  });

  it('反证：内嵌显示名的手写字面量判红，原子拼接与更长登记词放行（V-08）', () => {
    expect(扫描显示名内嵌('样张.ts', "export const 样张文案 = {\n  提示: '当前角色无此权限，仅超级管理员可执行',\n} as const;\n")).not.toEqual([]);
    expect(扫描显示名内嵌('样张.ts', "export const 样张文案 = {\n  提示: `当前角色无此权限，仅${'超级管理员'}可执行`,\n} as const;\n")).toEqual([]);
    expect(扫描显示名内嵌('样张.ts', "export const 样张文案 = {\n  说明: '请填写用户编号',\n} as const;\n")).toEqual([]);
    expect(扫描显示名内嵌('样张.ts', "export const 样张文案 = {\n  说明: '结论为通过申诉',\n} as const;\n")).toEqual([]);
    expect(扫描显示名内嵌('样张.ts', "export const 样张文案 = {\n  说明: '用户编号与 IP 地址填写其中一项。',\n} as const;\n")).toEqual([]);
    expect(扫描显示名内嵌('样张.ts', "export const 样张文案 = {\n  说明: '结论为驳回',\n} as const;\n")).not.toEqual([]);
    expect(扫描显示名内嵌('样张.ts', "export const 样张文案 = {\n  说明: '状态名称备注',\n} as const;\n")).toEqual([]);
    expect(内嵌显示名('仅超级管理员可执行')).toEqual(['超级管理员']);
    expect(内嵌显示名('请填写用户编号或 IP 地址')).toEqual([]);
  });

  it('首屏可达文件只引 通用/导航 词典，枚举映射只引枚举子表，不得回潮引整域', () => {
    const 违例: string[] = [];
    const 取导入 = (路径: string) =>
      [...读(路径).matchAll(/import \{([^}]+)\} from '([^']*)'/g)].map((匹配) => ({
        名们: 匹配[1].split(',').map((项) => 项.trim()).filter((项) => 项.length > 0),
        指向: 匹配[2].replace(/^\.\.?\//, 'src/'),
      }));
    for (const 路径 of 首屏可达文件) {
      for (const 项 of 取导入(路径)) {
        if (项.指向 === 'src/文案/聚合.ts' || 项.指向 === 'src/术语.ts') {
          违例.push(`${路径} 引了聚合出口 ${项.指向}`);
        }
        const 域 = /^src\/文案\/(.+)\.ts$/.exec(项.指向)?.[1];
        if (域 !== undefined && 域 !== '通用' && 域 !== '导航') {
          违例.push(`${路径} 首屏引了 ${域} 域词典`);
        }
      }
    }
    for (const 路径 of 枚举映射文件清单()) {
      for (const 项 of 取导入(路径)) {
        const 文件 = /^src\/文案\/(.+)\.ts$/.exec(项.指向)?.[1];
        if (文件 === undefined) {
          continue;
        }
        for (const 名 of 项.名们) {
          if (名 !== `${文件}文案`) {
            违例.push(`${路径} 从 ${文件}.ts 引了 ${名}，只允许引该文件的 <文件>文案 对象`);
          }
        }
      }
    }
    expect(违例).toEqual([]);
    expect(首屏可达文件.length).toBeGreaterThanOrEqual(6);
    expect([...读('src/App.vue').matchAll(/from '([^']*枚举映射[^']*)'/g)].map((匹配) => 匹配[1])).toEqual([
      './枚举映射/管理角色',
    ]);
    expect(枚举映射可达词典('src/枚举映射/管理角色.ts')).toEqual(['账号枚举', '通用']);
  });

  it('枚举映射按族拆分：每族只承载自己的值域，族模块不回引聚合出口也不互相引用', () => {
    // 契约演进（FP-28a）：`性别` 族自 FP-28a 起承载 `用户.默认性别`（male/female）的显示口径。
    // 管理中心不再读 `用户.性别` 死列，故本清单新增该族文件；族数只增不减，禁读账本见 管理后端/tests/单元/死列账本.test.ts。
    expect(枚举映射文件清单().map((路径) => 路径.replace('src/枚举映射/', '')).sort()).toEqual(
      [
        '优先级.ts',
        '关系阶段.ts',
        '发送方.ts',
        '审核状态.ts',
        '审验结论.ts',
        '审计事件.ts',
        '审计分类.ts',
        '思考事件.ts',
        '性别.ts',
        '模型类型.ts',
        '消息类型.ts',
        '封禁级别.ts',
        '严重程度.ts',
        '管理角色.ts',
        '申诉状态.ts',
        '基础.ts',
      ].sort(),
    );
    const 族名集 = new Set(枚举映射文件清单().map((路径) => 路径.replace(/^src\/枚举映射\//, '').replace(/\.ts$/, '')));
    const 违例: string[] = [];
    for (const 路径 of 枚举映射文件清单()) {
      const 自身 = 路径.replace(/^src\/枚举映射\//, '').replace(/\.ts$/, '');
      for (const 指向 of [...读(路径).matchAll(/from '([^']+)'/g)].map((匹配) => 匹配[1])) {
        if (/枚举映射$/.test(指向)) {
          违例.push(`${自身}.ts 回引了聚合出口 ${指向}`);
        }
        const 兄弟 = /^\.\/(.+)\.ts$/.exec(指向)?.[1];
        if (兄弟 !== undefined && 兄弟 !== '基础' && 族名集.has(兄弟) && 兄弟 !== 自身) {
          违例.push(`${自身}.ts 引了兄弟族 ${兄弟}`);
        }
      }
    }
    expect(违例).toEqual([]);
    expect(读('src/枚举映射.ts')).toContain('export type 徽标族 =');
  });

  it('全域非空锁：任一术语原子与词典键值都不得为空串或纯空白', () => {
    const 原子空 = 空白违例(
      Object.entries(术语).map(([键, 值]) => ({ 路径: `术语.${键}`, 值 })),
    );
    const 词典空 = 空白违例(遍历词典值(文案 as unknown as Record<string, unknown>));
    const 别名空 = 空白违例(
      Object.entries(禁用别名).flatMap(([键, 清单]) =>
        (清单 as readonly string[]).map((项, 序号) => ({ 路径: `禁用别名.${键}[${序号}]`, 值: 项 })),
      ),
    );
    expect(原子空).toEqual([]);
    expect(词典空).toEqual([]);
    expect(别名空).toEqual([]);
    const 导航模块键 = ['账号管理', '聊天记录', '思考链', '封禁管理', '审计日志', '统计图表', '审核运营'] as const;
    expect(
      空白违例(导航模块键.map((键) => ({ 路径: `导航.${键}`, 值: 文案.导航[键] }))),
    ).toEqual([]);
    expect(Object.keys(术语).length).toBeGreaterThanOrEqual(197);
    expect(遍历词典值(文案 as unknown as Record<string, unknown>).length).toBeGreaterThanOrEqual(260);
  });

  it('反证：空串、纯空白与全角空格的原子/词典值必须被全域非空锁判红', () => {
    expect(空白违例([{ 路径: '样张.术语.空原子', 值: '' }])).toEqual(['样张.术语.空原子 为空串或纯空白']);
    expect(空白违例([{ 路径: '样张.文案.空白标签', 值: '   ' }, { 路径: '样张.文案.全角标签', 值: '　 ' }])).toEqual([
      '样张.文案.空白标签 为空串或纯空白',
      '样张.文案.全角标签 为空串或纯空白',
    ]);
    expect(空白违例([{ 路径: '样张.文案.正常标签', 值: '用户编号' }])).toEqual([]);
  });

  it('词典长度符合风格规约预算', () => {
    const 条目 = 遍历词典值(文案 as unknown as Record<string, unknown>);
    expect(条目.length).toBeGreaterThan(0);
    expect(校验长度预算(条目)).toEqual([]);
  });

  it('词典中英数字排版符合风格规约', () => {
    const 条目 = [
      ...遍历词典值(文案 as unknown as Record<string, unknown>),
      ...Object.entries(术语).map(([键, 值]) => ({ 路径: `术语.${键}`, 值 })),
    ];
    expect(校验排版(条目)).toEqual([]);
  });

  it('词典值不含悬空拉丁占位符，全库拉丁词元一律可追溯（S-01）', () => {
    const 条目 = [
      ...遍历词典值(文案 as unknown as Record<string, unknown>),
      ...Object.entries(术语).map(([键, 值]) => ({ 路径: `术语.${键}`, 值 })),
    ];
    expect(条目.length).toBeGreaterThanOrEqual(450);
    expect(校验裸拉丁占位(条目)).toEqual([]);
    expect(已登记拉丁.has('IP')).toBe(true);
  });

  it('反证：`近 N 天` 这类悬空单字母占位与自造缩写必须判红，错误码形态与已登记单位放行（S-01）', () => {
    expect(校验裸拉丁占位([{ 路径: '样张.天数标签', 值: '近 N 天' }])).toEqual([
      '样张.天数标签 含未登记的拉丁占位「N」：近 N 天',
    ]);
    expect(校验裸拉丁占位([{ 路径: '样张.说明', 值: '共 X 条，最多 NN 页' }]).map((项) => (项.match(/占位「(.+)」/)?.[1] ?? '')))
      .toEqual(['X', 'NN']);
    expect(校验裸拉丁占位([{ 路径: '样张.地址列', 值: 'IP 地址' }])).toEqual([]);
    expect(校验裸拉丁占位([{ 路径: '样张.提示', 值: '请求失败（WEI_ZHAO_DAO）' }])).toEqual([]);
    expect(校验裸拉丁占位([{ 路径: '样张.提示', 值: '统计天数' }])).toEqual([]);
    expect(文案.统计.天数标签).toBe('统计天数');
  });

  it('禁用别名覆盖角色旧缩写，一处原子改名即全域收口（S-03）', () => {
    expect(术语.超级管理员).toBe('超级管理员');
    expect(禁用别名.超级管理员).toEqual(['超管']);
    expect(账号枚举文案.角色超级管理员).toBe(术语.超级管理员);
    expect(扫描渲染文本([...词典渲染条目(), ...术语渲染条目(), ...模板渲染条目()], ['超管'])).toEqual([]);
    expect(键名命中(Object.keys(文案.账号))).toEqual([]);
    expect(键名命中(['角色超管'])).not.toEqual([]);
  });

  it('词典无死键（零豁免，全部键必须被引用）', () => {
    expect(引用豁免清单).toHaveLength(0);
    expect(词典键路径.length).toBeGreaterThan(0);
    expect(校验引用完整(词典键路径)).toEqual([]);
  });

  it('守卫豁免清单已归零', () => {
    expect(渲染文本豁免).toHaveLength(0);
    expect(引用豁免清单).toHaveLength(0);
  });

  it('反证：已知违规样张必须被判红', () => {
    const 夺舍旧称 = 禁用别名.接管角色?.[0] as string;
    const 实现词 = 风格规约.禁用叙述[0];
    const 填充词 = 风格规约.填充词[0];
    expect(夺舍旧称.length).toBeGreaterThan(0);
    expect(扫描渲染文本([{ 来源: '样张.账号.夺舍按钮', 文本: 夺舍旧称 }], 别名清单)).not.toEqual([]);
    expect(扫描渲染文本([{ 来源: '样张.账号.夺舍按钮', 文本: 夺舍旧称 }], 风格规约.禁用叙述)).toEqual([]);
    expect(
      扫描渲染文本([{ 来源: '样张.思考.实时推送提示', 文本: `回放以${实现词}记录为准` }], 风格规约.禁用叙述),
    ).not.toEqual([]);
    expect(
      扫描渲染文本([{ 来源: '样张.聊天.用户编号占位', 文本: `用户编号${填充词}` }], 风格规约.填充词),
    ).not.toEqual([]);
    expect(
      扫描渲染文本([{ 来源: '样张.账号.夺舍按钮', 文本: 夺舍旧称 }], [...风格规约.禁用叙述, ...风格规约.填充词]),
    ).toEqual([]);
    expect(校验长度预算([{ 路径: '样张.事件类型列', 值: '这是一个超过六个字的表格标题' }])).not.toEqual([]);
    expect(校验长度预算([{ 路径: '样张.用户列', 值: '用户编号' }])).toEqual([]);
    expect(校验排版([{ 路径: '样张.级别1天', 值: '封禁1天' }])).not.toEqual([]);
    expect(校验排版([{ 路径: '样张.级别1天', 值: '封禁 1 天' }])).toEqual([]);
    expect(校验单源("import { 术语 } from './术语';\nexport const 文案 = { 封禁: { 地址列: 'IP 地址' } } as const;\n")).not.toEqual([]);
    const 同步样张 = 解析术语表条目();
    同步样张.set('凭空术语', { 显示名: '凭空', 别名: [] });
    同步样张.delete('详情');
    const 同步结果 = 校验术语表同步(同步样张);
    expect(同步结果.some((项) => 项.includes('术语表有条目「凭空术语」'))).toBe(true);
    expect(同步结果.some((项) => 项.includes('代码有术语「详情」'))).toBe(true);
    expect(校验引用完整(['不存在分类.不存在键'])).not.toEqual([]);
    expect(校验引用完整([...词典键路径.slice(0, 5), '不存在分类.不存在键'])).toEqual([
      '死键 不存在分类.不存在键 无任何引用',
    ]);
    expect(校验引用完整(['账号.接管组说明', '审计.事件接管角色', '封禁.级别1分钟'])).toEqual([]);
    expect(校验引用完整(['账号.接管组说明缺'])).toEqual(['死键 账号.接管组说明缺 无任何引用']);
    expect(校验引用完整(['审计.事件接管角色缺'])).toEqual(['死键 审计.事件接管角色缺 无任何引用']);
    expect(校验引用完整(['账号.事件接管角色'])).toEqual(['死键 账号.事件接管角色 无任何引用']);
    expect(校验引用完整(['账号.接管组说明'], "// 注释里提到 接管组说明\nconst 说明 = '接管组说明';\n")).toEqual([
      '死键 账号.接管组说明 无任何引用',
    ]);
    expect(校验引用完整(['账号.接管组说明'], "export const 接管组说明 = 'x';\n")).toEqual([
      '死键 账号.接管组说明 无任何引用',
    ]);
    expect(校验引用完整(['通用.未记录'], "const 表: Record<string, string> = {};\nexport default 表['未记录'];\n")).toEqual([
      '死键 通用.未记录 无任何引用',
    ]);
    expect(校验引用完整(['账号.接管组说明'], "export const 标签列 = [{ 值: 'a', 键: '接管组说明' }];\n")).toEqual([]);
    expect(校验引用完整(['通用.未记录'], "import { 通用文案 } from '../文案/通用';\nexport default () => 通用文案.未记录;\n")).toEqual([]);
    expect(校验引用完整(['思考.摘要标签'], "export const 列 = 文本列('摘要', ['思考', '摘要标签']);\n")).toEqual([]);
    expect(校验引用完整(['登录.标题'], "export default 取文案('登录', '标题');\n")).toEqual([]);
    expect(校验引用完整(['导航.管理导航'], "export default 文案.导航.管理导航;\n")).toEqual([]);
  });

  it('枚举映射模块与词典分层保持不变', async () => {
    const 模块 = await import('../枚举映射');
    for (const 名 of ['取管理角色文案', '取封禁级别文案', '取申诉状态文案', '是正常封禁级别']) {
      expect(typeof (模块 as unknown as Record<string, unknown>)[名]).toBe('function');
    }
    expect(Array.isArray(模块.封禁级别选项)).toBe(true);
    expect(Array.isArray(模块.管理角色选项)).toBe(true);
    expect(模块.取封禁级别文案('wu_xiao_lei_xing')).toContain('未收录');
    expect(模块.取封禁级别文案('wu_xiao_lei_xing')).toContain('wu_xiao_lei_xing');
    expect(模块.取封禁级别文案(null)).toBe(模块.取封禁级别文案('zheng_chang'));
    expect(模块.是正常封禁级别(null)).toBe(true);
    expect(模块.是正常封禁级别('zheng_chang')).toBe(true);
    expect(模块.取封禁级别文案('feng_jin_1_tian')).toBe('封禁 1 天');
    expect(模块.取申诉状态文案('shen_su_zhong')).toBe('申诉中');
    expect(模块.取申诉状态文案('wei_zhi_zhuang_tai')).toContain('未收录');
  });
});
