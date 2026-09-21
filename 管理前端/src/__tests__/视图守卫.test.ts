import { beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';
import { flushPromises, mount } from '@vue/test-utils';
import { 文案, 取文案 } from '../文案/聚合';
import {
  严重程度默认,
  封禁级别默认,
  审核状态选项,
  审计事件选项,
  审计分类选项,
  思考事件选项,
} from '../枚举映射';
import { 通用文案 } from '../文案/通用';
import { 单元格文本, 列定义登记, 表头文本, type 列, type 表名 } from '../列定义';
import { 业务错误, 取错误展示, 归一请求错误, 解析包络 } from '../api/请求';
import { 使用登录仓库 } from '../stores/登录';
import { 路由表 } from '../router';
import XiaoXiTiao from '../components/XiaoXiTiao.vue';

const 装饰文字 = [
  '执印',
  '六部卷宗',
  '一印通行',
  '壹',
  '贰',
  '叁',
  '恋管',
  '读写分离',
  '直连同库',
  '落库回放',
];

const 落地视图清单 = [
  'src/views/登录页.vue',
  'src/views/账号列表.vue',
  'src/views/账号详情.vue',
  'src/views/聊天记录.vue',
  'src/views/思考链.vue',
  'src/views/封禁管理.vue',
  'src/views/审计日志.vue',
  'src/views/统计图表.vue',
  'src/views/审核运营.vue',
];

const FP05视图清单 = ['src/views/聊天记录.vue', 'src/views/思考链.vue', 'src/views/封禁管理.vue'];

const FP06视图清单 = ['src/views/审计日志.vue', 'src/views/统计图表.vue', 'src/views/审核运营.vue'];

const 思考说明渲染字段 = ['sheng_ming', 'shi_shi_shuo_ming', 'dai_bu_chong'];

function 读(路径: string): string {
  return fs.readFileSync(路径, 'utf8');
}

function 词典文本(分类: string, 键: string): string {
  const 子表 = (文案 as unknown as Record<string, Record<string, string>>)[分类];
  return 子表?.[键] ?? '';
}

function 模板段(源: string): string {
  const 命中 = /<template>([\s\S]*)<\/template>/.exec(源);
  return 命中 ? 命中[1] : '';
}

function 去插值(文本: string): string {
  return 文本.replace(/\{\{[\s\S]*?\}\}/g, '');
}

const 中文字形 = new RegExp('[\\u4e00-\\u9fff\\u3000-\\u303f\\uff00-\\uffef]');

const 引用源 = String.raw`取文案\(\s*'([^']+)'\s*,\s*'([^']+)'\s*\)|([\u4e00-\u9fa5]+)文案\.([\u4e00-\u9fa50-9A-Za-z_]+)`;
function 引用正则(标志 = ''): RegExp {
  return new RegExp(引用源, 标志);
}
function 引用坐标(匹配: RegExpMatchArray | null): [string, string] | null {
  if (匹配 === null) {
    return null;
  }
  return 匹配[1] === undefined ? [匹配[3], 匹配[4]] : [匹配[1], 匹配[2]];
}
function 引用清单(文本: string): Array<[string, string]> {
  return [...文本.matchAll(引用正则('g'))].map((匹配) => 引用坐标(匹配) as [string, string]);
}

function 含中文(文本: string): boolean {
  return 中文字形.test(文本);
}

function 扫描可见字面量(源: string): string[] {
  const 原始 = 模板段(源).replace(/<!--[\s\S]*?-->/g, '');
  const 模板 = 去插值(原始);
  const 违例: string[] = [];
  for (const 匹配 of 原始.matchAll(/\{\{([^{}]+)\}\}/g)) {
    const 表 = 匹配[1].trim();
    if (/^(['"])[^'"]+\1$/.test(表) && 含中文(表)) {
      违例.push(`插值裸字面量「${表}」`);
    }
  }
  for (const 匹配 of 原始.matchAll(/\sv-(?:if|else-if|show)="([^"]*)"/g)) {
    for (const 串 of 匹配[1].matchAll(/(['"])([^'"]+)\1/g)) {
      if (含中文(串[2])) {
        违例.push(`条件表达式裸字面量「${串[2]}」`);
      }
    }
  }
  for (const 匹配 of 模板.matchAll(/>([^<>]+)</g)) {
    const 文本 = 匹配[1].trim();
    if (文本.length > 0 && 含中文(文本)) {
      违例.push(`裸文本节点「${文本}」`);
    }
  }
  for (const 匹配 of 模板.matchAll(/\s(placeholder|title|aria-label|alt|value)="([^"]*)"/g)) {
    if (含中文(匹配[2])) {
      违例.push(`裸属性 ${匹配[1]}="${匹配[2]}"`);
    }
  }
  return 违例;
}

function 扫描标签来源(源: string): string[] {
  const 违例: string[] = [];
  for (const 匹配 of 模板段(源).matchAll(/<label[\s\S]*?<\/label>/g)) {
    const 块 = 匹配[0];
    const 输入起点 = 块.search(/<(input|select)\b/);
    const 标签段文本 = 输入起点 < 0 ? 块 : 块.slice(0, 输入起点);
    if (!引用正则().test(标签段文本)) {
      违例.push('标签未取词典');
    }
    if (含中文(去插值(标签段文本).replace(/<[^>]*>/g, ' '))) {
      违例.push('标签含裸字面量');
    }
  }
  for (const 匹配 of 模板段(源).matchAll(/<option[\s\S]*?<\/option>/g)) {
    const 块 = 匹配[0];
    const 文本 = 去插值(块.replace(/<[^>]*>/g, ' ')).trim();
    if (文本.length > 0 || !/\{\{[\s\S]*?(取文案|项\.文案|[\u4e00-\u9fa5]+文案[.])[\s\S]*?\}\}/.test(块)) {
      违例.push(`选项文案未取词典或映射：${块.replace(/\s+/g, ' ')}`);
    }
  }
  return 违例;
}

function 词典引用文本(片段: string): string {
  const 坐标 = 引用坐标(引用正则().exec(片段));
  if (坐标 === null) {
    return 去插值(片段).replace(/<[^>]*>/g, ' ').trim();
  }
  return 词典文本(坐标[0], 坐标[1]);
}

function 标签分组(源: string): Array<{ 组: string; 标签: string }> {
  const 模板 = 模板段(源);
  const 结果: Array<{ 组: string; 标签: string }> = [];
  let 当前组 = '';
  for (const 匹配 of 模板.matchAll(/<h[123][^>]*>([\s\S]*?)<\/h[123]>|<label[\s\S]*?<\/label>/g)) {
    if (匹配[0].startsWith('<label')) {
      const 输入起点 = 匹配[0].search(/<(input|select)\b/);
      const 标签段文本 = 输入起点 < 0 ? 匹配[0] : 匹配[0].slice(0, 输入起点);
      结果.push({ 组: 当前组, 标签: 词典引用文本(标签段文本) });
    } else {
      当前组 = 词典引用文本(匹配[1]);
    }
  }
  return 结果;
}

function 扫描同组重名标签(源: string): string[] {
  const 分组 = new Map<string, string[]>();
  for (const 项 of 标签分组(源)) {
    分组.set(项.组, [...(分组.get(项.组) ?? []), 项.标签]);
  }
  const 违例: string[] = [];
  const 出现组 = new Map<string, string[]>();
  for (const [组, 标签清单] of 分组) {
    for (const 标签 of 标签清单) {
      出现组.set(标签, [...(出现组.get(标签) ?? []), 组]);
    }
    const 重复 = 标签清单.filter((标签, 序号) => 标签清单.indexOf(标签) !== 序号);
    for (const 标签 of new Set(重复)) {
      违例.push(`组「${组}」内标签重复：${标签}`);
    }
  }
  for (const [标签, 组清单] of 出现组) {
    if (组清单.length > 1 && (组清单.length !== new Set(组清单).size || 组清单.some((组) => 组.length === 0))) {
      违例.push(`跨组重复标签「${标签}」必须分处互不相同的非空组标题之下：${组清单.join('|')}`);
    }
  }
  return 违例;
}

function 扫描说明字段(源: string, 允许: readonly string[]): string[] {
  const 违例: string[] = [];
  for (const 匹配 of 模板段(源).matchAll(/说明\.([a-z_]+)/g)) {
    if (!允许.includes(匹配[1])) {
      违例.push(`思考说明渲染了未登记字段 ${匹配[1]}`);
    }
  }
  return 违例;
}

function 扫描错误码接线(源: string): string[] {
  const 违例: string[] = [];
  if (/xing-tai="cuo-wu"/.test(源) && !/:cuo-wu-ma="错误码"/.test(源)) {
    违例.push('错误条未接服务端错误码');
  }
  if (/instanceof Error/.test(源)) {
    违例.push('页面自行拆分错误，未走 取错误展示 单点');
  }
  return 违例;
}

function 提交对应(源: string, 接口名: string): Record<string, string> {
  const 命中 = new RegExp(String.raw`${接口名}\(\{([\s\S]*?)\}\)`).exec(源);
  if (命中 === null) {
    throw new Error(`源码里找不到 ${接口名} 的调用参数，对应表守卫无法执行`);
  }
  const 结果: Record<string, string> = {};
  for (const 项 of 命中[1].matchAll(/(\w+): 可选文本\(([^.\s]+)\.value\)/g)) {
    结果[项[1]] = 项[2];
  }
  return 结果;
}

function 标签绑定(源: string): Array<{ 标签: string; 绑定: string }> {
  const 结果: Array<{ 标签: string; 绑定: string }> = [];
  for (const 匹配 of 模板段(源).matchAll(/<label[\s\S]*?<\/label>/g)) {
    const 输入起点 = 匹配[0].search(/<(input|select)\b/);
    const 标签段文本 = 输入起点 < 0 ? 匹配[0] : 匹配[0].slice(0, 输入起点);
    const 绑定 = /v-model="([^"]+)"/.exec(匹配[0])?.[1] ?? '';
    结果.push({ 标签: 词典引用文本(标签段文本), 绑定 });
  }
  return 结果;
}

function 标签占位重复(块: string): string[] {
  const 占位属性 = /:placeholder="([^"]*)"/.exec(块);
  const 占位 = 占位属性 === null ? null : 引用坐标(引用正则().exec(占位属性[1]));
  if (占位 === null) {
    return [];
  }
  const 占位文本 = 词典文本(占位[0], 占位[1]);
  if (占位文本.length === 0) {
    return [`占位引用了取不到文本的键 ${占位[0]}.${占位[1]}`];
  }
  const 输入起点 = 块.search(/<(input|select)\b/);
  const 标签段 = 输入起点 < 0 ? 块 : 块.slice(0, 输入起点);
  const 违例: string[] = [];
  for (const 坐标 of 引用清单(标签段)) {
    if (词典文本(坐标[0], 坐标[1]) === 占位文本) {
      违例.push(`标签 ${坐标[0]}.${坐标[1]} 与占位 ${占位[0]}.${占位[1]} 同句重复：${占位文本}`);
    }
  }
  return 违例;
}

