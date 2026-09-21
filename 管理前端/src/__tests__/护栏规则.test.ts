import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { Linter } from 'eslint';
import vueParser from 'vue-eslint-parser';
import tsParser from '@typescript-eslint/parser';
import config, { 单源守卫插件, 词典坐标 } from '../../eslint.config.mjs';
import { 文案 } from '../文案/聚合';
import { 列定义登记 } from '../列定义';

const 守卫 = new Linter({ configType: 'flat' });

type 样张配置 = {
  files: string[];
  plugins: object;
  languageOptions: object;
  rules: object;
};

const 脚本配置: 样张配置 = {
  files: ['**/*.ts'],
  plugins: { local: 单源守卫插件 },
  languageOptions: { parser: tsParser, ecmaVersion: 'latest', sourceType: 'module' },
  rules: {
    'local/no-visible-cn-literal': 'error',
    'local/no-data-key-literal': 'error',
  },
};

const 模板配置: 样张配置 = {
  files: ['**/*.vue'],
  plugins: { local: 单源守卫插件 },
  languageOptions: { parser: vueParser, parserOptions: { parser: tsParser, ecmaVersion: 'latest', sourceType: 'module' } },
  rules: 脚本配置.rules,
};

function 报错(代码: string, 文件: string, 配置: 样张配置): string[] {
  return 守卫.verify(代码, [配置 as unknown as Linter.Config], 文件).map((项) => `${项.ruleId}@${项.line}`);
}

function 中文错(代码: string, 文件 = '样张.ts'): string[] {
  return 报错(代码, 文件, 文件.endsWith('.vue') ? 模板配置 : 脚本配置).filter((项) => 项.startsWith('local/no-visible-cn-literal'));
}

function 键错(代码: string, 文件 = '样张.ts'): string[] {
  return 报错(代码, 文件, 文件.endsWith('.vue') ? 模板配置 : 脚本配置).filter((项) => 项.startsWith('local/no-data-key-literal'));
}

