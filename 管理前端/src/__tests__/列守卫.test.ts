import { beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';
import { flushPromises, mount } from '@vue/test-utils';
import { 取文案, 文案 } from '../文案/聚合';
import {
  单元格文本,
  单元格类,
  列定义登记,
  歧义数据键,
  内部键显示名,
  敏感键形态,
  命名值文本,
  取列,
  取列映射,
  表头文本,
  键显示名,
  type 列,
  type 值域依赖,
  type 表名,
} from '../列定义';
import { 取徽标文案 } from '../枚举映射';
import { 时间展示格式 } from '../配置';
import { 通用文案 } from '../文案/通用';
import { 使用登录仓库 } from '../stores/登录';
import { 路由表 } from '../router';

const 列定义源路径 = 'src/列定义.ts';
const 登记面 = 列定义登记 as unknown as Record<表名, readonly 列[]>;

function 读(路径: string): string {
  return fs.readFileSync(路径, 'utf8');
}

const 后端思考源 = '../管理后端/src/路由/思考.ts';

const 透传表对前端表: Readonly<Record<string, 表名>> = {
  记忆: '记忆',
  对话摘要: '对话摘要',
  关键事件: '关键事件',
  夺舍日志: '接管记录',
  评估: '评估',
};

function 取列名(清单: string): string[] {
  const 结果: string[] = [];
  for (const 匹配 of 清单.matchAll(/(\sAS\s)?"([^"]+)"/g)) {
    if (匹配[1] === undefined) {
      结果.push(匹配[2]);
    } else {
      结果[结果.length - 1] = 匹配[2];
    }
  }
  return 结果;
}

