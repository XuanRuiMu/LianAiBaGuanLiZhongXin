import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { 业务错误, 前端错误码 } from '../api/请求';
import { 审核初审, 审核复审, 审核列表, 审核新建, 审核多项处理 } from '../api/管理';

/** 与 src/api/管理.ts 的 审核路径段 同源；条目顺序即后端 注册目标 的登记顺序 */
const 已知目标类型: ReadonlyArray<readonly [string, string]> = [
  ['ju_bao', 'ju-bao'],
  ['gong_dan', 'gong-dan'],
  ['gong_gao', 'gong-gao'],
  ['huo_dong', 'huo-dong'],
  ['shi_yan', 'shi-yan'],
];

/** 五个入口共用同一张白名单，差别只在 URL 尾段 */
const 入口表: ReadonlyArray<{ 名: string; 调用: (目标类型: string) => Promise<unknown>; 尾段: string }> = [
  { 名: '审核列表', 调用: (目标类型) => 审核列表(目标类型, {}), 尾段: 'lie-biao' },
  { 名: '审核新建', 调用: (目标类型) => 审核新建(目标类型, { ming_cheng: 'ce' }), 尾段: 'xin-jian' },
  { 名: '审核初审', 调用: (目标类型) => 审核初审(目标类型, { mu_biao_id: 'ce', tong_guo: true }), 尾段: 'yi-shen' },
  { 名: '审核复审', 调用: (目标类型) => 审核复审(目标类型, { mu_biao_id: 'ce', tong_guo: true }), 尾段: 'er-shen' },
  {
    名: '审核多项处理',
    调用: (目标类型) => 审核多项处理(目标类型, { mu_biao_ids: ['ce'], lun_ci: 'yi_shen', tong_guo: true }),
    尾段: 'pi-liang',
  },
];

/** 恶意/非法形态：原值回落会把它们拼进 URL 路径段 */
const 非白名单目标: ReadonlyArray<{ 形态: string; 实参: unknown }> = [
  { 形态: '未登记的英文名', 实参: 'bu_shou' },
  { 形态: '路径穿越', 实参: '../x' },
  { 形态: '查询串注入', 实参: 'a?b=c' },
  { 形态: '空串', 实参: '' },
  { 形态: '纯空格', 实参: '   ' },
  { 形态: '原型链键名', 实参: 'toString' },
  { 形态: '数字', 实参: 42 },
  { 形态: 'null', 实参: null },
  { 形态: 'undefined', 实参: undefined },
  { 形态: '对象', 实参: {} },
];

function 假响应(): Response {
  return {
    ok: true,
    status: 200,
    headers: new Headers(),
    text: async () => '{"cheng_gong":true,"shu_ju":null}',
  } as unknown as Response;
}

/** 收拢一次调用真正发出去的请求地址；同步抛错与 Promise 拒绝都算「没发出去」 */
async function 抓请求记录(调用: () => unknown): Promise<string[]> {
  const 记录: string[] = [];
  const 原请求函数 = globalThis.fetch;
  globalThis.fetch = (async (地址: string): Promise<Response> => {
    记录.push(地址);
    return 假响应();
  }) as unknown as typeof fetch;
  try {
    const 结果 = 调用();
    if (结果 instanceof Promise) {
      await 结果.catch(() => undefined);
    }
  } catch {
    // 同步抛错同样是拒绝，按「未发起请求」结账
  } finally {
    globalThis.fetch = 原请求函数;
  }
  return 记录;
}

/** 把两种拒绝形态归一成一个错误对象：async 入口给 Promise 拒绝，审核列表 给同步抛错 */
async function 捕获(调用: () => unknown): Promise<unknown> {
  try {
    const 结果 = 调用();
    if (结果 instanceof Promise) {
      await 结果;
    }
    return undefined;
  } catch (错误) {
    return 错误;
  }
}

describe('审核目标类型白名单入口', () => {
  it('五个已知目标类型各五个入口都命中正确路径段', async () => {
    for (const [目标类型, 路径段] of 已知目标类型) {
      for (const 入口 of 入口表) {
        const 记录 = await 抓请求记录(() => 入口.调用(目标类型));
        expect(记录, `${入口.名}(${目标类型}) 一次请求都没发出去`).toHaveLength(1);
        expect(记录[0], `${入口.名}(${目标类型})`).toContain(`/api/guan-li/${路径段}-${入口.尾段}`);
      }
    }
  });

  it('未知目标类型一律抛业务错误，原值一个字都不进 URL', async () => {
    for (const 入口 of 入口表) {
      for (const 项 of 非白名单目标) {
        const 错误 = await 捕获(() => 入口.调用(项.实参 as string));
        expect(错误, `${入口.名} 放行了${项.形态}：${String(项.实参)}`).toBeInstanceOf(业务错误);
        expect((错误 as 业务错误).cuo_wu_ma, `${入口.名}(${项.形态})`).toBe(前端错误码.本地校验);
        expect(await 抓请求记录(() => 入口.调用(项.实参 as string)), `${入口.名}(${项.形态})`).toEqual([]);
      }
    }
  });

  it('拒绝时错误消息带得出结构化展示，不留内部原文', async () => {
    for (const 入口 of 入口表) {
      const 错误 = await 捕获(() => 入口.调用('a?b=c'));
      expect(错误).toBeInstanceOf(业务错误);
      const 业务 = 错误 as 业务错误;
      expect(业务.message.length).toBeGreaterThan(0);
      expect(业务.message).not.toMatch(/a\?b=c|\.\.\//);
      expect(业务.retryable).toBe(false);
    }
  });

  it('审核运营页只会把白名单内的目标类型传进接口', () => {
    const 源 = fs.readFileSync('src/views/审核运营.vue', 'utf8');
    const 标签列块 = /const 标签列[\s\S]*?\];/.exec(源)?.[0] ?? '';
    const 值清单 = [...标签列块.matchAll(/值:\s*'([^']+)'/g)].map((匹) => 匹[1]).sort();
    expect(值清单).toEqual(已知目标类型.map(([键]) => 键).sort());
    expect(/const 当前标签 = ref<目标类型名>\('([^']+)'\);/.exec(源)?.[1]).toBe('ju_bao');
  });
});