function 扫描标签占位重复(源: string): string[] {
  const 违例: string[] = [];
  for (const 匹配 of 源.matchAll(/<label[\s\S]*?<\/label>/g)) {
    违例.push(...标签占位重复(匹配[0]));
  }
  return 违例;
}

function 扫描占位表头键(源: string): string[] {
  return [...源.matchAll(/\[\s*'([^']+)'\s*,\s*'([^']*占位)'\s*\]/g)].map((匹配) => `${匹配[1]}.${匹配[2]}`);
}

const 组说明键清单: string[] = Object.entries(文案).flatMap(([分类, 子表]) =>
  Object.keys(子表 as Record<string, string>)
    .filter((键) => 键.endsWith('组说明'))
    .map((键) => `${分类}.${键}`),
);

function 组标题位置(模板: string): number[] {
  return [...模板.matchAll(/:biao-ti="(?:取文案\(|[\u4e00-\u9fa5]+文案[.[])|<h[234][^>]*>[\s\S]{0,40}?(?:取文案\(|[\u4e00-\u9fa5]+文案[.[])/g)].map((匹配) => 匹配.index);
}

function 组说明位置(模板: string): Array<{ 路径: string; 位置: number }> {
  const 结果: Array<{ 路径: string; 位置: number }> = [];
  for (const 匹配 of 模板.matchAll(引用正则('g'))) {
    const 坐标 = 引用坐标(匹配) as [string, string];
    const 路径 = `${坐标[0]}.${坐标[1]}`;
    if (组说明键清单.includes(路径)) {
      结果.push({ 路径, 位置: 匹配.index });
    }
  }
  return 结果;
}

function 校验组说明落位(文件: string, 源: string): string[] {
  const 模板 = 模板段(源);
  const 标题位 = 组标题位置(模板);
  const 说明位 = 组说明位置(模板);
  const 违例: string[] = [];
  for (const 项 of 说明位) {
    const 领起标题 = 标题位.filter((位) => 位 < 项.位置).pop();
    if (领起标题 === undefined) {
      违例.push(`组说明 ${项.路径} 在 ${文件} 里没有组标题领起`);
      continue;
    }
    const 蹭别组 = 说明位.find((其他) => 其他.路径 !== 项.路径 && 其他.位置 > 领起标题 && 其他.位置 < 项.位置);
    if (蹭别组 !== undefined) {
      违例.push(`组说明 ${项.路径} 与 ${蹭别组.路径} 共用同一个组标题，未各自落在互斥组标题之下`);
    }
  }
  return 违例;
}

function 扫描未渲染组说明(视图清单: readonly string[]): string[] {
  const 违例: string[] = [];
  const 已渲染 = new Set<string>();
  for (const 路径 of 视图清单) {
    const 源 = 读(路径);
    for (const 项 of 组说明位置(模板段(源))) {
      已渲染.add(项.路径);
    }
    违例.push(...校验组说明落位(路径, 源));
  }
  for (const 键路径 of 组说明键清单) {
    if (!已渲染.has(键路径)) {
      违例.push(`组说明 ${键路径} 在任何视图里都没有渲染点`);
    }
  }
  expect(组说明键清单.length).toBeGreaterThanOrEqual(4);
  return 违例;
}

function 枚举表头集(): Set<string> {
  const 结果 = new Set<string>();
  for (const 表 of Object.keys(列定义登记) as 表名[]) {
    for (const 项 of 列定义登记[表] as readonly 列[]) {
      if ((项.渲染 === '徽标' || 项.渲染 === '枚举') && 项.表头 !== null) {
        结果.add(表头文本(项));
      }
    }
  }
  return 结果;
}

interface 筛选控件 {
  标签: string;
  控件: string;
  块: string;
}

function 扫描筛选控件(源: string): 筛选控件[] {
  const 允许 = 枚举表头集();
  const 结果: 筛选控件[] = [];
  for (const 匹配 of 模板段(源).matchAll(/<label[\s\S]*?<\/label>/g)) {
    const 块 = 匹配[0];
    const 输入起点 = 块.search(/<(input|select)\b/);
    if (输入起点 < 0) {
      continue;
    }
    const 控件 = /<(select)\b/.test(块.slice(输入起点)) ? 'select' : 'input';
    const 类型属性 = /type="([^"]*)"/.exec(块.slice(输入起点))?.[1] ?? 'text';
    const 标签 = 词典引用文本(块.slice(0, 输入起点));
    if (允许.has(标签) && 类型属性 === 'text') {
      结果.push({ 标签, 控件, 块: 块.replace(/\s+/g, ' ') });
    }
  }
  return 结果;
}

function 扫描枚举下拉(源: string): string[] {
  const 违例: string[] = [];
  const 导入表 = new Map<string, string>();
  for (const 匹配 of 源.matchAll(/import \{([^}]+)\} from '\.\.\/枚举映射\/([^']+)'/g)) {
    for (const 名 of 匹配[1].split(',').map((项) => 项.trim()).filter((项) => 项.length > 0)) {
      导入表.set(名, 匹配[2]);
    }
  }
  for (const 项 of 扫描筛选控件(源)) {
    if (项.控件 !== 'select') {
      违例.push(`枚举筛选「${项.标签}」仍是自由文本输入，管理员得手打原码：${项.块}`);
      continue;
    }
    const 选项名 = /v-for="项 in ([\u4e00-\u9fa5]+选项)"/.exec(项.块)?.[1];
    if (选项名 === undefined || 导入表.get(选项名) === undefined) {
      违例.push(`枚举筛选「${项.标签}」的 option 没有引 枚举映射 的选项数组：${项.块}`);
    }
  }
  return 违例;
}

function 末次入参(模拟: { mock: { lastCall?: unknown[] } }, 下标 = 0): Record<string, unknown> {
  const 调用 = 模拟.mock.lastCall;
  if (调用 === undefined) {
    throw new Error('改动筛选后没有发起请求，提交协议断言拒绝空跑');
  }
  return 调用[下标] as Record<string, unknown>;
}

function 扫描图例同名(源: string): string[] {
  const 标题 = new Set<string>();
  for (const 匹配 of 模板段(源).matchAll(/<h[1234][^>]*>([\s\S]*?)<\/h[1234]>|<YeMei[\s\S]*?:biao-ti="([^"]*)"/g)) {
    const 文本 = 词典引用文本(匹配[1] ?? 匹配[2]);
    if (文本.length > 0) {
      标题.add(文本);
    }
  }
  const 违例: string[] = [];
  for (const 匹配 of 模板段(源).matchAll(/<p class="图注">([\s\S]*?)<\/p>/g)) {
    for (const 项 of 匹配[1].matchAll(/\{\{([^{}]+)\}\}/g)) {
      const 文本 = 词典引用文本(项[1]);
      if (文本.length > 0 && 标题.has(文本)) {
        违例.push(`图例序列名与卡片标题同为「${文本}」，图例必须说明是哪一条序列`);
      }
    }
  }
  return 违例;
}

async function 建路由(路径: string): Promise<Router> {
  const 路由器: Router = createRouter({ history: createMemoryHistory(), routes: 路由表 });
  await 路由器.push(路径);
  return 路由器;
}

vi.mock('../api/管理', () => ({
  账号列表: vi.fn().mockResolvedValue({ 行: [], 分页: undefined }),
  账号详情: vi.fn().mockResolvedValue({}),
  授予角色: vi.fn(),
  回收角色: vi.fn(),
  接管角色: vi.fn(),
  结束接管: vi.fn(),
  管理登录: vi.fn(),
  我的身份: vi.fn().mockResolvedValue({ yong_hu_id: 'yi', jiao_se: 'chao_guan', neng_li: ['cha_kan', 'gao_we'] }),
  聊天消息: vi.fn().mockResolvedValue({ 行: [], 分页: undefined }),
  好友消息: vi.fn().mockResolvedValue({ 行: [], 分页: undefined }),
  记忆列表: vi.fn().mockResolvedValue({ 行: [], 分页: undefined }),
  对话摘要列表: vi.fn().mockResolvedValue({ 行: [], 分页: undefined }),
  关键事件列表: vi.fn().mockResolvedValue({ 行: [], 分页: undefined }),
  接管记录列表: vi.fn().mockResolvedValue({ 行: [], 分页: undefined }),
  评估列表: vi.fn().mockResolvedValue({ 行: [], 分页: undefined }),
  思考记录列表: vi.fn().mockResolvedValue({ 行: [], 分页: undefined }),
  思考记录详情: vi.fn().mockResolvedValue({}),
  思考说明: vi.fn().mockResolvedValue({
    you_du_li_si_kao_chi_jiu_hua_biao: true,
    sheng_ming: 'sheng_ming_yi_ba_shu',
    hui_fang_zhun_ze: 'hui_fang_yi_ba_shu',
    shi_shi_shi_jian: [],
    shi_shi_shuo_ming: 'shi_shi_shuo_ming_yi_ba_shu',
    dan_tiao_jie_duan_zi_fu_shu: 1500,
    yi_chi_jiu_hua_cha_xun: [],
    dai_bu_chong_shuo_ming: 'dai_bu_chong_shuo_ming',
    dai_bu_chong: ['shi_shi_neng_li'],
  }),
  封禁记录: vi.fn().mockResolvedValue({ 行: [], 分页: undefined }),
  写入封禁: vi.fn(),
  账号封禁列表: vi.fn().mockResolvedValue({ 行: [], 分页: undefined }),
  解封账号: vi.fn(),
  审核申诉: vi.fn(),
  审计日志: vi.fn().mockResolvedValue({ 行: [], 分页: undefined }),
  审计保留: vi.fn().mockResolvedValue({ zong_shu: 0 }),
  注册统计: vi.fn().mockResolvedValue({ lie_biao: [] }),
  消息统计: vi.fn().mockResolvedValue({ lie_biao: [] }),
  好感度统计: vi.fn().mockResolvedValue({}),
  留存统计: vi.fn().mockResolvedValue({ lie_biao: [] }),
  用量统计: vi.fn().mockResolvedValue({ lie_biao: [] }),
  埋点字典: vi.fn().mockResolvedValue({}),
  就绪检查: vi.fn(),
  指标概览: vi.fn(),
  审核列表: vi.fn().mockResolvedValue({ 行: [], 分页: undefined }),
  审核新建: vi.fn(),
  审核初审: vi.fn(),
  审核复审: vi.fn(),
  审核多项处理: vi.fn(),
  处理记录列表: vi.fn().mockResolvedValue({ 行: [], 分页: undefined }),
}));