function 后端透传列清单(): Array<{ 表: string; 列清单: string[] }> {
  const 源 = 读(后端思考源);
  if (/SELECT \* FROM "\$\{表\}"/.test(源)) {
    throw new Error('思考.ts 仍用 SELECT * 透传列，快照列没有契约出处');
  }
  const 页签 = [...源.matchAll(/思考查询\(请求, 响应, '([^']+)',\s*([^\s,]+),/g)];
  if (页签.length < 5) {
    throw new Error(`思考.ts 只解析出 ${页签.length} 个透传页签，少于五个`);
  }
  return 页签.map((匹配) => {
    const 常量 = new RegExp(String.raw`const ${匹配[2]} =\s*'([^']+)'`).exec(源);
    if (!常量) {
      throw new Error(`思考.ts 里取不到 ${匹配[2]} 的列清单`);
    }
    const 列清单 = 取列名(常量[1]);
    if (列清单.length === 0) {
      throw new Error(`${匹配[2]} 的列清单解析为空`);
    }
    return { 表: 匹配[1], 列清单 };
  });
}

function 后端思考记录列清单(): string[] {
  const 源 = 读(后端思考源);
  const 命中 = [...源.matchAll(/SELECT([^;]*?)FROM "思考记录"/g)].filter(
    (匹配) => !匹配[1].trim().startsWith('COUNT(') && 匹配[1].includes('"摘要"'),
  );
  if (命中.length !== 1) {
    throw new Error(`思考.ts 的 思考记录 列表查询命中 ${命中.length} 份，快照列无出处`);
  }
  return 取列名(命中[0][1]);
}

function 登记列(表: 表名): string[] {
  return (列定义登记[表] as readonly 列[])
    .filter((项) => 项.数据键 !== null)
    .map((项) => 项.数据键 as string);
}

function 双向差集(后端: readonly string[], 前端: readonly string[]): string[] {
  const 违例: string[] = [];
  const 缺 = 后端.filter((名) => !前端.includes(名));
  const 多 = 前端.filter((名) => !后端.includes(名));
  if (缺.length > 0) {
    违例.push(`未渲染后端返回列：${缺.join('、')}`);
  }
  if (多.length > 0) {
    违例.push(`渲染了后端不返回的列：${多.join('、')}`);
  }
  return 违例;
}

function 取联合成员(声明: string): string[] {
  const 命中 = new RegExp(String.raw`export type ${声明} =([^;]+);`).exec(读(列定义源路径));
  if (!命中) {
    throw new Error(`列定义.ts 里找不到 ${声明} 的联合声明，列守卫无法执行`);
  }
  return [...命中[1].matchAll(/'([^']+)'/g)].map((项) => 项[1]);
}

function 全部列(): Array<{ 表: 表名; 项: 列 }> {
  return (Object.keys(列定义登记) as 表名[]).flatMap((表) => [...登记面[表]].map((项) => ({ 表, 项 })));
}

function 表头可解析(): string[] {
  const 违例: string[] = [];
  for (const { 表, 项 } of 全部列()) {
    if (项.表头 === null) {
      continue;
    }
    const [分类, 键] = 项.表头;
    const 子表 = (文案 as unknown as Record<string, Record<string, string>>)[分类];
    const 文本 = 子表 === undefined ? undefined : 子表[String(键)];
    if (typeof 文本 !== 'string' || 文本.length === 0) {
      违例.push(`${表}.${String(项.数据键)} 的表头键 ${分类}.${String(键)} 在词典里取不到文本`);
    }
  }
  return 违例;
}

function 键冲突(): string[] {
  const 违例: string[] = [];
  for (const 表 of Object.keys(列定义登记) as 表名[]) {
    const 已见 = new Set<string>();
    for (const 项 of 登记面[表]) {
      if (项.数据键 === null) {
        continue;
      }
      if (已见.has(项.数据键)) {
        违例.push(`${表} 的数据键 ${项.数据键} 重复声明`);
      }
      已见.add(项.数据键);
    }
    if (已见.size === 0) {
      违例.push(`${表} 未声明任何后端数据键`);
    }
  }
  return 违例;
}

function 解析表头键(项: 列): string | null {
  return 项.表头 === null ? null : `${项.表头[0]}.${String(项.表头[1])}`;
}

function 表头键清单(): string[] {
  const 结果 = new Set<string>();
  for (const 表 of Object.keys(列定义登记) as 表名[]) {
    for (const 项 of 登记面[表]) {
      const 表头 = 解析表头键(项);
      if (表头 !== null) {
        结果.add(表头);
      }
    }
  }
  return [...结果];
}

function 表头同值冲突(键清单: readonly string[]): string[] {
  const 按显示名 = new Map<string, string[]>();
  for (const 路径 of 键清单) {
    const [分类, 键] = 路径.split('.');
    const 子表 = (文案 as unknown as Record<string, Record<string, string>>)[分类 as string];
    const 文本 = 子表 === undefined ? `缺失分类${分类}` : 子表[键 as string] ?? `取不到${键}`;
    按显示名.set(文本, [...(按显示名.get(文本) ?? []), 路径]);
  }
  const 违例: string[] = [];
  for (const [文本, 路径清单] of 按显示名) {
    if (路径清单.length > 1) {
      违例.push(`表头显示名「${文本}」有 ${路径清单.length} 个词典键：${[...路径清单].sort().join('、')}`);
    }
  }
  return 违例;
}

function 渲染器合法(): string[] {
  const 允许 = 取联合成员('渲染方式');
  const 违例: string[] = [];
  for (const { 表, 项 } of 全部列()) {
    if (!允许.includes(项.渲染)) {
      违例.push(`${表}.${String(项.数据键)} 用了封闭枚举外的渲染器 ${项.渲染}`);
    }
    if ((项.渲染 === '徽标' || 项.渲染 === '枚举') && 项.族 === null) {
      违例.push(`${表}.${String(项.数据键)} 声明为 ${项.渲染} 却没挂枚举族`);
    }
    if (项.渲染 !== '徽标' && 项.渲染 !== '枚举' && 项.族 !== null) {
      违例.push(`${表}.${String(项.数据键)} 非徽标列却带了枚举族`);
    }
    if (项.渲染 === '插槽' && 项.插槽 === null) {
      违例.push(`${表} 的插槽列没有插槽名`);
    }
  }
  return 违例;
}

describe('FP-03 列定义单源守卫', () => {
  it('每张表的列在唯一声明处成对给出数据键、表头键与渲染器', () => {
    expect((Object.keys(列定义登记) as 表名[]).length).toBeGreaterThanOrEqual(9);
    expect(全部列().length).toBeGreaterThan(40);
    expect(表头可解析()).toEqual([]);
    expect(键冲突()).toEqual([]);
    expect(渲染器合法()).toEqual([]);
  });

  it('同一表头显示名只有一个词典键，跨类同值冗余原子已收口', () => {
    const 键清单 = 表头键清单();
    expect(键清单.length).toBeGreaterThanOrEqual(30);
    expect(表头同值冲突(键清单)).toEqual([]);
  });

  it('反证：同一显示名登记成两个表头键必须判红', () => {
    expect(表头同值冲突(['封禁.原因标签', '封禁.原因列'])).toEqual([
      '表头显示名「原因」有 2 个词典键：封禁.原因列、封禁.原因标签',
    ]);
    expect(表头同值冲突(['账号.昵称', '封禁.原因列'])).toEqual([]);
    const 原清单 = 登记面.审核留痕;
    登记面.审核留痕 = [
      { 数据键: '目标ID', 表头: ['封禁', '原因标签'], 渲染: '文本', 族: null, 插槽: null, 测试标识: null, 值域依赖: null },
      { 数据键: '创建时间', 表头: ['封禁', '不存在的表头键'], 渲染: '文本', 族: null, 插槽: null, 测试标识: null, 值域依赖: null },
    ];
    try {
      expect(表头同值冲突(表头键清单()).filter((项) => 项.includes('「原因」'))).toHaveLength(1);
      expect(表头键清单()).toContain('封禁.原因标签');
      expect(表头可解析().length).toBeGreaterThan(0);
    } finally {
      登记面.审核留痕 = 原清单;
    }
    expect(表头同值冲突(表头键清单())).toEqual([]);
    expect(表头可解析()).toEqual([]);
  });

  it('渲染器是封闭枚举，且九种渲染器全部有列在用', () => {
    const 允许 = 取联合成员('渲染方式');
    expect(new Set(允许).size).toBe(9);
    const 用上 = [...new Set(全部列().map(({ 项 }) => 项.渲染))];
    expect(用上.length).toBe(允许.length);
    for (const 种 of 允许) {
      expect(用上).toContain(种);
    }
  });

  it('空单元格统一口径为未记录，整表空态才是暂无数据', () => {
    expect(单元格文本(取列('审计日志', '详情'), {})).toBe(取文案('通用', '未记录'));
    expect(单元格文本(取列('封禁记录', '原因'), { 原因: null })).toBe(取文案('通用', '未记录'));
    expect(单元格文本(取列('封禁记录', '原因'), { 原因: '' })).toBe(取文案('通用', '未记录'));
    expect(单元格文本(取列('消息统计', '数量'), { 数量: 0 })).toBe('0');
    expect(单元格文本(取列('账号列表', '昵称'), { 昵称: '甲' })).toBe('甲');
    expect(取文案('通用', '暂无数据')).not.toBe(取文案('通用', '未记录'));
    expect(单元格文本(取列('账号列表', '封禁级别'), { 封禁级别: 'feng_jin_1_fen' })).toBe(取文案('封禁', '级别1分钟'));
  });

  it('思考链六个页签的登记列与后端显式列清单双向相等，不留未上屏列', () => {
    const 后端 = 后端透传列清单();
    const 违例: string[] = [];
    for (const 项 of 后端) {
      const 前端表: 表名 | undefined = 透传表对前端表[项.表];
      if (前端表 === undefined) {
        违例.push(`后端透传表 ${项.表} 没有前端登记`);
        continue;
      }
      违例.push(...双向差集(项.列清单, 登记列(前端表)).map((条) => `${前端表}：${条}`));
    }
    for (const 表 of Object.keys(透传表对前端表)) {
      if (!后端.some((项) => 项.表 === 表)) {
        违例.push(`出处登记里的 ${表} 已从 思考.ts 消失`);
      }
    }
    违例.push(...双向差集(后端思考记录列清单(), 登记列('思考记录')).map((条) => `思考记录：${条}`));
    expect(违例).toEqual([]);
    expect(登记列('接管记录')).toContain('管理员ID');
    expect(登记列('思考记录')).toHaveLength(后端思考记录列清单().length);
  });

  it('反证：快照少一列或多一列都要被双向差集判红', () => {
    const 后端 = ['ID', '用户ID', '创建时间'];
    expect(双向差集(后端, 后端)).toEqual([]);
    expect(双向差集(后端, ['ID', '用户ID'])).toEqual(['未渲染后端返回列：创建时间']);
    expect(双向差集(后端, [...后端, '手机号'])).toEqual(['渲染了后端不返回的列：手机号']);
    expect(取列名('"ID", LEFT("内容", 200) AS "摘要", f."级别" AS "封禁级别"')).toEqual(['ID', '摘要', '封禁级别']);
  });

  it('取列与取列映射读同一份声明，视图不再复制字面量', () => {
    const 映射 = 取列映射('账号列表');
    expect(取列('账号列表', '昵称')).toBe(映射.昵称);
    expect(表头文本(映射.昵称)).toBe(取文案('账号', '昵称'));
    expect(映射.封禁级别.渲染).toBe('徽标');
    expect(取列('账号封禁', '用户ID').渲染).toBe('编号');
    expect(取列('账号封禁', 'ID' as never).数据键).toBeNull();
  });

  it('反证：表头错键、漏族、漏数据键、越界渲染器全部判红', () => {
    const 样张表: 表名 = '审核留痕';
    const 原清单 = 登记面[样张表];
    try {
      登记面[样张表] = [{ 数据键: '目标ID', 表头: ['账号', '不存在的表头键'], 渲染: '文本', 族: null, 插槽: null, 测试标识: null, 值域依赖: null }];
      expect(表头可解析().length).toBeGreaterThan(0);
      登记面[样张表] = [{ 数据键: '目标ID', 表头: null, 渲染: '徽标', 族: null, 插槽: null, 测试标识: null, 值域依赖: null }];
      expect(渲染器合法().some((项) => 项.includes('没挂枚举族'))).toBe(true);
      登记面[样张表] = [{ 数据键: null, 表头: null, 渲染: '自由发挥' as never, 族: null, 插槽: null, 测试标识: null, 值域依赖: null }];
      expect(渲染器合法().some((项) => 项.includes('封闭枚举外'))).toBe(true);
      登记面[样张表] = [];
      expect(键冲突().some((项) => 项.includes('未声明任何后端数据键'))).toBe(true);
      登记面[样张表] = 原清单.slice(1);
      expect(全部列().some(({ 表, 项 }) => 表 === 样张表 && 项.数据键 === '目标ID')).toBe(false);
    } finally {
      登记面[样张表] = 原清单;
    }
    expect(表头可解析()).toEqual([]);
    expect(键冲突()).toEqual([]);
    expect(渲染器合法()).toEqual([]);
    expect(全部列().some(({ 表, 项 }) => 表 === 样张表 && 项.数据键 === '目标ID')).toBe(true);
  });
});

vi.mock('../api/管理', () => ({
  账号列表: vi.fn().mockResolvedValue({ 行: [], 分页: undefined }),
  授予角色: vi.fn(),
  回收角色: vi.fn(),
  接管角色: vi.fn(),
  结束接管: vi.fn(),
  我的身份: vi.fn().mockResolvedValue({ yong_hu_id: 'yi', jiao_se: 'chao_guan', neng_li: ['cha_kan'] }),
}));

vi.mock('../api/会话', () => ({
  我的身份: vi.fn().mockResolvedValue({ yong_hu_id: 'yi', jiao_se: 'chao_guan', neng_li: ['cha_kan'] }),
}));

async function 挂账号列表(行: Record<string, unknown>[]) {
  const 接口 = await import('../api/管理');
  vi.mocked(接口.账号列表).mockResolvedValue({ 行, 分页: undefined });
  const 路由器: Router = createRouter({ history: createMemoryHistory(), routes: 路由表 });
  await 路由器.push('/zhang-hao');
  const { default: 页 } = await import('../views/账号列表.vue');
  const 包装 = mount(页, { global: { plugins: [路由器] } });
  await flushPromises();
  return 包装;
}

beforeEach(() => {
  setActivePinia(createPinia());
  window.sessionStorage.clear();
  vi.clearAllMocks();
  使用登录仓库().设置身份('chao_guan', ['cha_kan']);
});

describe('FP-03 L-08 无封禁记录账号语义回归', () => {
  it('封禁级别为 null 的行渲染绿色「正常」而不是红色「未记录」', async () => {
    const 包装 = await 挂账号列表([
      { ID: 'wu', 昵称: '无封禁', 手机号: '13800000000', 角色: null, 封禁级别: null, 创建时间: '2026-09-20 10:00:00' },
    ]);
    const 徽标 = 包装.findAll('.徽标');
    expect(徽标.length).toBe(2);
    const 级别徽标 = 徽标.find((项) => 项.text() === 取文案('封禁', '级别正常'));
    expect(级别徽标?.classes()).toContain('安');
    expect(级别徽标?.classes()).not.toContain('危');
    expect(包装.text()).not.toContain(取文案('通用', '未记录'));
    expect(徽标.find((项) => 项.text() === 取文案('账号', '角色无'))?.classes()).toContain('墨');
  });

  it('封禁中的行才是红色徽标，域外原码走黄色且不显示「正常」', async () => {
    const 包装 = await 挂账号列表([
      { ID: 'feng', 昵称: '永久封', 手机号: '13800000001', 角色: 'chao_guan', 封禁级别: 'yong_feng', 创建时间: '2026-09-20 10:00:00' },
      { ID: 'yi', 昵称: '域外码', 手机号: '13800000002', 角色: 'yun_ying', 封禁级别: 'yi_wu_zhong', 创建时间: '2026-09-20 10:00:00' },
    ]);
    const 文本 = 包装.text();
    expect(文本).toContain(取文案('封禁', '级别永久'));
    expect(文本).toContain('未收录（yi_wu_zhong）');
    const 徽标类 = 包装.findAll('.徽标').map((项) => 项.classes().join(' '));
    expect(徽标类).toContain('徽标 危');
    expect(徽标类.filter((项) => 项 === '徽标 警')).toHaveLength(3);
    expect(徽标类.some((项) => 项 === '徽标 安')).toBe(false);
  });
});

describe('FP-28a 账号详情性别列改吃 `默认性别`', () => {
  const 性别列 = 取列('账号详情', '默认性别');

  it('male/female 出中文显示名，未设置出未记录，域外写法出未收录原码', () => {
    expect(性别列.渲染).toBe('枚举');
    expect(性别列.族).toBe('性别');
    expect(单元格文本(性别列, { 默认性别: 'male' })).toBe(取文案('账号', '性别男'));
    expect(单元格文本(性别列, { 默认性别: 'female' })).toBe(取文案('账号', '性别女'));
    expect(单元格文本(性别列, { 默认性别: null })).toBe(通用文案.未记录);
    expect(单元格文本(性别列, { 默认性别: '' })).toBe(通用文案.未记录);
    expect(单元格文本(性别列, { 默认性别: 'nv' })).toBe(`${取文案('通用', '未收录')}（nv）`);
  });

  it('反证：`性别` 不再是账号详情的数据键，nan/nv 那套值域也不被本列接受', () => {
    expect(登记列('账号详情')).toContain('默认性别');
    expect(登记列('账号详情')).not.toContain('性别');
    expect(取徽标文案('性别', 'nan')).toBe(`${取文案('通用', '未收录')}（nan）`);
    expect(取徽标文案('性别', 'nv')).toBe(`${取文案('通用', '未收录')}（nv）`);
    expect(取徽标文案('性别', 'male')).toBe(取文案('账号', '性别男'));
    expect(取徽标文案('性别', 'female')).toBe(取文案('账号', '性别女'));
    const 原清单 = 登记面.账号详情;
    try {
      登记面.账号详情 = 原清单.map((项) => (项.数据键 === '默认性别' ? { ...项, 族: null } : 项));
      expect(渲染器合法().some((项) => 项.includes('没挂枚举族'))).toBe(true);
    } finally {
      登记面.账号详情 = 原清单;
    }
    expect(渲染器合法()).toEqual([]);
  });
});

function 值域依赖列清单(): Array<{ 表: 表名; 项: 列; 依赖: 值域依赖 }> {
  return 全部列()
    .filter(({ 项 }) => 项.值域依赖 !== null)
    .map(({ 表, 项 }) => ({ 表, 项, 依赖: 项.值域依赖 as 值域依赖 }));
}

function 依赖声明合法(): string[] {
  const 违例: string[] = [];
  for (const { 表, 项, 依赖 } of 值域依赖列清单()) {
    const 依赖列 = [...登记面[表]].find((候选) => 候选.数据键 === 依赖.依赖列);
    if (依赖列 === undefined) {
      违例.push(`${表}.${String(项.数据键)} 依赖的 ${依赖.依赖列} 不是本表登记列`);
      continue;
    }
    if (依赖列.渲染 !== '徽标' && 依赖列.渲染 !== '枚举') {
      违例.push(`${表}.${String(项.数据键)} 的依赖列 ${依赖.依赖列} 不是枚举列，无法按码判定`);
    }
    if (依赖列.族 !== 依赖.族) {
      违例.push(`${表}.${String(项.数据键)} 的依赖族 ${String(依赖.族)} 与依赖列实族 ${String(依赖列.族)} 不一致`);
    }
    for (const 码 of 依赖.不适用码) {
      if (取徽标文案(依赖.族, 码).startsWith('未收录')) {
        违例.push(`${表}.${String(项.数据键)} 的不适用码 ${码} 不在 ${依赖.族} 值域内`);
      }
    }
    if (项.渲染 === '徽标' || 项.渲染 === '枚举') {
      违例.push(`${表}.${String(项.数据键)} 自身是枚举列，不该再挂值域依赖`);
    }
  }
  return 违例;
}

const 应登记值域依赖: ReadonlyArray<{ 表: 表名; 数据键: string; 依赖列: string; 族: string; 码: string }> = [
  { 表: '账号详情', 数据键: '账号解封时间', 依赖列: '封禁级别', 族: '封禁级别', 码: 'zheng_chang' },
];

function 同行空态冲突(表: 表名, 行: Record<string, unknown>): string[] {
  const 违例: string[] = [];
  for (const 期望 of 应登记值域依赖.filter((候选) => 候选.表 === 表)) {
    const 项 = [...登记面[表]].find((候选) => 候选.数据键 === 期望.数据键) as 列;
    const 依赖 = { 依赖列: 期望.依赖列, 族: 期望.族, 不适用码: [期望.码] } as 值域依赖;
    const 现值 = 取徽标文案(依赖.族, 行[依赖.依赖列]);
    const 不适用 = 依赖.不适用码.some((码) => 现值 === 取徽标文案(依赖.族, 码));
    const 本列 = 单元格文本(项, 行 as never);
    if (不适用 && 本列 === 通用文案.未记录) {
      违例.push(
        `${表}.${String(项.数据键)} 与同行「${现值}」冲突：显示未记录读起来像数据丢失，应走「${通用文案.无适用值}」`,
      );
    }
    if (!不适用 && 本列 === 通用文案.无适用值) {
      违例.push(`${表}.${String(项.数据键)} 在依赖列＝${现值} 时本应有值，却出了「${通用文案.无适用值}」`);
    }
  }
  return 违例;
}

function 取后端字段显示名(): Record<string, string> {
  const 源 = fs.readFileSync('../管理后端/src/文案.ts', 'utf8');
  const 命中 = /export const 字段显示名: Record<string, string> = \{([\s\S]*?)\n\};/.exec(源);
  if (命中 === null) {
    throw new Error('管理后端 文案.ts 的 字段显示名 解析失败，内部键跨端守卫拒绝空跑');
  }
  const 结果: Record<string, string> = {};
  for (const 项 of 命中[1].matchAll(/([a-z_]+): '([^']+)'/g)) {
    结果[项[1]] = 项[2];
  }
  if (Object.keys(结果).length < 30) {
    throw new Error(`后端 字段显示名 只解析出 ${Object.keys(结果).length} 条，跨端守卫拒绝空跑`);
  }
  return 结果;
}