describe('FP-08 内联 eslint 规则：no-visible-cn-literal', () => {
  it('违规样张：脚本里的裸中文字面量与可见属性必须判红', () => {
    expect(中文错("const 标题 = '账号总览';\nexport default 标题;\n")).toEqual(['local/no-visible-cn-literal@1']);
    expect(中文错("export const 键表 = { a: '总数' };\n")).toEqual(['local/no-visible-cn-literal@1']);
    expect(中文错('<template><p>正在加载全部数据</p></template>', '样张.vue')).toEqual(['local/no-visible-cn-literal@1']);
    expect(中文错('<template><input placeholder="请输入昵称"></template>', '样张.vue')).toEqual(['local/no-visible-cn-literal@1']);
    expect(中文错('<template><p>{{ \'确认删除\' }}</p></template>', '样张.vue')).toEqual(['local/no-visible-cn-literal@1']);
  });

  it('合规样张：词典坐标、模块路径、类型字面量与 class 钩子不得误报', () => {
    expect(中文错("import { 取文案 } from '../文案/聚合';\nexport default { render: () => 取文案('账号', '接管角色按钮') };\n")).toEqual([]);
    expect(中文错('<template><div class="页眉说明">{{ 取文案(\'通用\', \'详情\') }}</div></template>', '样张.vue')).toEqual([]);
    expect(中文错('<template><div :class="[\'气泡\', 方位]"></div></template>', '样张.vue')).toEqual([]);
    expect(中文错('type 方位名 = \'左\' | \'右\';\nexport const 取: (位: 方位名) => 位 = (位) => 位;\n')).toEqual([]);
    expect(中文错("const 表 = { 图标名: '警示', 文案键: '账号管理' };\nexport default 表;\n")).toEqual([]);
    expect(中文错("export function 拆(文本: string): string[] {\n  return 文本.split(/[,，\\s]+/);\n}\n")).toEqual([]);
  });

  it('反证：词典坐标词写在文本插值/静态 class/比较与赋值位一律判红（V-01）', () => {
    expect(中文错("<template><p>{{ '昵称' }}</p></template>", '样张.vue')).toEqual(['local/no-visible-cn-literal@1']);
    expect(中文错('<template><p class="高危">x</p></template>', '样张.vue')).toEqual(['local/no-visible-cn-literal@1']);
    expect(中文错('<template><p class="徽标 高危">x</p></template>', '样张.vue')).toEqual(['local/no-visible-cn-literal@1']);
    expect(中文错('<template><p class="徽标">x</p></template>', '样张.vue')).toEqual([]);
    expect(中文错("<template><p v-if=\"角色 === '超级管理员'\">x</p></template>", '样张.vue')).toEqual(['local/no-visible-cn-literal@1']);
    expect(中文错("const 角色 = '超级管理员';\nexport default 角色 === '超级管理员' ? 1 : 0;\n")).toEqual([
      'local/no-visible-cn-literal@1',
      'local/no-visible-cn-literal@2',
    ]);
    expect(中文错("const 提示 = 通用文案.请求失败;\nexport default 提示;\n")).toEqual([]);
  });

  it('反证：只有键位才放行坐标词，取文案/列构造/显式登记/成员访问四形仍合规', () => {
    expect(中文错("export default { render: () => 取文案('账号', '昵称') };\n")).toEqual([]);
    expect(中文错("export const 列 = 取列映射('思考记录');\n")).toEqual([]);
    expect(中文错("export const 列 = 建列('昵称', ['账号', '昵称']);\n")).toEqual([]);
    expect(中文错("export const 列 = 文本列('昵称', ['账号', '昵称']);\n")).toEqual([]);
    expect(中文错("export const 标签列 = [{ 值: 'si-kao', 键: '思考记录标签' }];\n")).toEqual([]);
    expect(中文错("import { 账号文案 } from '../文案/账号';\nexport default () => 账号文案['昵称'];\n")).toEqual([]);
    expect(中文错("export const 表 = { 昵称: 1 };\n")).toEqual([]);
    expect(中文错("import { 账号文案 } from '../文案/账号';\nexport const 键 = 账号文案.不存在的键;\n")).toEqual([]);
    expect(中文错("export const 表 = { 说明: '昵称' };\n")).toEqual(['local/no-visible-cn-literal@1']);
    expect(中文错("export const 表 = { 键: '不存在的键名' };\n")).toEqual(['local/no-visible-cn-literal@1']);
  });

  it('词典坐标白名单实读 src/文案 目录，既不缩水也不越界', () => {
    const 枚举映射源 = fs.readFileSync('src/枚举映射.ts', 'utf8');
    const 族名集 = new Set([...(/export type 徽标族 =([\s\S]*?);/.exec(枚举映射源)?.[1] ?? '').matchAll(/'([^']+)'/g)].map((匹配) => 匹配[1]));
    const 分类集 = new Set(Object.keys(文案));
    const 键名集 = new Set(Object.values(文案).flatMap((子表) => Object.keys(子表 as Record<string, unknown>)));
    const 表名集 = new Set(Object.keys(列定义登记));
    const 越界 = [...词典坐标].filter((项) => !分类集.has(项) && !键名集.has(项) && !表名集.has(项) && !族名集.has(项));
    const 缩水 = [...分类集, ...键名集].filter((项) => !词典坐标.has(项));
    expect(越界).toEqual([]);
    expect(缩水).toEqual([]);
    expect(分类集.size).toBe(10);
    expect(键名集.size).toBeGreaterThanOrEqual(180);
  });

  it('全 src 不存在行内 eslint 豁免注释，豁免只允许来自词典白名单', () => {
    const 命中: string[] = [];
    for (const 目录 of ['src/views', 'src/components', 'src/router', 'src/stores', 'src/api', 'src/__tests__']) {
      for (const 名 of fs.readdirSync(目录)) {
        const 路径 = `${目录}/${名}`;
        if (/eslint[-]disable/.test(fs.readFileSync(路径, 'utf8'))) {
          命中.push(路径);
        }
      }
    }
    for (const 路径 of ['src/App.vue', 'src/main.ts']) {
      if (/eslint[-]disable/.test(fs.readFileSync(路径, 'utf8'))) {
        命中.push(路径);
      }
    }
    expect(命中).toEqual([]);
  });
});

describe('FP-08 内联 eslint 规则：no-data-key-literal', () => {
  it('违规样张：自写数据键下标与取列助手实参必须判红', () => {
    expect(键错("export function 主键(行: Record<string, unknown>): unknown {\n  return 行['ID'];\n}\n")).toEqual(['local/no-data-key-literal@2']);
    expect(键错("export function 分(行: Record<string, unknown>): unknown {\n  return 取分数(行, '平均分');\n}\n")).toEqual(['local/no-data-key-literal@2']);
    expect(键错("export function 数(行: Record<string, unknown>): unknown {\n  return 取数值(行, '数量');\n}\n")).toEqual(['local/no-data-key-literal@2']);
    expect(键错('<template><p>{{ 行[\'用户ID\'] }}</p></template>', '样张.vue')).toEqual(['local/no-data-key-literal@1']);
  });

  it('合规样张：经 列定义.ts 导出的列对象取值不得误报', () => {
    expect(键错("import { 单元格原值, 取列映射 } from '../列定义';\nconst 列 = 取列映射('账号列表');\nexport default (行: object) => 单元格原值(列.ID, 行);\n")).toEqual([]);
    expect(键错('const 表: Record<string, unknown> = {};\nexport default () => 表.ID;\n')).toEqual([]);
  });
});

describe('FP-08 eslint.config.mjs 接线', () => {
  it('两条规则都在扁平配置里以 error 启用，且作用域覆盖入口与视图', () => {
    const 护栏块 = (config as unknown as Array<{ files?: string[]; plugins?: Record<string, unknown>; rules?: Record<string, string> }>).find(
      (项) => 项.rules?.['local/no-visible-cn-literal'] !== undefined,
    );
    expect(护栏块).toBeDefined();
    expect(护栏块?.rules?.['local/no-visible-cn-literal']).toBe('error');
    expect(护栏块?.rules?.['local/no-data-key-literal']).toBe('error');
    expect(护栏块?.files).toEqual(
      expect.arrayContaining(['src/views/**/*.vue', 'src/components/**/*.vue', 'src/App.vue', 'src/main.ts', 'src/api/**/*.ts', 'src/router/**/*.ts', 'src/stores/**/*.ts']),
    );
    expect(Object.keys(护栏块?.plugins ?? {})).toEqual(['local']);
  });

  it('规则确实注册在插件里，不是空配', () => {
    expect(Object.keys(单源守卫插件.rules).sort()).toEqual(['no-data-key-literal', 'no-visible-cn-literal']);
  });
});