const 接口 = await import('../api/管理');

beforeEach(() => {
  setActivePinia(createPinia());
  window.localStorage.clear();
  window.sessionStorage.clear();
  vi.clearAllMocks();
  使用登录仓库().设置身份('chao_guan', ['cha_kan', 'gao_we']);
});

describe('FP-04 登录页与应用外壳不再渲染装饰文字', () => {
  it('登录页只剩标题、说明、两个输入、错误条与按钮', async () => {
    const { default: 登录页 } = await import('../views/登录页.vue');
    const 包装 = mount(登录页, { global: { plugins: [createPinia(), await 建路由('/deng-lu')] } });
    const 文本 = 包装.text();
    for (const 词 of 装饰文字) {
      expect(文本, `登录页仍出现装饰文字 ${词}`).not.toContain(词);
    }
    expect(包装.findAll('h2')).toHaveLength(1);
    expect(文本).toContain(取文案('登录', '标题'));
    expect(文本).not.toContain(取文案('通用', '应用标题'));
    expect(包装.find('[data-testid="shou-ji-hao-shu-ru"]').attributes('placeholder')).toBeUndefined();
    expect(包装.find('[data-testid="mi-ma-shu-ru"]').attributes('placeholder')).toBeUndefined();
  });

  it('恋管印章与人物章元素全部移除', () => {
    for (const 路径 of [...落地视图清单, 'src/App.vue']) {
      expect(读(路径), `${路径} 仍挂着 印章 元素`).not.toContain('印章');
    }
    expect(读('src/views/账号详情.vue')).not.toContain('人物章');
    expect(读('src/App.vue')).not.toContain('恋管');
  });

  it('导航地标与主题按钮的文本取自词典而不是硬编码', async () => {
    window.sessionStorage.setItem('guan_li_hui_hua', 'yi_deng_lu');
    const { default: 外壳 } = await import('../App.vue');
    const 包装 = mount(外壳, { global: { plugins: [await 建路由('/zhang-hao')], stubs: { RouterView: true } } });
    await flushPromises();
    expect(包装.find('nav').attributes('aria-label')).toBe(取文案('导航', '管理导航'));
    const 主题按钮 = 包装.findAll('button').find((项) => 项.text().includes(取文案('导航', '深色主题')));
    expect(主题按钮?.text()).toBe(取文案('导航', '深色主题'));
    expect(取文案('导航', '深色主题')).toBe('深色');
    expect(取文案('导航', '浅色主题')).toBe('浅色');
  });

  it('主题.css 只留下仍有使用者的装饰规则', () => {
    const 样式 = 读('src/主题.css');
    expect(样式, '印章/眉题 的唯一使用者已被 FP-04 删除').not.toMatch(/印[章题]/);
    expect(样式, '卡注 在全部视图与组件里零引用').not.toContain('卡注');
    expect(样式).toContain('.页眉 {');
  });
});

describe('FP-04 错误码上屏', () => {
  it('错误条在有码时拼成提示（错误码），无码时不留空括号', () => {
    const 有码 = mount(XiaoXiTiao, {
      props: {
        xingTai: 'cuo-wu',
        wenBen: '当前账号无此权限',
        cuoWuMa: 'WU_GUAN_LI_QUAN_XIAN',
        ceShiBiaoShi: 'cuo-wu-ti-shi',
      },
    });
    expect(有码.text()).toBe('当前账号无此权限（WU_GUAN_LI_QUAN_XIAN）');
    expect(有码.classes()).toContain('错误条');
    expect(有码.attributes('role')).toBe('alert');
    expect(有码.attributes('aria-live')).toBe('polite');
    expect(有码.attributes('data-testid')).toBe('cuo-wu-ti-shi');
    const 无码 = mount(XiaoXiTiao, { props: { xingTai: 'cuo-wu', wenBen: '请求失败，请稍后再试' } });
    expect(无码.text()).toBe('请求失败，请稍后再试');
    expect(无码.text()).not.toContain('（）');
    expect(无码.text()).not.toContain('undefined');
  });

  it('取错误展示是提示与错误码的唯一拆分点，且前端不自造码', () => {
    expect(取错误展示(new 业务错误('无权限', 'A-4031'))).toEqual({ 提示: '无权限', 错误码: 'A-4031' });
    expect(取错误展示(new Error('网络不可达'))).toEqual({ 提示: '网络不可达', 错误码: '' });
    expect(取错误展示('未知')).toEqual({ 提示: 取文案('通用', '请求失败'), 错误码: '' });
    try {
      解析包络({ cheng_gong: false, shu_ju: null, ti_shi: '无权限', cuo_wu_ma: 'A-4031' });
      expect.unreachable();
    } catch (错误) {
      expect(取错误展示(错误).错误码).toBe('A-4031');
    }
    try {
      解析包络({ cheng_gong: false, shu_ju: null, ti_shi: '', cuo_wu_ma: '' });
      expect.unreachable();
    } catch (错误) {
      const 展示 = 取错误展示(错误);
      expect(展示.提示).toBe(取文案('通用', '请求失败'));
      expect(展示.错误码).toBe('');
      expect(展示.错误码).not.toMatch(/CUO_WU/);
      expect(mount(XiaoXiTiao, { props: { xingTai: 'cuo-wu', wenBen: 展示.提示, cuoWuMa: 展示.错误码 } }).text()).not.toContain('（');
    }
    try {
      解析包络({ cheng_gong: true, shu_ju: null });
      expect.unreachable();
    } catch (错误) {
      const 展示 = 取错误展示(错误);
      expect(展示.提示).toBe(取文案('通用', '请求失败'));
      expect(展示.错误码).toBe('');
    }
  });

  it('无失败包络的英文错误不得上屏，渲染文本除错误码括号外不含拉丁字母', () => {
    for (const 原文 of ['Network Error', 'timeout of 15000ms exceeded', 'Request failed with status code 500']) {
      const 裸英文 = new Error(原文);
      const 展示 = 取错误展示(裸英文);
      expect(展示.提示).toBe(取文案('通用', '请求失败'));
      expect(展示.错误码).toBe('');
      const 包装 = mount(XiaoXiTiao, { props: { xingTai: 'cuo-wu', wenBen: 展示.提示, cuoWuMa: 展示.错误码 } });
      expect(包装.text()).toBe(取文案('通用', '请求失败'));
      expect(包装.text()).not.toMatch(/[A-Za-z]/);
      expect(包装.text()).not.toContain(原文);
      expect(包装.text()).not.toContain('（');
      const 带码 = 取错误展示(new 业务错误(原文, 'NEI_BU_CUO_WU'));
      expect(带码.提示).toBe(取文案('通用', '请求失败'));
      expect(带码.错误码).toBe('NEI_BU_CUO_WU');
      const 带码包装 = mount(XiaoXiTiao, { props: { xingTai: 'cuo-wu', wenBen: 带码.提示, cuoWuMa: 带码.错误码 } });
      expect(带码包装.text).toBeDefined();
      expect(带码包装.text().replace(/（[A-Z_]+）$/, '')).not.toMatch(/[A-Za-z]/);
      expect(带码包装.text()).toBe(`${取文案('通用', '请求失败')}（NEI_BU_CUO_WU）`);
    }
    expect(取错误展示(new Error('请填写用户编号或 IP 地址')).提示).toBe('请填写用户编号或 IP 地址');
    for (const 原文 of ['Network Error', 'timeout of 15000ms exceeded']) {
      const 展示 = 取错误展示(归一请求错误(Object.assign(new Error(原文), { isAxiosError: true })));
      expect(展示).toEqual({ 提示: 取文案('通用', '请求失败'), 错误码: '' });
      const 包装 = mount(XiaoXiTiao, { props: { xingTai: 'cuo-wu', wenBen: 展示.提示, cuoWuMa: 展示.错误码 } });
      expect(包装.text()).not.toMatch(/[A-Za-z]/);
      expect(包装.text()).not.toContain(原文);
    }
    const 网关 = 归一请求错误({
      isAxiosError: true,
      config: {},
      response: { status: 504, data: '<html>Gateway Time-out</html>' },
      message: 'timeout of 15000ms exceeded',
    });
    expect(取错误展示(网关)).toEqual({ 提示: 取文案('通用', '请求失败'), 错误码: '' });
    const 过期 = 归一请求错误({
      isAxiosError: true,
      config: {},
      response: { status: 401, data: '' },
      message: 'Request failed with status code 401',
    });
    expect(取错误展示(过期)).toEqual({ 提示: 取文案('通用', '登录过期'), 错误码: '' });
    const 带包络 = 归一请求错误({
      isAxiosError: true,
      config: {},
      response: {
        status: 403,
        data: { cheng_gong: false, shu_ju: null, ti_shi: '当前账号没有管理身份', cuo_wu_ma: 'WU_GUAN_LI_QUAN_XIAN' },
      },
      message: 'Request failed with status code 403',
    });
    expect(取错误展示(带包络)).toEqual({ 提示: '当前账号没有管理身份', 错误码: 'WU_GUAN_LI_QUAN_XIAN' });
  });

  it('账号列表与登录页把服务端错误码带到错误条上', async () => {
    vi.mocked(接口.账号列表).mockRejectedValue(new 业务错误('当前账号无此权限', 'WU_GUAN_LI_QUAN_XIAN'));
    const { default: 账号列表页 } = await import('../views/账号列表.vue');
    const 包装 = mount(账号列表页, { global: { plugins: [await 建路由('/zhang-hao')] } });
    await flushPromises();
    expect(包装.find('.错误条').text()).toBe('当前账号无此权限（WU_GUAN_LI_QUAN_XIAN）');

    vi.mocked(接口.管理登录).mockRejectedValue(new Error('网络不可达'));
    const { default: 登录页 } = await import('../views/登录页.vue');
    const 登录包装 = mount(登录页, { global: { plugins: [createPinia(), await 建路由('/deng-lu')] } });
    await 登录包装.find('[data-testid="shou-ji-hao-shu-ru"]').setValue('13800000000');
    await 登录包装.find('[data-testid="mi-ma-shu-ru"]').setValue('mi-ma-123');
    await 登录包装.find('[data-testid="deng-lu-an-niu"]').trigger('click');
    await flushPromises();
    expect(登录包装.find('[data-testid="cuo-wu-ti-shi"]').text()).toBe('网络不可达');
  });

  it('成功条与空态不带错误码', () => {
    const 成功 = mount(XiaoXiTiao, { props: { xingTai: 'cheng-gong', wenBen: 取文案('账号', '授予角色成功') } });
    expect(成功.text()).toBe(取文案('账号', '授予角色成功'));
    const 空 = mount(XiaoXiTiao, { props: { xingTai: 'kong', cuoWuMa: 'WU_GUAN_LI_QUAN_XIAN' } });
    expect(空.text()).toBe(取文案('通用', '暂无数据'));
  });
});

