import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { 错误注册表, 全部错误码, type 错误码键 } from '../../src/错误码';
import { 文案 } from '../../src/文案';
import { 错误码文档路径, duiQu全部错误码, 生成错误码文档 } from '../../scripts/错误码文档';

const 管理中心根 = path.resolve(__dirname, '..', '..', '..');
const 契约文档 = path.join(管理中心根, 'docs', '契约.md');
const 已提交文档 = fs.readFileSync(错误码文档路径, 'utf8');
const 归一 = (文本: string): string => 文本.replace(/\r\n/g, '\n');

interface 码行 {
  码: string;
  单元: string[];
}

function 查码行(文档: string): 码行[] {
  return 归一(文档)
    .split('\n')
    .filter((行) => /^\|[A-Z][A-Z0-9_]*\|/.test(行))
    .map((行) => ({ 码: 行.slice(1, 行.indexOf('|', 1)), 单元: 行.split('|').slice(1, -1) }));
}

function 收文案值(值: unknown, 累积: Set<string>): Set<string> {
  if (typeof 值 === 'string') {
    累积.add(值);
  } else if (Array.isArray(值)) {
    for (const 项 of 值) {
      收文案值(项, 累积);
    }
  } else if (值 !== null && typeof 值 === 'object') {
    for (const 项 of Object.values(值 as Record<string, unknown>)) {
      收文案值(项, 累积);
    }
  }
  return 累积;
}