describe('FP-14 S-02 空态三形态互斥', () => {
  it('三种空态形态各有其指，互不替代', () => {
    expect(通用文案.无适用值).toBe('\u2014');
    expect(new Set([通用文案.无适用值, 通用文案.未记录, 通用文案.暂无数据]).size).toBe(3);
  });

  it('值域依赖只在 列定义.ts 登记一处，视图与枚举映射不再各写一份中性形态', () => {
    const 清单 = 值域依赖列清单();
    expect(清单.length).toBeGreaterThanOrEqual(1);
    expect(
      清单.some(({ 表, 项, 依赖 }) =>
        表 === '账号详情' && 项.数据键 === '账号解封时间' && 依赖.依赖列 === '封禁级别' && 依赖.不适用码.includes('zheng_chang'),
      ),
    ).toBe(true);
    expect(依赖声明合法()).toEqual([]);
    const 命中: string[] = [];
    for (const 路径 of ['src/views/账号详情.vue', 'src/views/账号列表.vue', 'src/views/封禁管理.vue', 'src/components/ShuJuBiaoGe.vue']) {
      if (fs.readFileSync(路径, 'utf8').includes('\u2014')) {
        命中.push(路径);
      }
    }
    for (const 名 of fs.readdirSync('src/枚举映射')) {
      if (fs.readFileSync(`src/枚举映射/${名}`, 'utf8').includes('\u2014')) {
        命中.push(`src/枚举映射/${名}`);
      }
    }
    expect(命中).toEqual([]);
  });

  it('未封禁行：封禁级别绿色「正常」而解封时间出中性形态，不再同时出现「未记录」', () => {
    const 未封禁 = { 封禁级别: null, 账号解封时间: null };
    expect(单元格文本(取列('账号详情', '封禁级别'), 未封禁 as never)).toBe('正常');
    expect(单元格文本(取列('账号详情', '账号解封时间'), 未封禁 as never)).toBe(通用文案.无适用值);
    expect(同行空态冲突('账号详情', 未封禁)).toEqual([]);
    expect(同行空态冲突('账号详情', { 封禁级别: 'zheng_chang', 账号解封时间: null })).toEqual([]);
    const 封禁中 = { 封禁级别: 'yong_feng', 账号解封时间: '2026-09-30 12:00:00' };
    expect(单元格文本(取列('账号详情', '账号解封时间'), 封禁中 as never)).toBe('2026-09-30 12:00:00');
    expect(同行空态冲突('账号详情', 封禁中)).toEqual([]);
    const 全空行: Record<string, unknown> = {};
    for (const 项 of 登记面.账号详情) {
      if (项.数据键 !== null) {
        全空行[项.数据键] = null;
      }
    }
    expect(同行空态冲突('账号详情', 全空行)).toEqual([]);
    expect(同行空态冲突('账号封禁', { 级别: null, 申诉状态: null, 最后原因: null })).toEqual([]);
  });

  it('值域依赖登记面与 应登记清单双向相等，不留未登记的冲突列', () => {
    const 登记 = 值域依赖列清单().map(({ 表, 项, 依赖 }) => `${表}.${String(项.数据键)}←${依赖.依赖列}=${依赖.不适用码.join('/')}`);
    const 期望 = 应登记值域依赖.map((项) => `${项.表}.${项.数据键}←${项.依赖列}=${项.码}`);
    expect(登记.slice().sort()).toEqual(期望.slice().sort());
  });

  it('反证：摘掉值域依赖登记就回到「正常＋未记录」自相矛盾，必须判红', () => {
    const 原清单 = 登记面.账号详情;
    try {
      登记面.账号详情 = [...原清单].map((项) => (项.数据键 === '账号解封时间' ? { ...项, 值域依赖: null } : 项));
      expect(单元格文本(取列('账号详情', '账号解封时间'), { 封禁级别: null, 账号解封时间: null } as never)).toBe(通用文案.未记录);
      expect(同行空态冲突('账号详情', { 封禁级别: null, 账号解封时间: null })).toEqual([
        '账号详情.账号解封时间 与同行「正常」冲突：显示未记录读起来像数据丢失，应走「—」',
      ]);
      expect(值域依赖列清单()).toEqual([]);
    } finally {
      登记面.账号详情 = 原清单;
    }
    expect(值域依赖列清单().length).toBeGreaterThan(0);
    expect(同行空态冲突('账号详情', { 封禁级别: null, 账号解封时间: null })).toEqual([]);
    const 原清单二 = 登记面.审核留痕;
    try {
      登记面.审核留痕 = [
        {
          数据键: '目标ID',
          表头: ['账号', '用户编号'],
          渲染: '时间',
          族: null,
          插槽: null,
          测试标识: null,
          值域依赖: { 依赖列: '创建时间', 族: '封禁级别', 不适用码: ['zheng_chang'] },
        },
      ] as never;
      expect(依赖声明合法().some((项) => 项.includes('不是本表登记列'))).toBe(true);
      登记面.审核留痕 = [
        {
          数据键: '目标ID',
          表头: ['账号', '用户编号'],
          渲染: '时间',
          族: null,
          插槽: null,
          测试标识: null,
          值域依赖: { 依赖列: '目标ID', 族: '封禁级别', 不适用码: ['yi_wu_zhong_ji_bie'] },
        },
      ] as never;
      expect(依赖声明合法().some((项) => 项.includes('不在'))).toBe(true);
      登记面.审核留痕 = [
        {
          数据键: '目标ID',
          表头: ['账号', '用户编号'],
          渲染: '徽标',
          族: '封禁级别',
          插槽: null,
          测试标识: null,
          值域依赖: { 依赖列: '目标ID', 族: '封禁级别', 不适用码: ['zheng_chang'] },
        },
      ] as never;
      expect(依赖声明合法().some((项) => 项.includes('不该再挂'))).toBe(true);
    } finally {
      登记面.审核留痕 = 原清单二;
    }
    expect(依赖声明合法()).toEqual([]);
  });
});