describe('FP-04 封禁级别不按时长分色', () => {
  it('封禁 1 分钟与永久封禁同为危色徽标', async () => {
    vi.mocked(接口.账号列表).mockResolvedValue({
      行: [{ ID: 'yi', 昵称: '一分钟', 手机号: '13800000000', 角色: null, 封禁级别: 'feng_jin_1_fen', 创建时间: '2026-09-20 10:00:00' }],
      分页: undefined,
    });
    const { default: 账号列表页 } = await import('../views/账号列表.vue');
    const 包装 = mount(账号列表页, { global: { plugins: [await 建路由('/zhang-hao')] } });
    await flushPromises();
    const 徽标 = 包装.findAll('.徽标').find((项) => 项.text() === 取文案('封禁', '级别1分钟'));
    expect(徽标?.classes()).toContain('危');
    expect(徽标?.classes()).not.toContain('警');
  });
});

describe('FP-04 字段标签不再与占位同句重复', () => {
  it('登录页/账号列表/账号详情的 label 块扫不出重复', () => {
    let 标签数 = 0;
    for (const 路径 of 落地视图清单) {
      const 源 = 读(路径);
      标签数 += (源.match(/<label/g) ?? []).length;
      expect(扫描标签占位重复(源), 路径).toEqual([]);
    }
    expect(标签数).toBeGreaterThanOrEqual(5);
  });

  it('反证：标签与占位取到同一文本时必须被判红', () => {
    const 样张 = `
      <label class="字段">
        {{ 取文案('账号', '手机号') }}
        <input class="输入" :placeholder="取文案('账号', '手机号')">
      </label>`;
    expect(扫描标签占位重复(样张).length).toBeGreaterThan(0);
    const 新形态样张 = `
      <label class="字段">
        {{ 账号文案.手机号 }}
        <input class="输入" :placeholder="账号文案.手机号">
      </label>`;
    expect(扫描标签占位重复(新形态样张).length).toBeGreaterThan(0);
    const 新形态合法 = `
      <label class="字段">
        {{ 账号文案.手机号 }}
        <input class="输入" :placeholder="封禁文案.地址列">
      </label>`;
    expect(扫描标签占位重复(新形态合法)).toEqual([]);
    const 占位键失效 = `
      <label class="字段">
        {{ 取文案('账号', '手机号') }}
        <input class="输入" :placeholder="取文案('账号', '不存在的键')">
      </label>`;
    expect(扫描标签占位重复(占位键失效).length).toBe(1);
    const 合法样张 = `
      <label class="字段">
        {{ 取文案('账号', '手机号') }}
        <input class="输入" :placeholder="取文案('封禁', '地址列')">
      </label>`;
    expect(扫描标签占位重复(合法样张)).toEqual([]);
  });
});

describe('FP-05 三视图非词典中文字面量清零', () => {
  it('九个落地视图扫不出裸文本节点、裸显示属性与无出处标签', () => {
    expect(落地视图清单).toHaveLength(9);
    for (const 路径 of 落地视图清单) {
      const 源 = 读(路径);
      expect(扫描可见字面量(源), 路径).toEqual([]);
      expect(扫描标签来源(源), 路径).toEqual([]);
      expect(扫描同组重名标签(源), 路径).toEqual([]);
      expect(扫描标签占位重复(源), 路径).toEqual([]);
      expect(扫描错误码接线(源), 路径).toEqual([]);
    }
  });

  it('三视图无装饰性古风文字、无整行 JSON 快照、无视图内表头', () => {
    for (const 路径 of FP05视图清单) {
      const 源 = 读(路径);
      for (const 词 of 装饰文字) {
        expect(源, `${路径} 仍含装饰文字 ${词}`).not.toContain(词);
      }
      expect(源, `${路径} 仍挂着 印章 元素`).not.toContain('印章');
      expect(源, `${路径} 仍整行输出 JSON`).not.toContain('JSON.stringify');
      expect(源, `${路径} 仍自写表头`).not.toMatch(/<th[\s>]/);
    }
  });

  it('聊天记录两种模式的标签与实际提交参数逐项对应', () => {
    const 源 = 读('src/views/聊天记录.vue');
    expect(提交对应(源, '聊天消息')).toEqual({
      yong_hu_id: '用户编号',
      jiao_se_id: '角色编号',
      kai_shi_shi_jian: '开始时间',
      jie_shu_shi_jian: '结束时间',
    });
    expect(提交对应(源, '好友消息')).toEqual({
      fa_song_zhe_id: '发送者编号',
      jie_shou_zhe_id: '接收者编号',
      kai_shi_shi_jian: '开始时间',
      jie_shu_shi_jian: '结束时间',
    });
    expect(标签绑定(源)).toEqual([
      { 标签: 取文案('账号', '用户编号'), 绑定: '用户编号' },
      { 标签: 取文案('账号', '角色编号标签'), 绑定: '角色编号' },
      { 标签: 取文案('聊天', '发送者编号标签'), 绑定: '发送者编号' },
      { 标签: 取文案('聊天', '接收者编号标签'), 绑定: '接收者编号' },
      { 标签: 取文案('聊天', '发送方标签'), 绑定: '发送方' },
      { 标签: 取文案('聊天', '排序标签'), 绑定: '排序' },
      { 标签: 取文案('聊天', '开始时间标签'), 绑定: '开始时间' },
      { 标签: 取文案('聊天', '结束时间标签'), 绑定: '结束时间' },
    ]);
  });

  it('思考链只渲染登记的说明字段，其余数据字段不上屏', () => {
    expect(扫描说明字段(读('src/views/思考链.vue'), 思考说明渲染字段)).toEqual([]);
    const 样张 = `
      <template>
        <p>{{ 说明.yi_chi_jiu_hua_cha_xun }}</p>
        <p>{{ 说明.sheng_ming }}</p>
      </template>`;
    expect(扫描说明字段(样张, 思考说明渲染字段)).toEqual(['思考说明渲染了未登记字段 yi_chi_jiu_hua_cha_xun']);
  });

  it('反证：硬编码选项、括号填充与同页同名标签必须判红', () => {
    const 裸选项 = `
      <template>
        <label class="字段">
          严重程度
          <select class="选择"><option value="中等">中等</option></select>
        </label>
      </template>`;
    expect(扫描可见字面量(裸选项).length).toBeGreaterThan(0);
    expect(扫描标签来源(裸选项).length).toBeGreaterThan(0);
    expect(扫描可见字面量("<template><p>{{ '昵称' }}</p></template>")).toEqual(["插值裸字面量「'昵称'」"]);
    expect(扫描可见字面量("<template><p v-if=\"角色 === '超级管理员'\">x</p></template>")).toEqual([
      '条件表达式裸字面量「超级管理员」',
    ]);
    expect(扫描可见字面量("<template><p v-else-if=\"级 !== '正常'\">x</p></template>")).toEqual([
      '条件表达式裸字面量「正常」',
    ]);
    expect(扫描可见字面量("<template><p>{{ 账号文案.昵称 }}</p><p v-if=\"角色 === 当前角色\">x</p></template>")).toEqual([]);
    expect(扫描可见字面量("<template><p>{{ 取文案('账号', '昵称') }}</p></template>")).toEqual([]);
    const 括号填充 = `
      <template>
        <li><span class="徽标">{{ 取文案('通用', '待补充') }}</span>{{ 项 }}（{{ 取文案('通用', '待补充') }}）</li>
      </template>`;
    expect(扫描可见字面量(括号填充)).toEqual(['裸文本节点「（）」']);
    const 同组重名 = `
      <template>
        <h3>{{ 取文案('封禁', '写入标题') }}</h3>
        <label>{{ 取文案('封禁', '地址标签') }}<input class="输入"></label>
        <label>{{ 取文案('封禁', '地址标签') }}<input class="输入"></label>
      </template>`;
    expect(扫描同组重名标签(同组重名).length).toBeGreaterThan(0);
    const 无组标题 = `
      <template>
        <label>{{ 取文案('封禁', '地址标签') }}<input class="输入"></label>
        <label>{{ 取文案('封禁', '地址标签') }}<input class="输入"></label>
      </template>`;
    expect(扫描同组重名标签(无组标题).length).toBeGreaterThan(0);
    const 分组合规 = `
      <template>
        <h3>{{ 取文案('封禁', '写入标题') }}</h3>
        <label>{{ 取文案('封禁', '地址标签') }}<input class="输入"></label>
        <h3>{{ 取文案('封禁', '记录标题') }}</h3>
        <label>{{ 取文案('封禁', '地址标签') }}<input class="输入"></label>
      </template>`;
    expect(扫描同组重名标签(分组合规)).toEqual([]);
    expect(扫描同组重名标签(读('src/views/封禁管理.vue'))).toEqual([]);
  });
});