const 敏感样本: ReadonlyArray<readonly [string, RegExp]> = [
  ['SQL 读语句', /\bSELECT\b/i],
  ['SQL 写语句', /\b(?:INSERT\s+INTO|UPDATE\s+\S+\s+SET|DELETE\s+FROM|DROP\s+TABLE|ALTER\s+TABLE)\b/i],
  ['SQL 状态码样例', /\b(?:42P01|42703|23505|08006|ECONNREFUSED)\b/],
  ['解释器堆栈', /Traceback \(most recent call last\)|\n\s+at\s+[\w.$]+ \(/],
  ['令牌原文', /eyJ[A-Za-z0-9_-]{8,}/],
  ['Bearer 凭证', /Bearer\s+[A-Za-z0-9._-]{8,}/],
  ['凭据键值', /(?:password|passwd|token|secret|api[_-]?key|authorization)\s*[:=]\s*\S/i],
  ['连接串', /(?:postgres|postgresql|redis|mysql):\/\//i],
  ['本机或容器路径', /[A-Za-z]:\\|\/(?:home|app|usr|var|etc)\//],
  ['环境变量取值', /process\.env\.[A-Z_]+/],
];

function 查违规(文档: string): string[] {
  const 违规: string[] = [];
  const 行 = 查码行(文档);
  if (行.length === 0) {
    违规.push('文档里解析不出任何码表行');
    return 违规;
  }
  const 文案值 = 收文案值(文案, new Set<string>());
  const 期望 = duiQu全部错误码();
  const 目标 = new Map<string, string[]>();
  for (const 项 of 期望) {
    目标.set(项.码, [
      项.码,
      `${项.键}（${项.状态}）`,
      项.文案列表.join('／'),
      项.可重试 ? '是' : '否',
      项.运行时动态 ? '文案真源＋运行时动态' : '文案真源',
    ]);
    if (项.文案列表.length === 0) {
      违规.push(`${项.码} 没有任何文案真源出口`);
    }
    for (const 值 of 项.文案列表) {
      if (!文案值.has(值)) {
        违规.push(`${项.码} 的文案不在文案真源里：${值}`);
      }
    }
  }
  const 已见 = new Map<string, number>();
  for (const 项 of 行) {
    已见.set(项.码, (已见.get(项.码) ?? 0) + 1);
    const 期望行 = 目标.get(项.码);
    if (期望行 === undefined) {
      违规.push(`未注册码 ${项.码}`);
      continue;
    }
    if (项.单元.join('|') !== 期望行.join('|')) {
      违规.push(`${项.码} 行与真源不一致：${项.单元.join('|')}`);
    }
  }
  for (const 码 of 目标.keys()) {
    const 次数 = 已见.get(码) ?? 0;
    if (次数 !== 1) {
      违规.push(`${码} 出现 ${次数} 行，必须恰好一行`);
    }
  }
  for (const [名, 表达式] of 敏感样本) {
    if (表达式.test(文档)) {
      违规.push(`出现敏感样例：${名}`);
    }
  }
  if (文档.includes('\uFFFD')) {
    违规.push('文档含替换字符 U+FFFD');
  }
  if (文档.charCodeAt(0) === 0xfeff) {
    违规.push('文档带 BOM');
  }
  return 违规;
}

function 查格式违规(文档: string): string[] {
  const 违规: string[] = [];
  const 行 = 归一(文档).split('\n');
  const 标题 = 行.filter((本行) => /^#{1,6} /.test(本行));
  if (new Set(标题).size !== 标题.length) {
    违规.push('存在内容完全相同的标题');
  }
  行.forEach((本行, 下标) => {
    if (!/^#{1,6} /.test(本行)) {
      return;
    }
    const 上 = 下标 > 0 ? 行[下标 - 1] : '';
    const 下 = 下标 < 行.length - 1 ? 行[下标 + 1] : '';
    if (上 !== '' || 下 !== '') {
      违规.push(`第 ${下标 + 1} 行标题未空行包围`);
    }
  });
  const 块类 = (本行: string): string => (本行.startsWith('|') ? '表格' : /^- /.test(本行) ? '列表' : '');
  let 下标 = 0;
  while (下标 < 行.length) {
    const 类 = 块类(行[下标]);
    if (类 === '') {
      下标 += 1;
      continue;
    }
    const 起 = 下标;
    while (下标 < 行.length && 块类(行[下标]) === 类) {
      下标 += 1;
    }
    const 止 = 下标 - 1;
    if ((起 > 0 && 行[起 - 1] !== '') || (止 < 行.length - 1 && 行[止 + 1] !== '')) {
      违规.push(`第 ${起 + 1} 至 ${止 + 1} 行${类}块未空行包围`);
    }
    if (类 === '表格') {
      if (!/^\|[-|]+\|$/.test(行[起 + 1] ?? '')) {
        违规.push(`第 ${起 + 2} 行表格缺 compact 分隔行`);
      }
      for (let 行号 = 起; 行号 <= 止; 行号 += 1) {
        if (/\|\s|\s\|/.test(行[行号])) {
          违规.push(`第 ${行号 + 1} 行表格不是 compact 管道风格`);
        }
      }
    }
  }
  for (const 匹配 of 归一(文档).matchAll(/```([^\n]*)\n([\s\S]*?)```/g)) {
    if (!/^[a-z]+$/.test(匹配[1])) {
      违规.push(`代码块未标语言：${匹配[1]}`);
    }
    if (匹配[2].trim() === '') {
      违规.push('代码块内容为空');
    }
  }
  return 违规;
}

function 查契约十五节(): Map<string, { 语义: string; 可重试: string }> {
  const 源 = fs.readFileSync(契约文档, 'utf8');
  const 起 = 源.indexOf('## 十五、');
  if (起 < 0) {
    throw new Error('docs/契约.md 缺「十五、管理端错误码表」，码无出处');
  }
  const 止 = 源.indexOf('\n### 前端', 起);
  const 表段 = 源.slice(起, 止 < 0 ? undefined : 止);
  const 表 = new Map<string, { 语义: string; 可重试: string }>();
  for (const 行 of 表段.split('\n')) {
    if (!/^\|\s*[A-Z][A-Z0-9_]+\s*\|/.test(行)) {
      continue;
    }
    const 单元 = 行.split('|').slice(1, -1).map((项) => 项.trim());
    表.set(单元[0], { 语义: 单元[1], 可重试: 单元[3] ?? '' });
  }
  return 表;
}

describe('管理端错误码大全与注册表、文案真源同源', () => {
  it('重新生成结果与已提交文档逐字一致', () => {
    expect(归一(已提交文档)).toBe(生成错误码文档());
  });

  it('每个注册码恰好一行且状态、可重试与文案真源逐条一致', () => {
    expect(查违规(已提交文档)).toEqual([]);
    expect(查码行(已提交文档)).toHaveLength(Object.keys(错误注册表).length);
  });

  it('注册码集合与 全部错误码 完全相等，无重复、遗漏与未注册码', () => {
    const 表内 = 查码行(已提交文档).map((项) => 项.码);
    expect([...表内].sort()).toEqual([...全部错误码].sort());
    expect(new Set(表内).size).toBe(表内.length);
  });

  it('每个码在源码里都有失败出口，且出口状态码与注册表一致', () => {
    const 出口 = duiQu全部错误码();
    for (const 项 of 出口) {
      expect(Object.hasOwn(错误注册表, 项.键 as 错误码键), `${项.键} 未注册`).toBe(true);
      expect(项.状态).toBe(错误注册表[项.键].状态码);
      expect(项.文案列表.length).toBeGreaterThan(0);
    }
    expect(出口.length).toBe(Object.keys(错误注册表).length);
  });

  it('docs/契约.md 十五节码表与本文件的码、状态、可重试逐条一致', () => {
    const 契约表 = 查契约十五节();
    const 本文件 = new Map(查码行(已提交文档).map((项) => [项.码, 项.单元]));
    expect([...契约表.keys()].sort()).toEqual([...本文件.keys()].sort());
    for (const [码, 契约行] of 契约表) {
      const 本行 = 本文件.get(码) as string[];
      const 定义 = 错误注册表[Object.keys(错误注册表).find((键) => 错误注册表[键 as 错误码键].code === 码) as 错误码键];
      expect(契约行.语义, `${码} 契约语义未含状态 ${定义.状态码}`).toContain(String(定义.状态码));
      expect(契约行.可重试, `${码} 契约可重试与注册表不一致`).toBe(定义.可重试 ? '是' : '否');
      expect(本行[3], `${码} 本文件可重试与注册表不一致`).toBe(定义.可重试 ? '是' : '否');
    }
  });

  it('文档不含 SQL、堆栈、连接串、环境变量取值与令牌等敏感样例', () => {
    for (const [名, 表达式] of 敏感样本) {
      expect(表达式.test(已提交文档), `文档出现敏感样例：${名}`).toBe(false);
    }
    expect([...归一(已提交文档).matchAll(/```[a-z]*\n([\s\S]*?)```/g)].map((匹配) => 匹配[1])).toEqual([
      'npx ts-node scripts/错误码文档.ts\n',
    ]);
  });

  it('Markdown 为 UTF-8 无 BOM、无替换字符，标题与表格符合格式守卫', () => {
    expect(已提交文档.charCodeAt(0)).not.toBe(0xfeff);
    expect(已提交文档).not.toContain('\uFFFD');
    expect(查格式违规(已提交文档)).toEqual([]);
  });

  it('分类按状态码归组且无空分类', () => {
    const 小节 = [...归一(已提交文档).matchAll(/^### (.+)$/gm)].map((匹配) => 匹配[1]);
    expect(小节).toEqual(['鉴权与访问控制', '业务与请求', '限频', '服务端与依赖']);
    for (const 分组 of 小节) {
      const 段 = 归一(已提交文档).split(`### ${分组}\n`)[1].split('\n### ')[0];
      expect(查码行(段).length, `${分组} 分类为空`).toBeGreaterThan(0);
    }
  });

  it('反证：漏行、改可重试、留未注册码与塞敏感样例都必须判红', () => {
    const 完整 = 生成错误码文档();
    const 首行 = 查码行(完整)[0];
    expect(查违规(完整)).toEqual([]);
    expect(查违规(完整.replace(首行.码, 'FIRST_ROW_PLACEHOLDER'))).toContain(
      `${首行.码} 出现 0 行，必须恰好一行`,
    );
    const 改正文 = 完整.replace(`|${首行.码}|${首行.单元[1]}|${首行.单元[2]}|${首行.单元[3]}|`, `|${首行.码}|${首行.单元[1]}|${首行.单元[2]}|${首行.单元[3] === '是' ? '否' : '是'}|`);
    expect(查违规(改正文).length).toBeGreaterThan(0);
    expect(查违规(完整.replace(/^# .*$/m, '# 恋爱吧管理中心 错误码大全\n\n|UNREGISTERED_CODE|未注册（404）|x|否|文案真源|'))).toContain(
      '未注册码 UNREGISTERED_CODE',
    );
    expect(查违规(`${完整}\nSELECT * FROM "用户"\n`)).toContain('出现敏感样例：SQL 读语句');
    expect(查违规('')).toEqual(['文档里解析不出任何码表行']);
  });
});