describe('FP-14 B-03 结构体内部键显示化与敏感键掩码', () => {
  const 详情列 = 取列('审计日志', '详情');

  it('内部键不再裸 JSON 上屏：已登记键出中文显示名，未登记键保持原形但整段可读', () => {
    const 输出 = 单元格文本(详情列, { 详情: { de_fen: 7, li_you: 'shan_bie_ren' } });
    expect(输出).toBe('de_fen：7；li_you：shan_bie_ren');
    expect(输出).not.toContain('{');
    expect(输出).not.toContain('}');
    expect(输出).not.toContain('"');
    expect(命名值文本(表头文本(取列('审核留痕', '目标ID')), 'mu-biao-1')).toBe('目标编号：mu-biao-1');
    expect(单元格文本(详情列, { 详情: { 目标ID: 'mu-biao-1', 操作管理员: 'guan-li-1' } })).toBe(
      '目标编号：mu-biao-1；操作管理员：guan-li-1',
    );
    expect(单元格文本(详情列, { 详情: [1, 2] })).toBe('1、2');
    expect(单元格文本(详情列, { 详情: { 内: { 层: 'ceng' } } })).toBe('内：层：ceng');
    expect(单元格文本(详情列, { 详情: {} })).toBe(通用文案.未记录);
  });

  it('敏感语义键：键名与原值都不上屏，只出词典形态', () => {
    const 样张: Array<Record<string, unknown>> = [
      { mi_ma: 'abc123' },
      { password: 'abc123' },
      { access_token: 'abc123' },
      { api_key: 'abc123' },
      { mi_yao: 'abc123' },
      { 密钥: 'abc123' },
      { 登录密码: 'abc123' },
    ];
    for (const 详情 of 样张) {
      const 输出 = 单元格文本(详情列, { 详情 });
      expect(输出, JSON.stringify(详情)).not.toContain('abc123');
      expect(Object.keys(详情).some((键) => 输出.includes(键)), `${JSON.stringify(详情)} → ${输出}`).toBe(false);
      expect(输出).toContain(通用文案.已隐藏);
    }
    expect(单元格文本(详情列, { 详情: { mi_ma: 'abc123', de_fen: 7 } })).toBe('密码：已隐藏；de_fen：7');
  });

  it('反证：敏感键明文与裸 JSON 直出都必须判红；内部键显示名与后端 字段显示名 逐条同值', () => {
    const 后端 = 取后端字段显示名();
    for (const [键, 显示名] of Object.entries(内部键显示名)) {
      expect(后端[键], `内部键 ${键} 在后端 字段显示名 里没有出处`).toBe(显示名);
      expect(敏感键形态.test(键), 键).toBe(true);
    }
    expect(Object.keys(内部键显示名).length).toBeGreaterThanOrEqual(1);
    expect(后端.mi_ma).toBe('密码');
    expect(键显示名('mi_ma')).toBe('密码');
    expect(键显示名('she_bei')).toBe('she_bei');
    expect(歧义数据键).toEqual(expect.arrayContaining(['ID', '总数', '类型']));
    for (const 键 of 歧义数据键) {
      expect(键显示名(键), 键).toBe(键);
    }
    expect(键显示名('目标ID')).toBe('目标编号');
    expect(键显示名('内容')).toBe('内容');
    expect(单元格文本(详情列, { 详情: { mi_ma: 'abc' } })).not.toContain('mi_ma');
    expect(单元格文本(详情列, { 详情: { she_bei: 'chrome' } })).toBe('she_bei：chrome');
    expect(单元格文本(详情列, { 详情: { she_bei: 'chrome' } })).not.toMatch(/[{}"]/);
    const 裸样张 = JSON.stringify({ mi_ma: 'abc' });
    expect(裸样张).toContain('mi_ma');
    expect(裸样张).not.toBe(单元格文本(详情列, { 详情: { mi_ma: 'abc' } }));
  });
});

const 样式表 = 读('src/主题.css');

function 样式块(选择器: string): string {
  const 起 = 样式表.indexOf(`${选择器} {`);
  expect(起, `主题.css 里没有 ${选择器} 规则`).toBeGreaterThanOrEqual(0);
  const 止 = 样式表.indexOf('}', 起);
  return 样式表.slice(起 + 选择器.length + 2, 止);
}

function 时间骨架(文本: string): string {
  return 文本.replace(/\d/g, 'D');
}

const 展示格式骨架 = 时间展示格式
  .replace(/YYYY/g, 'DDDD')
  .replace(/MM|DD|HH|mm|ss/g, 'DD');

const 自写时间 = /toLocaleString|toISOString|getTimezoneOffset|getFullYear|getMonth|getHours|padStart\(/;

describe('FP-15 B-06 时间列单一口径', () => {
  it('格式常量只在 配置.ts 出一份，渲染只在 列定义.ts 的时间列实现一处', () => {
    expect(时间展示格式).toBe('YYYY-MM-DD HH:mm:ss');
    expect(读('src/配置.ts')).toMatch(/export const 时间展示格式 = 'YYYY-MM-DD HH:mm:ss'/);
    expect(读('src/列定义.ts')).toContain("from './配置'");
    const 命中: string[] = [];
    for (const 目录 of ['src/views', 'src/components']) {
      for (const 名 of fs.readdirSync(目录)) {
        if (自写时间.test(fs.readFileSync(`${目录}/${名}`, 'utf8'))) {
          命中.push(`${目录}/${名}`);
        }
      }
    }
    expect(命中, '视图或组件里又自己写了一份时间格式化').toEqual([]);
  });

  it('带时区的 ISO 一律折算成本地时区的 YYYY-MM-DD HH:mm:ss，不带时区的按墙上钟不位移', () => {
    const 列项 = 取列('账号列表', '创建时间');
    for (const 原值 of ['2026-09-21 03:04:05.120Z', '2026-09-19T02:03:04.500Z', '2026-09-21T03:04:05+08:00']) {
      const 出 = 单元格文本(列项, { 创建时间: 原值 });
      expect(出).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
      expect(出).not.toContain('T');
      expect(出).not.toContain('Z');
      expect(出).not.toContain('.120');
      expect(时间骨架(出)).toBe(展示格式骨架);
      expect(出).not.toBe(原值);
    }
    expect(单元格文本(列项, { 创建时间: '2026-09-20 10:00:00' })).toBe('2026-09-20 10:00:00');
    expect(单元格文本(列项, { 创建时间: '2026-09-20T10:00:00' })).toBe('2026-09-20 10:00:00');
    expect(时间骨架(单元格文本(列项, { 创建时间: '2026-09-20T10:00:00' }))).toBe(展示格式骨架);
  });

  it('只有日期没有时刻的列不受影响，空值仍走未记录，读不懂的值不编造', () => {
    const 列项 = 取列('注册统计', '日期');
    expect(单元格文本(列项, { 日期: '2026-09-21' })).toBe('2026-09-21');
    expect(单元格文本(取列('账号列表', '创建时间'), { 创建时间: null })).toBe(通用文案.未记录);
    expect(单元格文本(取列('账号列表', '创建时间'), { 创建时间: '未知' })).toBe('未知');
    expect(单元格文本(取列('账号列表', '创建时间'), { 创建时间: '2026-13-45 99:99:99' })).toBe('2026-13-45 99:99:99');
  });

  it('反证：裸 ISO 尾巴不得出现在真实表格与行快照里，摘掉时间渲染器就必须判红', async () => {
    const 包装 = await 挂账号列表([
      { ID: 'iso', 昵称: '混排', 手机号: '13800000009', 角色: null, 封禁级别: null, 创建时间: '2026-09-21 03:04:05.120Z' },
    ]);
    const 文本 = 包装.text();
    expect(文本).not.toContain('.120Z');
    expect(文本).not.toMatch(/2\d{3}-\d{2}-\d{2}T/);
    expect(文本).toMatch(/2\d{3}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);
    const 原渲染 = 登记面.账号列表;
    try {
      登记面.账号列表 = 原渲染.map((项) => (项.数据键 === '创建时间' ? { ...项, 渲染: '文本' as const } : 项));
      expect(单元格文本(取列('账号列表', '创建时间'), { 创建时间: '2026-09-21 03:04:05.120Z' })).toBe('2026-09-21 03:04:05.120Z');
    } finally {
      登记面.账号列表 = 原渲染;
    }
    expect(单元格文本(取列('账号列表', '创建时间'), { 创建时间: '2026-09-21 03:04:05.120Z' })).not.toContain('Z');
  });
});

describe('FP-15 B-01/B-07/B-08 版式缺陷锁', () => {
  it('纵向卡内不再把 150px 当高度基准：基准只在横向筛选行声明', () => {
    expect(样式块('.字段')).not.toMatch(/(^|[;\s])flex:/);
    expect(样式块('.字段')).toContain('min-width: 150px');
    expect(样式块('.账簿 > .字段')).toContain('flex: 1 1 150px');
    for (const 路径 of ['src/views/登录页.vue', 'src/views/封禁管理.vue']) {
      const 源 = 读(路径);
      expect(源).toMatch(/flex-direction: column/);
      expect(源).toContain('class="字段"');
    }
    for (const 表 of Object.keys(列定义登记) as 表名[]) {
      for (const 项 of 登记面[表]) {
        expect(单元格类(项), `${表} 的列类名只能取自 主题.css 声明过的钩子`).toMatch(/^(|数字|操作)$/);
      }
    }
  });

  it('操作列有统一间距与对齐，手机号/IP 形态的值不断行', () => {
    const 操作块 = 样式块('.账簿表 td.操作');
    expect(操作块).toContain('display: flex');
    expect(操作块).toContain('gap: 8px');
    expect(操作块).toContain('align-items: center');
    const 数字块 = 样式块('.账簿表 td.数字');
    expect(数字块).toContain('white-space: nowrap');
    expect(数字块).toContain('overflow-wrap: normal');
    expect(单元格类(取列('账号列表', 'ID'))).toBe('操作');
    expect(单元格类(登记面.账号封禁.find((项) => 项.渲染 === '插槽') as 列)).toBe('操作');
    expect(单元格类(取列('账号列表', '手机号'))).toBe('数字');
    expect(单元格类(取列('审计日志', 'IP'))).toBe('数字');
    expect(单元格类(取列('封禁记录', 'IP'))).toBe('数字');
    expect(单元格类(取列('审计日志', '详情'))).toBe('');
  });

  it('反证：操作列与数字列的钩子类名真的落到 td 上', async () => {
    const 包装 = await 挂账号列表([
      { ID: 'jdx', 昵称: '断行', 手机号: '138****0006', 角色: 'yun_ying', 封禁级别: null, 创建时间: '2026-09-20 10:00:00' },
    ]);
    const 操作格 = 包装.find('td.操作');
    expect(操作格.exists()).toBe(true);
    expect(操作格.find('a').exists()).toBe(true);
    expect(包装.findAll('td.数字')).toHaveLength(1);
    expect(包装.find('td.数字').text()).toBe('138****0006');
    expect(包装.findAll('td').filter((项) => 项.classes().includes('操作'))).toHaveLength(1);
    const 原渲染 = 登记面.账号列表;
    try {
      登记面.账号列表 = 原渲染.map((项) => (项.渲染 === '链接' ? { ...项, 渲染: '文本' as const, 插槽: null } : 项));
      expect(单元格类(取列('账号列表', 'ID'))).toBe('');
    } finally {
      登记面.账号列表 = 原渲染;
    }
  });
});