describe('FP-05 三视图渲染收口', () => {
  it('思考链行快照只渲染列定义白名单，详情正文不回填行', async () => {
    vi.mocked(接口.思考记录列表).mockResolvedValue({
      行: [
        {
          ID: 'ji-lu-yi',
          创建时间: '2026-09-20 10:00:00',
          事件: 'guan-li-yuan-shen-du-si-kao',
          摘要: 'yi-duan-zhai-yao',
          nei_bu_ji_deng_jian: 'min_gan_zhi',
          手机号: '13800000000',
        },
      ],
      分页: undefined,
    });
    vi.mocked(接口.思考记录详情).mockResolvedValue({ 内容: 'zheng_wen_min_gan_zhi' });
    const { default: 思考链路 } = await import('../views/思考链.vue');
    const 包装 = mount(思考链路);
    await flushPromises();
    const 快照 = 包装.find('pre').text();
    expect(快照).toContain(`${取文案('思考', '摘要标签')}：yi-duan-zhai-yao`);
    expect(快照).toContain(取文案('思考', '事件深度思考'));
    expect(快照).not.toContain('guan-li-yuan-shen-du-si-kao');
    const 全文 = 包装.text();
    expect(全文).not.toContain('nei_bu_ji_deng_jian');
    expect(全文).not.toContain('min_gan_zhi');
    expect(全文).not.toContain('13800000000');
    await 包装.find('.按钮次').trigger('click');
    await flushPromises();
    expect(包装.text()).toContain('zheng_wen_min_gan_zhi');
    expect(包装.find('pre').text()).not.toContain('zheng_wen_min_gan_zhi');
    expect(包装.find('pre').text()).not.toContain(取文案('思考', '内容标签'));
  });

  it('后端说明仍带旧称与事件示例值时也不上屏，待补充项单一口径', async () => {
    vi.mocked(接口.思考说明).mockResolvedValue({
      you_du_li_si_kao_chi_jiu_hua_biao: true,
      sheng_ming: 'sheng_ming_wen_ben',
      hui_fang_zhun_ze: 'hui_fang_wen_ben',
      shi_shi_shi_jian: ['管理员_深度思考'],
      shi_shi_shuo_ming: 'shi_shi_shuo_ming_wen_ben',
      dan_tiao_jie_duan_zi_fu_shu: 1500,
      yi_chi_jiu_hua_cha_xun: ['夺舍日志', '记忆'],
      dai_bu_chong_shuo_ming: 'dai_bu_chong_shuo_ming_wen_ben',
      dai_bu_chong: ['实时思考链'],
    });
    const { default: 思考链路 } = await import('../views/思考链.vue');
    const 包装 = mount(思考链路);
    await flushPromises();
    const 文本 = 包装.text();
    expect(文本).not.toContain('夺舍日志');
    expect(文本).not.toContain('管理员_深度思考');
    expect(文本).toContain(取文案('思考', '接管记录标签'));
    const 待补 = 包装.find('[data-testid="dai-bu-chong"]').text();
    expect(待补).not.toContain('（');
    expect(待补).toContain('实时思考链');
    expect(待补).toContain(取文案('通用', '待补充'));
    expect(文本.split(取文案('思考', '实时推送提示'))).toHaveLength(2);
  });

  it('聊天记录把服务端错误码带到错误条', async () => {
    vi.mocked(接口.聊天消息).mockRejectedValue(new 业务错误('数据表尚未就绪，无法查询', 'BIAO_QUE_SHI_JIANG_JI'));
    const { default: 聊天记录页 } = await import('../views/聊天记录.vue');
    const 包装 = mount(聊天记录页);
    await flushPromises();
    expect(包装.find('.错误条').text()).toBe('数据表尚未就绪，无法查询（BIAO_QUE_SHI_JIANG_JI）');
  });

  it('封禁管理的两个 IP 地址输入分处具名组，互斥组标题下渲染组说明', async () => {
    使用登录仓库().设置身份('chao_guan', ['cha_kan', 'feng_jin', 'feng_jin_shen_he']);
    const { default: 封禁管理页 } = await import('../views/封禁管理.vue');
    const 包装 = mount(封禁管理页);
    await flushPromises();
    const 地址标签 = 包装.findAll('label').filter((项) => 项.text().trim() === 取文案('封禁', '地址标签'));
    expect(地址标签).toHaveLength(2);
    expect(地址标签[0].element.closest('.封禁卡')).not.toBeNull();
    expect(地址标签[1].element.closest('.封禁卡')).toBeNull();
    const 卡 = 包装.find('.封禁卡');
    expect(卡.text()).toContain(取文案('封禁', '写入标题'));
    expect(卡.text()).toContain(取文案('封禁', '目标组说明'));
    const 选择 = 卡.findAll('select');
    expect(选择).toHaveLength(2);
    expect(选择[0].findAll('option').map((项) => 项.text())).toEqual([
      取文案('封禁', '级别1分钟'),
      取文案('封禁', '级别1天'),
      取文案('封禁', '级别永久'),
    ]);
    expect(选择[1].findAll('option').map((项) => 项.text())).toEqual([
      取文案('封禁', '严重程度轻微'),
      取文案('封禁', '严重程度中等'),
      取文案('封禁', '严重程度严重'),
    ]);
    expect(选择[0].element.value).toBe(封禁级别默认);
    expect(选择[1].element.value).toBe(严重程度默认);
  });
});

describe('FP-06 审计日志/统计图表/审核运营落地收口', () => {
  it('三视图无装饰性古风文字、无整行 JSON 快照、无视图内表头', () => {
    expect(FP06视图清单).toHaveLength(3);
    for (const 路径 of FP06视图清单) {
      const 源 = 读(路径);
      for (const 词 of 装饰文字) {
        expect(源, `${路径} 仍含装饰文字 ${词}`).not.toContain(词);
      }
      expect(源, `${路径} 仍挂着 印章 元素`).not.toContain('印章');
      expect(源, `${路径} 仍整行输出 JSON`).not.toContain('JSON.stringify');
      expect(源, `${路径} 仍自写表头`).not.toMatch(/<th[\s>]/);
    }
  });

  it('表头不再引用占位类词典键，词典里的组说明全部有渲染点', () => {
    expect(扫描占位表头键(读('src/列定义.ts'))).toEqual([]);
    expect(扫描未渲染组说明(落地视图清单)).toEqual([]);
  });

  it('反证：占位键当表头与无渲染点的组说明都必须判红', () => {
    expect(扫描占位表头键("编号列('目标ID', ['审核', '目标编号占位'])")).toEqual(['审核.目标编号占位']);
    expect(扫描占位表头键("编号列('目标ID', ['审核', '目标编号列'])")).toEqual([]);
    expect(扫描未渲染组说明(FP05视图清单)).toContain('组说明 审核.评审组说明 在任何视图里都没有渲染点');
    expect(
      校验组说明落位('样张.vue', "<template><p>{{ 取文案('封禁', '目标组说明') }}</p></template>"),
    ).toContain('组说明 封禁.目标组说明 在 样张.vue 里没有组标题领起');
    expect(
      校验组说明落位(
        '样张.vue',
        "<template><h3>{{ 取文案('封禁', '写入标题') }}</h3><p>{{ 取文案('封禁', '目标组说明') }}</p><p>{{ 取文案('账号', '接管组说明') }}</p></template>",
      ).some((项) => 项.includes('共用同一个组标题')),
    ).toBe(true);
    expect(
      校验组说明落位(
        '样张.vue',
        "<template><YeMei :biao-ti=\"取文案('账号', '标题')\" /><p>{{ 取文案('账号', '检索组说明') }}</p></template>",
      ),
    ).toEqual([]);
  });

  it('统计图表数据点提示给出字段名、数值与单位', async () => {
    vi.mocked(接口.消息统计).mockResolvedValue({
      lie_biao: [{ 日期: '2026-09-20', 发送方: 'yonghu', 数量: 3 }],
    });
    const { default: 统计图表页 } = await import('../views/统计图表.vue');
    const 包装 = mount(统计图表页, { global: { plugins: [await 建路由('/tong-ji')] } });
    await flushPromises();
    const 提示 = 包装.findAll('title').map((项) => 项.text());
    expect(提示).toHaveLength(1);
    expect(提示[0]).toContain(取文案('统计', '日期列'));
    expect(提示[0]).toContain('2026-09-20');
    expect(提示[0]).toContain(取文案('统计', '数量列'));
    expect(提示[0]).toContain(`3 ${取文案('统计', '数量单位')}`);
    expect(提示[0]).not.toBe('2026-09-20：3');
  });

  it('审核运营的互斥输入组带组标题与组说明，审计日志的数值行按字段名口径渲染', async () => {
    vi.mocked(接口.审计保留).mockResolvedValue({ zong_shu: 7 });
    const { default: 审计日志页 } = await import('../views/审计日志.vue');
    const 审计包装 = mount(审计日志页);
    await flushPromises();
    expect(审计包装.text()).toContain(`${取文案('审计', '保留标题')}：7`);

    const { default: 审核运营页 } = await import('../views/审核运营.vue');
    const 包装 = mount(审核运营页);
    await flushPromises();
    const 文本 = 包装.text();
    expect(文本).toContain(取文案('审核', '评审标题'));
    expect(文本).toContain(取文案('审核', '评审组说明'));
    expect(文本).toContain(取文案('审核', '处理多项按钮'));
    expect(文本).not.toContain(`${取文案('审核', '初审按钮')}·${取文案('审核', '复审按钮')}`);
    expect(包装.findAll('input[placeholder]')).toHaveLength(0);
  });
});

const 快照原码形态 = /[a-z]+_[a-z]+/;
const 快照未收录形态 = /未收录（[^）]*）/g;

type 快照页签项 = { 键: '思考记录标签' | '记忆标签' | '对话摘要标签' | '关键事件标签' | '接管记录标签' | '评估标签'; 表: 表名 };