const 输入视图清单 = [
  'src/views/登录页.vue',
  'src/views/账号列表.vue',
  'src/views/聊天记录.vue',
  'src/views/思考链.vue',
  'src/views/封禁管理.vue',
  'src/views/审计日志.vue',
  'src/views/统计图表.vue',
  'src/views/审核运营.vue',
];

/** 自由文本 = 无 type 或 type 取文本类；datetime-local/number 由浏览器格式与 min/max 收口，maxlength 对它们无效 */
const 自由文本类型 = new Set(['text', 'tel', 'password', 'email', 'search', 'url']);

const 无长度上限豁免: ReadonlyArray<{ 视图: string; 绑定: string; 原因: string }> = [
  {
    视图: 'src/views/审核运营.vue',
    绑定: '被举报内容',
    原因: '后端只过 取可选字符串（校验.ts:91），021 迁移里 被举报内容ID 就是 TEXT 无长度约束，无上限可对齐',
  },
];

function 模板段(源: string): string {
  const 起 = 源.indexOf('<template');
  const 止 = 源.lastIndexOf('</template>');
  return 起 >= 0 && 止 > 起 ? 源.slice(起, 止) : '';
}

function 输入标签清单(源: string): string[] {
  return [...模板段(源).matchAll(/<input\b[^>]*>/g)].map((匹) => 匹[0]);
}

function 是自由文本输入(标签: string): boolean {
  const 类型 = /\btype\s*=\s*["']([^"']+)["']/.exec(标签)?.[1] ?? 'text';
  return 自由文本类型.has(类型);
}

function 取绑定(标签: string): string {
  return /v-model(?:\.number)?="([^"]+)"/.exec(标签)?.[1] ?? '';
}

function 有长度上限(标签: string): boolean {
  return /maxlength\s*=/.test(标签) || /:maxlength=/.test(标签);
}

function 扫长度上限违例(视图: string, 源: string): string[] {
  const 违例: string[] = [];
  for (const 标签 of 输入标签清单(源).filter(是自由文本输入)) {
    const 绑定 = 取绑定(标签);
    if (无长度上限豁免.some((项) => 项.视图 === 视图 && 项.绑定 === 绑定)) {
      continue;
    }
    if (!有长度上限(标签)) {
      违例.push(`${视图} 的 ${绑定 === '' ? 标签.trim() : 绑定} 缺 maxlength`);
    }
  }
  return 违例;
}

describe('外部输入长度上限静态守卫', () => {
  it('八个视图的自由文本输入全部带 maxlength，豁免只有有出处的那一处', () => {
    expect(无长度上限豁免).toHaveLength(1);
    const 违例: string[] = [];
    for (const 视图 of 输入视图清单) {
      违例.push(...扫长度上限违例(视图, fs.readFileSync(视图, 'utf8')));
    }
    expect(违例).toEqual([]);
  });

  it('统计天数的上下界与后端 校验天数(上限=90) 对齐', () => {
    const 源 = fs.readFileSync('src/views/统计图表.vue', 'utf8');
    const 天数 = 输入标签清单(源).find((标签) => 取绑定(标签) === '天数') ?? '';
    expect(天数).toMatch(/type="number"/);
    expect(天数).toMatch(/min="1"/);
    expect(天数).toMatch(/max="90"/);
  });

  it('反证：摘掉 maxlength 或把绑定改成未登记项都必须判红', () => {
    const 合规 = "<template><label><input v-model=\"关键词\" class=\"输入\" maxlength=\"50\"></label></template>";
    const 缺上限 = "<template><label><input v-model=\"关键词\" class=\"输入\"></label></template>";
    expect(扫长度上限违例('样张.vue', 合规)).toEqual([]);
    expect(扫长度上限违例('样张.vue', 缺上限)).toEqual(['样张.vue 的 关键词 缺 maxlength']);
    const 占位豁免 = '<template><label><input v-model="用户编号" class="输入"></label></template>';
    expect(扫长度上限违例('src/views/审核运营.vue', 占位豁免)).toEqual(['src/views/审核运营.vue 的 用户编号 缺 maxlength']);
  });
});