const 快照页签清单: readonly 快照页签项[] = [
  { 键: '思考记录标签', 表: '思考记录' },
  { 键: '记忆标签', 表: '记忆' },
  { 键: '对话摘要标签', 表: '对话摘要' },
  { 键: '关键事件标签', 表: '关键事件' },
  { 键: '接管记录标签', 表: '接管记录' },
  { 键: '评估标签', 表: '评估' },
];

function 喂透传行(表: 表名, 行: Record<string, unknown>[]): void {
  const 结果 = { 行, 分页: undefined };
  if (表 === '思考记录') {
    vi.mocked(接口.思考记录列表).mockResolvedValue(结果);
  } else if (表 === '记忆') {
    vi.mocked(接口.记忆列表).mockResolvedValue(结果);
  } else if (表 === '对话摘要') {
    vi.mocked(接口.对话摘要列表).mockResolvedValue(结果);
  } else if (表 === '关键事件') {
    vi.mocked(接口.关键事件列表).mockResolvedValue(结果);
  } else if (表 === '接管记录') {
    vi.mocked(接口.接管记录列表).mockResolvedValue(结果);
  } else if (表 === '评估') {
    vi.mocked(接口.评估列表).mockResolvedValue(结果);
  } else {
    throw new Error(`页签快照守卫读不到表 ${表} 的列表接口`);
  }
}

function 样张值(项: 列): unknown {
  if (项.渲染 === '时间') {
    return '2026-09-20 10:00:00';
  }
  if (项.渲染 === '数字') {
    return 7;
  }
  if (项.渲染 === '徽标' || 项.渲染 === '枚举') {
    return 'guan-li-yuan-shen-du-si-kao';
  }
  if (项.渲染 === '编号') {
    return '0a1b2c3d';
  }
  return 'an-li-wen-ben';
}

function 样张行(表: 表名): Record<string, unknown> {
  const 行: Record<string, unknown> = { nei_bu_ji_deng_jian: 'yi_wu_zhuang_tai' };
  for (const 项 of 列定义登记[表] as readonly 列[]) {
    if (项.数据键 !== null) {
      行[项.数据键] = 样张值(项);
    }
  }
  return 行;
}

async function 打开快照页签(项: 快照页签项): Promise<{ 快照: string; 行: Record<string, unknown>; 文本: string }> {
  for (const 其他 of 快照页签清单) {
    喂透传行(其他.表, []);
  }
  const 行 = 样张行(项.表);
  喂透传行(项.表, [行]);
  const { default: 思考链路 } = await import('../views/思考链.vue');
  const 包装 = mount(思考链路);
  await flushPromises();
  const 标签 = 取文案('思考', 项.键);
  const 按钮 = 包装.findAll('button').find((候选) => 候选.text() === 标签);
  expect(按钮, `找不到页签按钮 ${标签}`).toBeTruthy();
  await 按钮?.trigger('click');
  await flushPromises();
  return { 快照: 包装.find('pre').element.textContent ?? '', 行, 文本: 包装.text() };
}

describe('FP-14 S-04 图例与卡片标题不同名', () => {
  it('统计图表的图例只出序列名，不与任何图题同名', () => {
    expect(扫描图例同名(读('src/views/统计图表.vue'))).toEqual([]);
    const { default: 页 } = { default: undefined } as unknown as { default: never };
    void 页;
  });

  it('挂载后图例文字是序列名「消息数」，卡片标题仍是「消息趋势」', async () => {
    vi.mocked(接口.消息统计).mockResolvedValue({
      lie_biao: [{ 日期: '2026-09-20', 发送方: 'yonghu', 数量: 3 }],
    });
    const { default: 页 } = await import('../views/统计图表.vue');
    const 包装 = mount(页, { global: { plugins: [await 建路由('/tong-ji')] } });
    await flushPromises();
    const 图例 = 包装.findAll('.图注 span').map((项) => 项.text());
    expect(图例).toEqual([取文案('统计', '消息数')]);
    expect(包装.findAll('.图题').map((项) => 项.text())).toContain(取文案('统计', '消息趋势'));
    expect(取文案('统计', '消息数')).not.toBe(取文案('统计', '消息趋势'));
  });

  it('反证：图例照抄卡片标题必须判红', () => {
    const 样张 = `
      <template>
        <h3 class="图题">{{ 统计文案.消息趋势 }}</h3>
        <p class="图注"><span><i /><span>{{ 统计文案.消息趋势 }}</span></span></p>
      </template>`;
    expect(扫描图例同名(样张)).toEqual(['图例序列名与卡片标题同为「消息趋势」，图例必须说明是哪一条序列']);
    expect(扫描图例同名(读('src/views/统计图表.vue'))).toEqual([]);
  });
});

describe('FP-14 B-04 枚举筛选一律下拉', () => {
  it('九个视图里凡标签等于枚举列表头显示名的筛选，都是 select 且选项取自映射', () => {
    const 命中 = 落地视图清单.flatMap((路径) => 扫描筛选控件(读(路径)));
    const 标签全集 = [...new Set(命中.map((项) => 项.标签))].sort();
    expect(标签全集).toEqual(
      ['事件', '事件类型', '发送方', '封禁级别', '管理角色', '严重程度', '状态', '审计分类'].sort(),
    );
    expect(命中.length).toBeGreaterThanOrEqual(8);
    expect(落地视图清单.flatMap((路径) => 扫描枚举下拉(读(路径)))).toEqual([]);
    expect(命中.filter((项) => 项.控件 !== 'select')).toEqual([]);
    expect(枚举表头集().has('申诉状态')).toBe(true);
    expect(枚举表头集().has('状态')).toBe(true);
    expect(枚举表头集().has('审核状态')).toBe(false);
  });

  it('审计日志/审核运营/思考链 的下拉选项全部来自枚举映射与通用.全部，穷尽该族值域', async () => {
    const { default: 审计页 } = await import('../views/审计日志.vue');
    const 审计 = mount(审计页, { global: { plugins: [await 建路由('/shen-ji')] } });
    await flushPromises();
    expect(审计.find('[data-testid="lv-xuan-shi-jian-lei-xing"]').findAll('option').map((项) => 项.text())).toEqual([
      通用文案.全部,
      ...审计事件选项.map((项) => 项.文案),
    ]);
    expect(审计.find('[data-testid="lv-xuan-shen-ji-fen-lei"]').findAll('option').map((项) => 项.text())).toEqual([
      通用文案.全部,
      ...审计分类选项.map((项) => 项.文案),
    ]);
    expect(审计事件选项.length).toBe(19);
    expect(审计分类选项.length).toBe(1);

    const { default: 审核页 } = await import('../views/审核运营.vue');
    const 审核 = mount(审核页, { global: { plugins: [await 建路由('/shen-he')] } });
    await flushPromises();
    expect(审核.find('[data-testid="lv-xuan-shen-he-zhuang-tai"]').findAll('option').map((项) => 项.text())).toEqual([
      通用文案.全部,
      ...审核状态选项.map((项) => 项.文案),
    ]);
    expect(审核状态选项.length).toBe(10);

    const { default: 思考页 } = await import('../views/思考链.vue');
    const 思考 = mount(思考页, { global: { plugins: [await 建路由('/si-kao-lian')] } });
    await flushPromises();
    const 事件下拉 = 思考.find('[data-testid="lv-xuan-si-kao-shi-jian"]');
    expect(事件下拉.findAll('option').map((项) => 项.text())).toEqual([
      通用文案.全部,
      ...思考事件选项.map((项) => 项.文案),
    ]);
    expect(思考事件选项.map((项) => 项.文案)).toEqual(['深度思考', '构建过程', '隐藏信息', '好感度变化']);
    expect(思考.findAll('select')).toHaveLength(1);
  });

  it('协议不变：下拉提交的仍是原参数名与拼音码，空值仍不上送', async () => {
    const { default: 审计页 } = await import('../views/审计日志.vue');
    const 审计 = mount(审计页, { global: { plugins: [await 建路由('/shen-ji')] } });
    await flushPromises();
    expect(末次入参(vi.mocked(接口.审计日志))).toMatchObject({ shi_jian_lei_xing: undefined, lei_xing: undefined });
    await 审计.find('[data-testid="lv-xuan-shi-jian-lei-xing"]').setValue('guan_li_deng_lu');
    await 审计.find('[data-testid="lv-xuan-shen-ji-fen-lei"]').setValue('guan_li');
    await 审计.find('.按钮主').trigger('click');
    await flushPromises();
    expect(末次入参(vi.mocked(接口.审计日志))).toMatchObject({
      shi_jian_lei_xing: 'guan_li_deng_lu',
      lei_xing: 'guan_li',
      yong_hu_id: undefined,
    });

    const { default: 审核页 } = await import('../views/审核运营.vue');
    const 审核 = mount(审核页, { global: { plugins: [await 建路由('/shen-he')] } });
    await flushPromises();
    const 记录 = vi.mocked(接口.审核列表);
    await 审核.find('[data-testid="lv-xuan-shen-he-zhuang-tai"]').setValue('dai_yi_shen');
    await 审核.find('.按钮主').trigger('click');
    await flushPromises();
    expect(末次入参(记录)).toBe('ju_bao');
    expect(末次入参(记录, 1)).toMatchObject({ zhuang_tai: 'dai_yi_shen' });

    const { default: 思考页 } = await import('../views/思考链.vue');
    const 思考 = mount(思考页, { global: { plugins: [await 建路由('/si-kao-lian')] } });
    await flushPromises();
    await 思考.find('[data-testid="lv-xuan-si-kao-shi-jian"]').setValue('guan-li-yuan-yin-cang-xin-xi');
    await 思考.find('.按钮主').trigger('click');
    await flushPromises();
    expect(末次入参(vi.mocked(接口.思考记录列表))).toMatchObject({
      shi_jian: 'guan-li-yuan-yin-cang-xin-xi',
      yong_hu_id: undefined,
    });
  });

  it('反证：枚举筛选写成自由文本输入、选项自打中文，都必须判红', () => {
    const 自由文本 = `
      <template>
        <label class="字段">
          {{ 审计文案.事件类型列 }}
          <input v-model="事件类型" class="输入">
        </label>
      </template>`;
    expect(扫描筛选控件(自由文本).map((项) => `${项.标签}:${项.控件}`)).toEqual(['事件类型:input']);
    expect(扫描枚举下拉(自由文本).length).toBeGreaterThan(0);
    const 自打选项 = `
      <template>
        <label class="字段">
          {{ 审计文案.事件类型列 }}
          <select v-model="事件类型" class="选择"><option value="a">甲</option></select>
        </label>
      </template>`;
    expect(扫描枚举下拉(自打选项).length).toBeGreaterThan(0);
    const 合规 = `
      <template>
        <label class="字段">
          {{ 审计文案.事件类型列 }}
          <select v-model="事件类型" class="选择">
            <option value="">{{ 通用文案.全部 }}</option>
            <option v-for="项 in 审计事件选项" :key="项.值" :value="项.值">{{ 项.文案 }}</option>
          </select>
        </label>
      </template>`;
    const 带导入 = `<script setup>import { 审计事件选项 } from '../枚举映射/审计事件';</script>` + 合规;
    expect(扫描枚举下拉(带导入)).toEqual([]);
  });
});

describe('FP-11 思考链快照按登记列全量渲染', () => {
  it('六个页签都登记了快照表，接管记录用新称', () => {
    expect(快照页签清单).toHaveLength(6);
    expect(new Set(快照页签清单.map((项) => 项.表)).size).toBe(6);
    expect(取文案('思考', '接管记录标签')).toBe('接管记录');
  });

  for (const 项 of 快照页签清单) {
    it(`${项.表} 页签快照逐列输出「中文列名：值」，行数与登记列数相等`, async () => {
      const { 快照, 行 } = await 打开快照页签(项);
      const 登记列 = (列定义登记[项.表] as readonly 列[]).filter((列项) => 列项.数据键 !== null);
      const 条目 = 快照.split('\n').filter((行项) => 行项.length > 0);
      expect(条目.length, `快照行数与登记列数不符：${快照}`).toBe(登记列.length);
      for (const 列项 of 登记列) {
        expect(快照).toContain(`${表头文本(列项)}：${单元格文本(列项, 行)}`);
      }
      const 净快照 = 快照.replace(快照未收录形态, '');
      expect(快照原码形态.test(净快照), `快照含裸拼音列名或未映射原码：${快照}`).toBe(false);
      expect(净快照).not.toContain('nei_bu_ji_deng_jian');
      expect(净快照).not.toContain('yi_wu_zhuang_tai');
    });
  }

  it('接管记录 快照里 管理员编号 与 结束时间 都可见，页面上不出现旧称', async () => {
    const { 快照, 文本 } = await 打开快照页签({ 键: '接管记录标签', 表: '接管记录' });
    expect(快照).toContain(`${取文案('思考', '管理员编号标签')}：0a1b2c3d`);
    expect(快照).toContain(`${取文案('思考', '结束时间列')}：2026-09-20 10:00:00`);
    expect(文本).toContain(取文案('思考', '接管记录标签'));
    expect(文本).not.toContain('夺舍');
  });

  it('评估 快照把七个评估维度全部上屏', async () => {
    const { 快照 } = await 打开快照页签({ 键: '评估标签', 表: '评估' });
    for (const 键 of [
      '话题引导列',
      '情感共鸣列',
      '幽默感列',
      '体贴度列',
      '节奏把控列',
      '总体评价列',
      '改进建议列',
    ] as const) {
      expect(快照).toContain(取文案('思考', 键));
    }
  });

  it('对话摘要 快照同时给出摘要与后加的正文列、更新时间与素材锚点时间', async () => {
    const { 快照 } = await 打开快照页签({ 键: '对话摘要标签', 表: '对话摘要' });
    for (const 键 of ['摘要标签', '摘要内容列', '概括消息数列', '更新时间列', '素材锚点时间列'] as const) {
      expect(快照).toContain(取文案('思考', 键));
    }
  });

  it('思考记录 快照给出 用户编号、角色编号、来源、阶段、类型、轮次与原文长度', async () => {
    const { 快照 } = await 打开快照页签({ 键: '思考记录标签', 表: '思考记录' });
    expect(快照).toContain(取文案('账号', '用户编号'));
    expect(快照).toContain(取文案('账号', '角色编号标签'));
    for (const 键 of [
      '原文长度列',
      '轮次列',
      '来源列',
      '阶段列',
      '类型列',
    ] as const) {
      expect(快照).toContain(取文案('思考', 键));
    }
    expect(快照).toContain(`${取文案('思考', '事件标签')}：${取文案('思考', '事件深度思考')}`);
    expect(快照).not.toContain('guan-li-yuan-shen-du-si-kao');
  });

  it('整列为空的行仍逐列输出，空值一律走 通用.未记录', async () => {
    const 空行: Record<string, unknown> = { nei_bu_ji_deng_jian: 'yi_wu_zhuang_tai' };
    for (const 列项 of 列定义登记.接管记录 as readonly 列[]) {
      if (列项.数据键 !== null) {
        空行[列项.数据键] = null;
      }
    }
    for (const 其他 of 快照页签清单) {
      喂透传行(其他.表, []);
    }
    喂透传行('接管记录', [空行]);
    const { default: 思考链路 } = await import('../views/思考链.vue');
    const 包装 = mount(思考链路);
    await flushPromises();
    const 按钮 = 包装.findAll('button').find((候选) => 候选.text() === 取文案('思考', '接管记录标签'));
    await 按钮?.trigger('click');
    await flushPromises();
    const 快照 = 包装.find('pre').element.textContent ?? '';
    const 条目 = 快照.split('\n').filter((行项) => 行项.length > 0);
    expect(条目).toHaveLength((列定义登记.接管记录 as readonly 列[]).length);
    for (const 行项 of 条目) {
      expect(行项).toContain(取文案('通用', '未记录'));
    }
    expect(快照).not.toContain('null');
    expect(快照).not.toContain('undefined');
    expect(快照).not.toContain('yi_wu_zhuang_tai');
  });

  it('反证：登记列少一列快照就少一行，直出原码必须被扫出', async () => {
    const 登记面 = 列定义登记 as unknown as Record<表名, readonly 列[]>;
    const 原清单 = 登记面.接管记录;
    const 完整 = await 打开快照页签({ 键: '接管记录标签', 表: '接管记录' });
    const 完整条目 = 完整.快照.split('\n').filter((行项) => 行项.length > 0);
    try {
      登记面.接管记录 = 原清单.slice(1);
      const 缺列 = await 打开快照页签({ 键: '接管记录标签', 表: '接管记录' });
      expect(缺列.快照).not.toContain(取文案('思考', '记录编号列'));
      expect(缺列.快照.split('\n').filter((行项) => 行项.length > 0)).toHaveLength(完整条目.length - 1);
    } finally {
      登记面.接管记录 = 原清单;
    }
    expect(完整条目).toHaveLength(原清单.length);
    expect(快照原码形态.test('接管记录：guan_li_duo_she')).toBe(true);
    expect(快照原码形态.test('接管记录：未收录（guan_li_duo_she）'.replace(快照未收录形态, ''))).toBe(false);
  });
});

const 主题样式表 = 读('src/主题.css');

const 外壳源 = 读('src/App.vue');

const 登录页源 = 读('src/views/登录页.vue');

function 样式清单(): { 路径: string; 文本: string }[] {
  const 出: { 路径: string; 文本: string }[] = [];
  function 走(目录: string): void {
    for (const 名 of fs.readdirSync(目录)) {
      const 全 = `${目录}/${名}`;
      if (fs.statSync(全).isDirectory()) {
        走(全);
        continue;
      }
      if (名.endsWith('.css')) {
        出.push({ 路径: 全, 文本: fs.readFileSync(全, 'utf8') });
      } else if (名.endsWith('.vue')) {
        for (const 段 of fs.readFileSync(全, 'utf8').match(/<style[\s\S]*?<\/style>/g) ?? []) {
          出.push({ 路径: 全, 文本: 段 });
        }
      }
    }
  }
  走('src');
  return 出;
}

function 规则块(样式: string, 选择器: string): string {
  const 起 = 样式.indexOf(`${选择器} {`);
  if (起 < 0) {
    return '';
  }
  const 止 = 样式.indexOf('}', 起);
  return 样式.slice(起 + 选择器.length + 2, 止);
}

function 令牌表(块: string): Record<string, string> {
  const 表: Record<string, string> = {};
  for (const 匹 of 块.matchAll(/--([^\s:]+):\s*([^;]+);/g)) {
    表[匹[1]] = 匹[2].trim();
  }
  return 表;
}

function 十六进制(值: string): number[] | null {
  const 匹 = /^#([0-9a-f]{6})$/i.exec(值);
  if (匹 === null) {
    return null;
  }
  const 数 = Number.parseInt(匹[1], 16);
  return [(数 >> 16) & 255, (数 >> 8) & 255, 数 & 255];
}

function 通道差(a: number[], b: number[]): number {
  return a.reduce((和, 值, 序) => 和 + Math.abs(值 - b[序]), 0);
}

function 色方案缺陷(样式: string): string[] {
  const 缺: string[] = [];
  if (!规则块(样式, ':root').includes('color-scheme: light')) {
    缺.push(':root 未声明 color-scheme: light，浅色档会被系统强制暗化');
  }
  if (!规则块(样式, '.dark').includes('color-scheme: dark')) {
    缺.push('.dark 未声明 color-scheme: dark，深色下原生控件走 UA 亮色');
  }
  if (样式.indexOf('.dark {') < 样式.indexOf(':root {')) {
    缺.push('.dark 块排在 :root 之前，同特异度下深色档不生效');
  }
  return 缺;
}

function 焦点反馈缺陷(样式: string): string[] {
  const 缺: string[] = [];
  const 撤环 = 样式.match(/outline\s*:\s*(none|0)\b|outline-style\s*:\s*none/g) ?? [];
  if (撤环.length > 0) {
    缺.push(`撤焦点环命中 ${撤环.length} 处：${撤环.join(' / ')}`);
  }
  if (!/:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--印\)/.test(样式)) {
    缺.push('缺 :focus-visible 的 2px 印色焦点环');
  }
  return 缺;
}

function 滚动条缺陷(样式: string): string[] {
  const 缺: string[] = [];
  const 宽匹 = /--滚动条宽:\s*(\d+(?:\.\d+)?)px/.exec(样式);
  if (宽匹 === null || Number(宽匹[1]) < 7) {
    缺.push(`滚动条条宽 ${宽匹?.[1] ?? '未声明'}px 不足 7px`);
  }
  const 档色: Record<string, string> = {};
  for (const 档 of ['thumb', 'track', 'corner']) {
    const 块 = 规则块(样式, `::-webkit-scrollbar-${档}`);
    const 匹 = /background:\s*var\(--([^)]+)\)/.exec(块);
    if (匹 === null) {
      缺.push(`::-webkit-scrollbar-${档} 未走令牌底色`);
      continue;
    }
    档色[档] = 匹[1];
  }
  const 档名 = Object.values(档色);
  if (new Set(档名).size !== 3) {
    缺.push(`thumb/track/corner 三档令牌必须互不相同，实为 ${档名.join(',')}`);
  }
  const 光标档: Record<string, string> = {
    '::-webkit-scrollbar': 'default',
    '::-webkit-scrollbar-thumb': 'grab',
    '::-webkit-scrollbar-track': 'pointer',
  };
  for (const [选择器, 值] of Object.entries(光标档)) {
    if (!规则块(样式, 选择器).includes(`cursor: ${值}`)) {
      缺.push(`${选择器} 未声明 cursor: ${值}`);
    }
  }
  if (/scrollbar-width/.test(样式.replace(/@supports not selector\(::-webkit-scrollbar\) \{[\s\S]*?\n\}/, ''))) {
    缺.push('scrollbar-width 泄漏到 @supports 分支之外，Chromium 会放弃自绘档');
  }
  const 分支 = /@supports not selector\(::-webkit-scrollbar\) \{([\s\S]*?)\n\}/.exec(样式)?.[1] ?? '';
  if (!分支.includes('scrollbar-width: thin') || !分支.includes('scrollbar-color: var(--淡墨) var(--面二)')) {
    缺.push('缺 Firefox 标准档分支（scrollbar-width + scrollbar-color）');
  }
  for (const 档 of ['浅', '深']) {
    const 令牌 = 令牌表(规则块(样式, 档 === '浅' ? ':root' : '.dark'));
    const 取色 = (名: string) => 十六进制(令牌[名] ?? '');
    const 底 = 取色(档色['corner'] ?? '');
    const 轨 = 取色(档色['track'] ?? '');
    const 块 = 取色(档色['thumb'] ?? '');
    if (!底 || !轨 || !块) {
      缺.push(`${档}色档取不到 thumb/track/底色`);
      continue;
    }
    const 组 = [通道差(块, 轨), 通道差(块, 底), 通道差(轨, 底)];
    if (组.some((值) => 值 < 24)) {
      缺.push(`${档}色档 thumb/track/底色两两通道差 ${组.join('/')} 存在 <24 的档`);
    }
  }
  return 缺;
}

function 原生外观缺陷(样式: string): string[] {
  const 缺: string[] = [];
  const 撤原生 = [...样式.matchAll(/([^{}]+)\{[^}]*appearance:\s*none/g)];
  if (撤原生.length === 0) {
    缺.push('无任何 appearance: none，深色下文本框可被 UA 刷成亮底');
  }
  for (const 匹 of 撤原生) {
    const 选择器组 = 匹[1].trim();
    if (!/^input\./.test(选择器组) || /select|\.选择/.test(选择器组)) {
      缺.push(`appearance:none 的选择器组「${选择器组}」不全是 input 前缀，会抹掉 select 的原生下拉箭头`);
    }
  }
  if (!/input\.输入:not\(\[type='number'\], \[type='datetime-local'\]\)/.test(样式)) {
    缺.push('未把 number 与 datetime-local 排除在 appearance:none 之外，原生步进器与日历指示器会被抹掉');
  }
  const 填块 = 规则块(样式, 'input.输入:-webkit-autofill');
  if (!填块.includes('-webkit-text-fill-color') || !/transition:\s*background-color/.test(填块)) {
    缺.push('缺 :-webkit-autofill 兜底（文本色 + 背景色长过渡）');
  }
  return 缺;
}

function 登录居中缺陷(栅块: string, 正文块: string, 登录块: string, 模板: string): string[] {
  const 缺: string[] = [];
  if (!栅块.includes('margin: auto')) {
    缺.push('.登录栅 不再吃网格自动边距，卡片不会相对视口居中');
  }
  if (!/width:\s*100%/.test(栅块)) {
    缺.push('.登录栅 缺 width:100%，自动边距会让卡片从满宽塌成内容宽');
  }
  if (/align-items:\s*start/.test(栅块)) {
    缺.push('.登录栅 仍写着 align-items:start，卡片贴顶');
  }
  if (/\dv[hw]/.test(栅块)) {
    缺.push('.登录栅 仍用 vh 外边距凑居中');
  }
  if (!登录块.includes('min-height: 100dvh') || !登录块.includes('display: grid')) {
    缺.push('.外壳.登录页 .正文 未撑出 100dvh 网格容器');
  }
  if (!登录块.includes('padding-bottom: var(--正文距纵)')) {
    缺.push('登录态正文上下内边距不同源，卡片中心会偏 (底-上)/2');
  }
  if (!正文块.includes('--正文距纵: clamp(20px, 4vw, 44px)') || !正文块.includes('padding: var(--正文距纵) clamp(16px, 4vw, 40px) 72px')) {
    缺.push('.正文 内边距未收敛到 --正文距纵 单源');
  }
  if (!正文块.includes('min-height: 100dvh') && !登录块.includes('min-height: 100dvh')) {
    缺.push('外壳/正文仍用 100vh，移动端 URL 栏会把卡片顶离视口中心');
  }
  if (!/是否登录页 \? '登录页'/.test(模板) || !/登录仓库\.已登录 && !是否登录页 \? '有栏'/.test(模板)) {
    缺.push('外壳类名分流丢了登录页档或有栏档');
  }
  return 缺;
}

describe('FP-17 管理端等价修复：色方案/焦点环/滚动条/居中单一真源', () => {
  it('主题.css 双档声明 color-scheme，深色档排在浅色档之后', () => {
    expect(色方案缺陷(主题样式表)).toEqual([]);
  });

  it('全库零 outline:none，文本控件吃 :focus-visible 的 2px 印色焦点环', () => {
    expect(焦点反馈缺陷(主题样式表)).toEqual([]);
    for (const 项 of 样式清单()) {
      expect(项.文本, `${项.路径} 又自己撤了焦点环`).not.toMatch(/outline\s*:\s*(none|0)\b|outline-style\s*:\s*none/);
    }
    expect(主题样式表).not.toMatch(/cursor:\s*text/);
  });

  it('滚动条只在 主题.css 一处定义，三档令牌可分辨、条宽 ≥7px、带光标与 Firefox 分支', () => {
    let 定义数 = 0;
    for (const 项 of 样式清单()) {
      定义数 += (项.文本.match(/::-webkit-scrollbar(?:-\w+)?\s*\{/g) ?? []).length;
      if (项.文本.includes('::-webkit-scrollbar')) {
        expect(项.路径, '滚动条规则不得散进视图').toBe('src/主题.css');
      }
    }
    expect(定义数).toBeGreaterThanOrEqual(4);
    expect(滚动条缺陷(主题样式表)).toEqual([]);
  });

  it('文本输入关原生外观但不碰 select，且有 autofill 兜底', () => {
    expect(原生外观缺陷(主题样式表)).toEqual([]);
    expect(模板段(读('src/views/账号列表.vue'))).toMatch(/<select[\s\S]{0,140}?class="输入"/);
  });

  it('登录页靠网格自动边距相对视口居中，正文上下内边距同源且不用 100vh', () => {
    expect(
      登录居中缺陷(规则块(登录页源, '.登录栅'), 规则块(外壳源, '.正文'), 规则块(外壳源, '.外壳.登录页 .正文'), 模板段(外壳源)),
    ).toEqual([]);
  });

  it('反证：条宽压到 4px、撤掉 Firefox 分支、把 outline:none 塞回输入框、appearance 抹到 select 上，都必须判红', () => {
    expect(滚动条缺陷(主题样式表.replace('--滚动条宽: 10px', '--滚动条宽: 4px'))).not.toEqual([]);
    expect(滚动条缺陷(主题样式表.replace(/@supports not selector\(::-webkit-scrollbar\) \{[\s\S]*?\n\}/, ''))).not.toEqual([]);
    expect(滚动条缺陷(主题样式表.replace('cursor: grab', 'cursor: text'))).not.toEqual([]);
    expect(滚动条缺陷(主题样式表.replace('background: var(--淡墨);\n  border-radius', 'background: var(--面二);\n  border-radius'))).not.toEqual([]);
    expect(焦点反馈缺陷(`${主题样式表}\n.输入:focus{outline:none}`)).not.toEqual([]);
    expect(原生外观缺陷(主题样式表.replace('input.输入:not', '.输入:not'))).not.toEqual([]);
    expect(色方案缺陷(主题样式表.replace('color-scheme: dark', 'color-scheme: light'))).not.toEqual([]);
    expect(色方案缺陷(主题样式表.replace(':root {', '.dark {'))).not.toEqual([]);
    const 栅 = 规则块(登录页源, '.登录栅');
    const 文 = 规则块(外壳源, '.正文');
    const 登 = 规则块(外壳源, '.外壳.登录页 .正文');
    const 壳模板 = 模板段(外壳源);
    expect(登录居中缺陷(栅.replace('width: 100%;', ''), 文, 登, 壳模板)).not.toEqual([]);
    expect(登录居中缺陷(栅.replace('margin: auto', 'margin: 24px auto 0'), 文, 登, 壳模板)).not.toEqual([]);
    expect(登录居中缺陷(栅.replace('margin: auto', 'margin: auto').replace('grid-template-columns: 1fr;', 'grid-template-columns: 1fr; align-items: start;'), 文, 登, 壳模板)).not.toEqual([]);
    expect(登录居中缺陷(栅, 文, 登.replace('padding-bottom: var(--正文距纵)', 'padding-bottom: 72px'), 壳模板)).not.toEqual([]);
    expect(登录居中缺陷(栅, 文, 登.replace('min-height: 100dvh', 'min-height: 100vh'), 壳模板)).not.toEqual([]);
    expect(登录居中缺陷(栅, 文, 登, 壳模板.replace("是否登录页 ? '登录页' : ''", "''"))).not.toEqual([]);
  });
});
