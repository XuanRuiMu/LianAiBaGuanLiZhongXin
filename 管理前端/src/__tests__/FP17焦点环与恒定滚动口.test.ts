import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import App from '../App.vue';
import { 路由表 } from '../router';
import { 应用主题, 深色, 浅色 } from '../主题模式';

vi.mock('../api/会话', () => ({
  我的身份: vi.fn().mockResolvedValue({ jiao_se: 'chao_guan', neng_li: ['cha_kan'] }),
  管理登录: vi.fn(),
  刷新管理令牌: vi.fn().mockRejectedValue(new Error('wei_deng_lu')),
  管理登出: vi.fn().mockResolvedValue({ yi_tui_chu: true }),
}));

vi.mock('../api/探针', () => ({
  就绪检查: vi.fn().mockResolvedValue({ zhuang_tai: 'jiu_xu', jiu_xu: true, kui: [] }),
}));

/**
 * FP-17 管理端等价修复的层叠结果守卫，与 视图守卫.test.ts 的源码账本互补而不重复其判据。
 *
 * 取证分两层：jsdom 的真实层叠给出「哪条声明在这枚元素上胜出」，令牌再由同一份文档的计算样式
 * 解析成该档实值（jsdom 不做 var() 计算，故本文件自带 var 解析）。本文件不出现
 * 「CSS 源码包含某字符串」式断言；反证一律往文档里插真样式节点，让判据在层叠结果上重新变红。
 */

type 档名 = '浅' | '深';

type RGB = [number, number, number];

type 颜色 = { rgb: RGB; alpha: number };

type 规则 = { 路径: string; 选择器: string; 声明: Map<string, string> };

const 登录链样式 = ['src/主题.css', 'src/App.vue', 'src/views/登录页.vue'];

function 读(路径: string): string {
  return fs.readFileSync(路径, 'utf8');
}

function 去注释(源: string): string {
  return 源.replace(/\/\*[\s\S]*?\*\//g, '');
}

function 遍历样式目录(目录: string): { 路径: string; 文本: string }[] {
  const 出: { 路径: string; 文本: string }[] = [];
  for (const 名 of fs.readdirSync(目录)) {
    const 全 = `${目录}/${名}`;
    if (fs.statSync(全).isDirectory()) {
      出.push(...遍历样式目录(全));
      continue;
    }
    if (名.endsWith('.css')) {
      出.push({ 路径: 全, 文本: 读(全) });
    } else if (名.endsWith('.vue')) {
      for (const 段 of 读(全).match(/<style[\s\S]*?<\/style>/g) ?? []) {
        出.push({ 路径: 全, 文本: 段 });
      }
    }
  }
  return 出;
}

function 匹配右括号(文本: string, 左: number): number {
  let 深度 = 0;
  for (let 序 = 左; 序 < 文本.length; 序++) {
    if (文本[序] === '{') {
      深度++;
    } else if (文本[序] === '}' && --深度 === 0) {
      return 序;
    }
  }
  throw new Error('CSS 花括号不闭合');
}

/** 括号深度敏感切分：`:not([a], [b])` 与 `minmax(0, 1fr)` 都不许被劈开 */
function 切(文本: string, 分隔: string): string[] {
  const 出: string[] = [];
  let 深度 = 0;
  let 当前 = '';
  for (const 符 of 文本) {
    if (符 === '(' || 符 === '[') {
      深度++;
    } else if (符 === ')' || 符 === ']') {
      深度--;
    }
    if (符 === 分隔 && 深度 === 0) {
      出.push(当前.trim());
      当前 = '';
      continue;
    }
    当前 += 符;
  }
  出.push(当前.trim());
  return 出.filter((项) => 项.length > 0);
}

function 规则清单(路径: string, 源: string): 规则[] {
  const 出: 规则[] = [];
  function 走(文本: string, 前缀: string): void {
    let 序 = 0;
    while (序 < 文本.length) {
      const 开 = 文本.indexOf('{', 序);
      if (开 < 0) {
        return;
      }
      const 闭 = 匹配右括号(文本, 开);
      const 头 = 文本.slice(序, 开).trim();
      const 体 = 文本.slice(开 + 1, 闭);
      if (头.startsWith('@')) {
        if (/^@(media|supports|layer)\b/.test(头)) {
          走(体, `${头} ⇒ `);
        }
      } else {
        const 声明 = new Map<string, string>();
        for (const 条 of 切(体, ';')) {
          const 冒 = 条.indexOf(':');
          if (冒 > 0) {
            声明.set(条.slice(0, 冒).trim(), 条.slice(冒 + 1).trim());
          }
        }
        for (const 选择器 of 切(头, ',')) {
          出.push({ 路径, 选择器: `${前缀}${选择器}`, 声明 });
        }
      }
      序 = 闭 + 1;
    }
  }
  走(去注释(源), '');
  return 出;
}

function 全部规则(): 规则[] {
  return 遍历样式目录('src').flatMap((项) => 规则清单(项.路径, 项.文本));
}

function 计算值(元: Element, 属性: string): string {
  return window.getComputedStyle(元).getPropertyValue(属性).trim();
}

function 令牌原值(名: string, 环境: Element): string {
  const 值 = 计算值(环境, 名);
  if (值 === '') {
    throw new Error(`令牌 ${名} 在该档未声明，无法解析（不猜值）`);
  }
  return 值;
}

function 非空(值: string, 说明: string): string {
  expect(值, `${说明}：层叠结果里取值为空`).not.toBe('');
  return 值;
}

/** 把 var() 解析到不动点：jsdom 只给层叠命中的原文，档位实值只能在这里落地 */
function 解析令牌(文本: string, 环境: Element): string {
  let 当前 = 文本;
  for (let 轮 = 0; 轮 < 10; 轮++) {
    if (!当前.includes('var(')) {
      return 当前;
    }
    当前 = 当前.replace(/var\(\s*(--[^,\s)]+)\s*(?:,\s*([^()]*))?\)/g, (_全, 名: string, 后备?: string) => {
      const 原值 = 计算值(环境, 名);
      if (原值 === '') {
        if (后备 === undefined) {
          throw new Error(`令牌 ${名} 未声明且无后备，无法解析：${文本}`);
        }
        return 后备;
      }
      return 原值;
    });
  }
  throw new Error(`var() 嵌套超过 10 轮或成环：${文本}`);
}

function 令牌引用(文本: string): string[] {
  return [...文本.matchAll(/var\(\s*(--[^,\s)]+)/g)].map((匹) => 匹[1]);
}

function 解析色(值: string, 环境: Element): 颜色 {
  const 净 = 解析令牌(非空(值, '待解析的颜色'), 环境).trim();
  const 十六 = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(净);
  if (十六 !== null) {
    const 全 =
      十六[1].length === 3
        ? 十六[1]
            .split('')
            .map((符) => 符 + 符)
            .join('')
        : 十六[1];
    const 数 = Number.parseInt(全, 16);
    return { rgb: [(数 >> 16) & 255, (数 >> 8) & 255, 数 & 255], alpha: 1 };
  }
  const 函 = /^rgba?\(([^)]+)\)$/.exec(净);
  if (函 !== null) {
    const 部 = 函[1].split(',').map((项) => Number(项.trim()));
    if (部.length !== 3 && 部.length !== 4) {
      throw new Error(`无法解析颜色：${值}`);
    }
    return { rgb: [部[0], 部[1], 部[2]] as RGB, alpha: 部.length === 4 ? 部[3] : 1 };
  }
  throw new Error(`无法解析颜色：${值}`);
}

function 压合(前: 颜色, 后: RGB): RGB {
  return 前.rgb.map((通道, 序) => 前.alpha * 通道 + (1 - 前.alpha) * 后[序]) as RGB;
}

/** 亮条判定用最大通道差（与用户端 fp11 门禁同口径），色档可分辨用通道差之和（与 视图守卫 同口径） */
function 最大通道差(a: RGB, b: RGB): number {
  return Math.max(...a.map((通道, 序) => Math.abs(通道 - b[序])));
}

function 通道差和(a: RGB, b: RGB): number {
  return a.reduce((和, 通道, 序) => 和 + Math.abs(通道 - b[序]), 0);
}

function 相对亮度(色: RGB): number {
  const 线 = 色.map((通道) => {
    const 比 = 通道 / 255;
    return 比 <= 0.03928 ? 比 / 12.92 : ((比 + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * 线[0] + 0.7152 * 线[1] + 0.0722 * 线[2];
}

function 对比度(a: RGB, b: RGB): number {
  const 亮 = Math.max(相对亮度(a), 相对亮度(b));
  const 暗 = Math.min(相对亮度(a), 相对亮度(b));
  return (亮 + 0.05) / (暗 + 0.05);
}

function 像素(值: string, 属性: string, 环境: Element): number {
  const 数 = Number.parseFloat(解析令牌(非空(值, `${属性} 的取值`), 环境));
  if (!Number.isFinite(数)) {
    throw new Error(`层叠结果里 ${属性} 取不到像素值（实测 "${值}"）`);
  }
  return 数;
}

type 轮廓 = { 宽: number; 式样: string; 色: 颜色 };

/** outline 简写在 jsdom 里只能整条读回原文，这里按 `<宽> <式样> <色>` 拆解并解析令牌 */
function 拆解轮廓(文本: string, 环境: Element): 轮廓 {
  const 净 = 解析令牌(非空(文本, 'outline 简写'), 环境);
  const 部 = 切(净, ' ');
  const 式样 = 部.find((项) => ['none', 'solid', 'dashed', 'dotted', 'double', 'groove', 'ridge', 'inset', 'outset'].includes(项));
  const 宽项 = 部.find((项) => /^[\d.]+(px|em|rem)$/.test(项));
  const 色项 = 部.find((项) => 项.startsWith('#') || 项.startsWith('rgb'));
  if (式样 === undefined || 宽项 === undefined || 色项 === undefined) {
    throw new Error(`outline 简写拆不出 宽/式样/色 三件：${文本} → ${净}`);
  }
  return { 宽: Number.parseFloat(宽项), 式样, 色: 解析色(色项, 环境) };
}

/** 与卡底色差明显的近白横向亮条：通道差 + WCAG 相对亮度双门，再加近白门 */
function 是近白亮条(带: RGB, 卡面: RGB): boolean {
  return 最大通道差(带, 卡面) >= 24 && 相对亮度(带) >= 相对亮度(卡面) + 0.05 && 相对亮度(带) >= 0.7;
}

function 生效轮廓(元: Element): { 文本: string; 环: 轮廓 | null } {
  const 文本 = 计算值(元, 'outline');
  if (文本 === '' || /(^|\s)none(\s|$)/.test(文本)) {
    return { 文本, 环: null };
  }
  return { 文本, 环: 拆解轮廓(文本, 元) };
}

type 层叠快照 = {
  正文高: string;
  正文行: string;
  栅行: string;
  栅最小高: string;
  栅最大高: string;
  栅外边距: string;
  卡最小高: string;
  卡溢出纵: string;
};

function 恒定滚动口缺陷(链: 层叠快照): string[] {
  const 缺: string[] = [];
  if (链.正文高 !== '100dvh') {
    缺.push(`登录态正文高 = "${链.正文高}"，必须是 100dvh 确定高，卡片才拿得到封顶参照`);
  }
  if (/(^|[^d])100vh/.test(`${链.正文高} ${链.栅最大高}`)) {
    缺.push('登录链出现 100vh：移动端 URL 栏会把卡片顶离视口中心');
  }
  if (链.正文行 !== 'minmax(0, 1fr)') {
    缺.push(`正文行 = "${链.正文行}"，auto 行只会被撑大不会被压小，封不住卡顶`);
  }
  if (链.栅行 !== 'minmax(0, 1fr)') {
    缺.push(`登录栅行 = "${链.栅行}"，卡片没有确定高的百分比参照`);
  }
  if (链.栅最小高 !== '0px') {
    缺.push(`登录栅最小高 = "${链.栅最小高}"，网格项的 auto 最小尺寸会顶穿封顶`);
  }
  if (链.栅最大高 !== '100%') {
    缺.push(`登录栅最大高 = "${链.栅最大高}"，封顶只能是确定高的百分比，不许局部魔法量`);
  }
  if (链.栅外边距 !== 'auto') {
    缺.push(`登录栅外边距 = "${链.栅外边距}"，居中不再吃网格自动边距`);
  }
  if (链.卡最小高 !== '0px') {
    缺.push(`印卡最小高 = "${链.卡最小高}"，滚动口自身会被内容撑高`);
  }
  if (链.卡溢出纵 !== 'scroll') {
    缺.push(`印卡 overflow-y = "${链.卡溢出纵}"，auto/visible 都不是恒定滚动口，等价于 JS 条件类`);
  }
  return 缺;
}

type 焦点快照 = { 环: 轮廓 | null; 环文本: string; 阴影: string; 卡面: 颜色; 文本色: 颜色 };

function 焦点环缺陷(快照: 焦点快照): string[] {
  const 缺: string[] = [];
  if (快照.环 === null) {
    缺.push(`聚焦时没有生效的轮廓声明（实测 outline = "${快照.环文本}"）：撤掉了焦点环即丢键盘指示`);
    return 缺;
  }
  const 环色 = 压合(快照.环.色, 快照.卡面.rgb);
  if (是近白亮条(环色, 快照.卡面.rgb)) {
    缺.push(`焦点环压在卡面上构成近白亮条（L=${相对亮度(环色).toFixed(3)} vs 卡面 ${相对亮度(快照.卡面.rgb).toFixed(3)}）`);
  }
  if (最大通道差(环色, 快照.文本色.rgb) < 24) {
    缺.push('焦点环色退化成文本色，深色档下必然刷成白线');
  }
  if (快照.环.式样 !== 'solid' || 快照.环.宽 < 2) {
    缺.push(`焦点环 ${快照.环.宽}px ${快照.环.式样}，不足 2px 实线不可辨`);
  }
  if (对比度(环色, 快照.卡面.rgb) < 3) {
    缺.push(`焦点环对卡面 ${对比度(环色, 快照.卡面.rgb).toFixed(2)}:1 < 3:1`);
  }
  if (快照.阴影 !== '' && 快照.阴影 !== 'none') {
    缺.push(`聚焦输入框还叠了阴影装饰带："${快照.阴影}"，亮条病灶`);
  }
  return 缺;
}

function 描边缺陷(规则们: 规则[]): string[] {
  const 缺: string[] = [];
  const 轮廓规则: 规则[] = [];
  for (const 项 of 规则们) {
    const 轮廓 = 项.声明.get('outline') ?? '';
    const 阴影 = 项.声明.get('box-shadow') ?? '';
    if (/^\s*(none|0)\b/.test(轮廓) || (项.声明.get('outline-style') ?? '') === 'none') {
      缺.push(`${项.路径} 的 ${项.选择器} 撤掉了焦点环`);
    }
    if (轮廓 !== '') {
      轮廓规则.push(项);
      const 吃令牌 = 令牌引用(轮廓);
      if (!吃令牌.includes('--焦点环宽') || !吃令牌.includes('--焦点环色')) {
        缺.push(`${项.选择器} 的 outline 不吃 --焦点环宽/--焦点环色，退回魔法量或品牌色直取`);
      }
      if (!/:focus(-visible)?$/.test(项.选择器)) {
        缺.push(`${项.选择器} 在非焦点态上画 outline`);
      }
    }
    if (阴影 !== '' && /:focus/.test(项.选择器)) {
      缺.push(`${项.选择器} 用 box-shadow 当焦点反馈，装饰带会压出亮条`);
    }
    if (阴影 !== '' && 阴影 !== 'var(--影)' && !项.选择器.endsWith('.时间线 li::after')) {
      缺.push(`${项.选择器} 的 box-shadow "${阴影}" 既非 elevation 单源 --影，也不在已登记例外里`);
    }
  }
  if (轮廓规则.length !== 1) {
    缺.push(`全 src 只允许一处 outline 真源，实为 ${轮廓规则.length} 处：${轮廓规则.map((项) => `${项.路径}#${项.选择器}`).join(' / ')}`);
  }
  return 缺;
}

function 登录链样式块(源: string): string {
  return [...源.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((匹) => 匹[1]).join('\n');
}

function 注入登录链样式(): () => void {
  const 节 = document.createElement('style');
  节.setAttribute('data-fp17', '1');
  节.textContent = 登录链样式.map((路径) => (路径.endsWith('.css') ? 读(路径) : 登录链样式块(读(路径)))).join('\n');
  document.head.appendChild(节);
  return () => {
    节.remove();
  };
}

type 登录现场 = { 包装: VueWrapper; 正文: HTMLElement; 栅: HTMLElement; 卡: HTMLElement; 输入: HTMLElement; 口令: HTMLElement };

async function 挂载登录页(档: 档名): Promise<登录现场> {
  setActivePinia(createPinia());
  window.localStorage.clear();
  const 路由器: Router = createRouter({ history: createMemoryHistory(), routes: 路由表 });
  await 路由器.push('/deng-lu');
  await 路由器.isReady();
  const 包装 = mount(App, { attachTo: document.body, global: { plugins: [路由器] } });
  await flushPromises();
  应用主题(档 === '深' ? 深色 : 浅色);
  await flushPromises();
  const 拿 = (选择器: string): HTMLElement => {
    const 元 = document.querySelector(选择器) as HTMLElement | null;
    if (元 === null) {
      throw new Error(`登录链缺节点 ${选择器}`);
    }
    return 元;
  };
  return {
    包装,
    正文: 拿('main.正文'),
    栅: 拿('.登录栅'),
    卡: 拿('.印卡'),
    输入: 拿('[data-testid="shou-ji-hao-shu-ru"]'),
    口令: 拿('[data-testid="mi-ma-shu-ru"]'),
  };
}

async function 等过渡落定(元: Element): Promise<void> {
  const 截止 = Date.now() + 1000;
  while (/enter|leave/.test(元.className) && Date.now() < 截止) {
    await new Promise((resolve) => setTimeout(resolve, 10));
    await flushPromises();
  }
  expect(/enter|leave/.test(元.className), `路由过渡类没落定（class="${元.className}"），取样不可靠`).toBe(false);
}

function 快照(现场: { 正文: HTMLElement; 栅: HTMLElement; 卡: HTMLElement }): 层叠快照 {
  return {
    正文高: 计算值(现场.正文, 'height'),
    正文行: 计算值(现场.正文, 'grid-template-rows'),
    栅行: 计算值(现场.栅, 'grid-template-rows'),
    栅最小高: 计算值(现场.栅, 'min-height'),
    栅最大高: 计算值(现场.栅, 'max-height'),
    栅外边距: 计算值(现场.栅, 'margin'),
    卡最小高: 计算值(现场.卡, 'min-height'),
    卡溢出纵: 计算值(现场.卡, 'overflow-y'),
  };
}

function 取焦点快照(口令: HTMLElement, 卡: HTMLElement): 焦点快照 {
  const 环 = 生效轮廓(口令);
  return {
    环: 环.环,
    环文本: 环.文本,
    阴影: 计算值(口令, 'box-shadow'),
    卡面: 解析色(计算值(卡, 'background'), 口令),
    文本色: 解析色(令牌原值('--墨', 口令), 口令),
  };
}

function 末段(选择器: string): string {
  return (选择器.split(' ⇒ ').pop() as string).trim();
}

function 切到档(档: 档名): HTMLElement {
  应用主题(档 === '深' ? 深色 : 浅色);
  return document.documentElement;
}

const 待撤: (() => void)[] = [];

afterEach(() => {
  while (待撤.length > 0) {
    (待撤.pop() as () => void)();
  }
  document.body.innerHTML = '';
  document.head.querySelectorAll('style[data-fp17]').forEach((节) => 节.remove());
});

describe('FP-17① 登录页垂直居中与恒定滚动口（层叠结果）', () => {
  it.each(['浅', '深'] as 档名[])('%s 档：确定高 100dvh 口 + minmax(0,1fr) 行 + 卡片恒定 scroll 口', async (档) => {
    待撤.push(注入登录链样式());
    const 现场 = await 挂载登录页(档);
    const 链 = 快照(现场);
    expect(恒定滚动口缺陷(链), JSON.stringify(链)).toEqual([]);
    expect(计算值(现场.正文, 'min-height')).toBe('auto');
    expect(计算值(现场.卡, 'max-height')).toBe('none');
    expect(计算值(现场.卡, 'display')).toBe('flex');
    现场.包装.unmount();
  });

  it('滚动口宿主不随状态长出条件类，卡内 DOM 变高后 overflow 仍是 scroll', async () => {
    待撤.push(注入登录链样式());
    const 现场 = await 挂载登录页('浅');
    await 等过渡落定(现场.栅);
    const 起始 = { 卡类: 现场.卡.className, 栅类: 现场.栅.className, 溢出: 计算值(现场.卡, 'overflow-y') };
    expect(现场.卡.querySelector('[data-testid="cuo-wu-ti-shi"]')).toBeNull();
    现场.包装.find('[data-testid="deng-lu-an-niu"]').trigger('click');
    await flushPromises();
    expect(现场.卡.querySelector('[data-testid="cuo-wu-ti-shi"]'), '空账号提交没长出错误条，本探针不成立').not.toBeNull();
    expect(现场.卡.className).toBe(起始.卡类);
    expect(现场.栅.className).toBe(起始.栅类);
    expect(计算值(现场.卡, 'overflow-y')).toBe(起始.溢出);
    expect(起始.溢出).toBe('scroll');
    expect(`${起始.卡类} ${起始.栅类}`.toLowerCase()).not.toMatch(/gundong|scroll|滚动/);
    现场.包装.unmount();
  });

  it('反证：封顶换成 50vh 魔法量、滚动口降级成 auto/visible、正文丢掉确定高，判据必须红', () => {
    const 合格: 层叠快照 = {
      正文高: '100dvh',
      正文行: 'minmax(0, 1fr)',
      栅行: 'minmax(0, 1fr)',
      栅最小高: '0px',
      栅最大高: '100%',
      栅外边距: 'auto',
      卡最小高: '0px',
      卡溢出纵: 'scroll',
    };
    expect(恒定滚动口缺陷(合格)).toEqual([]);
    expect(恒定滚动口缺陷({ ...合格, 栅最大高: '50vh' })).not.toEqual([]);
    expect(恒定滚动口缺陷({ ...合格, 栅最大高: '320px' })).not.toEqual([]);
    expect(恒定滚动口缺陷({ ...合格, 卡溢出纵: 'auto' })).not.toEqual([]);
    expect(恒定滚动口缺陷({ ...合格, 卡溢出纵: 'visible' })).not.toEqual([]);
    expect(恒定滚动口缺陷({ ...合格, 正文高: 'auto' })).not.toEqual([]);
    expect(恒定滚动口缺陷({ ...合格, 正文高: '100vh' })).not.toEqual([]);
    expect(恒定滚动口缺陷({ ...合格, 正文行: 'auto' })).not.toEqual([]);
    expect(恒定滚动口缺陷({ ...合格, 栅行: 'none' })).not.toEqual([]);
    expect(恒定滚动口缺陷({ ...合格, 栅最小高: 'auto' })).not.toEqual([]);
    expect(恒定滚动口缺陷({ ...合格, 卡最小高: 'auto' })).not.toEqual([]);
    expect(恒定滚动口缺陷({ ...合格, 栅外边距: '0px' })).not.toEqual([]);
  });
});

describe('FP-17② 输入框焦点装饰线与显式焦点环（解析值）', () => {
  it.each(['浅', '深'] as 档名[])('%s 档：聚焦输入框只吃令牌环，环色解析到该档实值且不构成近白亮条', async (档) => {
    待撤.push(注入登录链样式());
    const 现场 = await 挂载登录页(档);
    现场.口令.focus();
    const 快照结果 = 取焦点快照(现场.口令, 现场.卡);
    expect(快照结果.环文本, '聚焦后没有任何生效的 outline').not.toBe('');
    expect(令牌引用(快照结果.环文本)).toEqual(expect.arrayContaining(['--焦点环宽', '--焦点环色']));
    expect(焦点环缺陷(快照结果), JSON.stringify({ 环文本: 快照结果.环文本, 阴影: 快照结果.阴影 })).toEqual([]);
    expect(快照结果.环?.式样).toBe('solid');
    expect(快照结果.环?.宽).toBe(2);
    expect(快照结果.阴影).toBe('');
    expect(快照结果.环?.色.rgb).toEqual(解析色(令牌原值('--焦点环色', 现场.口令), 现场.口令).rgb);
    现场.包装.unmount();
  });

  it('环宽/环色成对声明且环色两档不同、都不等于文本色、对卡面 ≥3:1', async () => {
    待撤.push(注入登录链样式());
    const 现场 = await 挂载登录页('浅');
    const 卡面浅 = 解析色(计算值(现场.卡, 'background'), 现场.卡);
    const 环色浅 = 解析色(令牌原值('--焦点环色', 现场.口令), 现场.口令);
    const 文本浅 = 解析色(令牌原值('--墨', 现场.口令), 现场.口令);
    expect(像素(令牌原值('--焦点环宽', 现场.口令), '环宽', 现场.口令)).toBeGreaterThanOrEqual(2);
    应用主题(深色);
    const 环色深 = 解析色(令牌原值('--焦点环色', 现场.口令), 现场.口令);
    const 文本深 = 解析色(令牌原值('--墨', 现场.口令), 现场.口令);
    const 卡面深 = 解析色(计算值(现场.卡, 'background'), 现场.卡);
    expect(环色浅.rgb).not.toEqual(环色深.rgb);
    expect(环色浅.rgb).not.toEqual(文本浅.rgb);
    expect(环色深.rgb).not.toEqual(文本深.rgb);
    expect(对比度(环色浅.rgb, 卡面浅.rgb)).toBeGreaterThanOrEqual(3);
    expect(对比度(环色深.rgb, 卡面深.rgb)).toBeGreaterThanOrEqual(3);
    现场.包装.unmount();
  });

  it('反证：往文档插回 box-shadow 装饰带或 outline:none，判据当场红', async () => {
    待撤.push(注入登录链样式());
    const 现场 = await 挂载登录页('浅');
    现场.口令.focus();
    expect(焦点环缺陷(取焦点快照(现场.口令, 现场.卡))).toEqual([]);
    const 掺带 = document.createElement('style');
    掺带.setAttribute('data-fp17', '1');
    掺带.textContent = '.输入:focus{box-shadow:0 0 0 3px rgba(255, 255, 255, 0.95)}';
    document.head.appendChild(掺带);
    expect(焦点环缺陷(取焦点快照(现场.口令, 现场.卡)).join('\n')).toContain('装饰带');
    掺带.remove();
    expect(焦点环缺陷(取焦点快照(现场.口令, 现场.卡))).toEqual([]);
    const 掺撤 = document.createElement('style');
    掺撤.setAttribute('data-fp17', '1');
    掺撤.textContent = '.输入:focus{outline:none}';
    document.head.appendChild(掺撤);
    const 撤后 = 取焦点快照(现场.口令, 现场.卡);
    掺撤.remove();
    expect(焦点环缺陷(撤后).join('\n')).toContain('撤掉了焦点环');
    现场.包装.unmount();
  });

  it('全 src 的 outline/box-shadow 描边声明穷尽收口在单源里', () => {
    const 缺 = 描边缺陷(全部规则());
    expect(缺, 缺.join('\n')).toEqual([]);
  });

  it('反证：任一视图把焦点反馈改回装饰带、另起一处 outline 或直接撤环，描边账本必须红', () => {
    const 原 = 全部规则();
    expect(描边缺陷(原)).toEqual([]);
    const 掺带 = [...原, ...规则清单('src/views/账号列表.vue', '<style scoped>.输入:focus{box-shadow:0 0 0 3px var(--印淡)}</style>')];
    expect(描边缺陷(掺带).join('\n')).toContain('装饰带');
    const 掺环 = [...原, ...规则清单('src/views/封禁管理.vue', '<style scoped>.选择:focus{outline:1px solid var(--墨)}</style>')];
    expect(描边缺陷(掺环).join('\n')).toContain('不吃 --焦点环宽');
    const 掺撤 = [...原, ...规则清单('src/components/XiaoXiTiao.vue', '<style scoped>.按钮主:focus-visible{outline:none}</style>')];
    expect(描边缺陷(掺撤).join('\n')).toContain('撤掉了焦点环');
  });
});

describe('FP-17③ 主题.css 已落地产物在解析层生效且不重复', () => {
  it('color-scheme 在两档上都真的作用于根元素', async () => {
    待撤.push(注入登录链样式());
    const 现场 = await 挂载登录页('浅');
    expect(计算值(document.documentElement, 'color-scheme')).toBe('light');
    应用主题(深色);
    expect(计算值(document.documentElement, 'color-scheme')).toBe('dark');
    应用主题(浅色);
    expect(计算值(document.documentElement, 'color-scheme')).toBe('light');
    现场.包装.unmount();
  });

  it('滚动条套件全库只住 主题.css 一处，三档底色解析后可分辨、光标全态为 default 与 Firefox 分支独一份', async () => {
    待撤.push(注入登录链样式());
    const 规则们 = 全部规则();
    const 本体 = 规则们.filter((项) => 末段(项.选择器).includes('::-webkit-scrollbar'));
    expect(new Set(本体.map((项) => 项.路径)), 本体.map((项) => 项.路径).join(',')).toEqual(new Set(['src/主题.css']));
    expect(本体.map((项) => 末段(项.选择器)).sort()).toEqual(
      [
        '::-webkit-scrollbar',
        '::-webkit-scrollbar-corner',
        '::-webkit-scrollbar-thumb',
        '::-webkit-scrollbar-thumb:hover',
        ':focus-visible::-webkit-scrollbar-thumb',
        '::-webkit-scrollbar-track',
      ].sort(),
    );
    const 取声明 = (选择器: string, 属性: string): string => 非空(本体.find((项) => 末段(项.选择器) === 选择器)?.声明.get(属性) ?? '', `${选择器} 的 ${属性}`);
    const 光标档: Record<string, string> = {
      '::-webkit-scrollbar': 'var(--条光标)',
      '::-webkit-scrollbar-track': 'var(--条光标)',
      '::-webkit-scrollbar-thumb': 'var(--条光标)',
      '::-webkit-scrollbar-thumb:hover': 'var(--条光标)',
      ':focus-visible::-webkit-scrollbar-thumb': 'var(--条光标)',
      '::-webkit-scrollbar-corner': 'var(--条光标)',
    };
    for (const [选择器, 值] of Object.entries(光标档)) {
      expect(取声明(选择器, 'cursor'), `${选择器} 的 cursor 不是 ${值}`).toBe(值);
    }
    for (const 档 of ['浅', '深'] as 档名[]) {
      const 环境 = 切到档(档);
      const 三档 = ['thumb', 'track', 'corner'].map((件) => 解析色(取声明(`::-webkit-scrollbar-${件}`, 'background'), 环境));
      for (let 甲 = 0; 甲 < 三档.length; 甲++) {
        for (let 乙 = 甲 + 1; 乙 < 三档.length; 乙++) {
          expect(通道差和(三档[甲].rgb, 三档[乙].rgb), `${档} 档滚动条 ${['thumb', 'track', 'corner'][甲]}/${['thumb', 'track', 'corner'][乙]} 糊成一片`).toBeGreaterThanOrEqual(24);
        }
      }
      expect(像素(令牌原值('--条宽', 环境), '条宽', 环境)).toBeGreaterThanOrEqual(7);
    }
    const 标准档 = 规则们.filter((项) => 项.声明.has('scrollbar-width') || 项.声明.has('scrollbar-color'));
    expect(标准档.map((项) => `${项.路径}#${项.选择器}`)).toHaveLength(1);
    expect(标准档[0]?.选择器.startsWith('@supports not selector(::-webkit-scrollbar) ⇒')).toBe(true);
    expect(标准档[0]?.声明.get('scrollbar-color')).toBe('var(--条滑块) var(--条轨道)');
  });

  it('appearance:none 只关文本框的原生外观，select/number/datetime-local/checkbox 的原生指示器保留', async () => {
    待撤.push(注入登录链样式());
    const 现场 = await 挂载登录页('深');
    expect(计算值(现场.输入, 'appearance')).toBe('none');
    expect(计算值(现场.口令, 'appearance')).toBe('none');
    const 样本 = document.createElement('div');
    样本.innerHTML =
      '<select class="输入"><option>a</option></select><input class="输入" type="number"><input class="输入" type="datetime-local"><input type="checkbox">';
    document.body.appendChild(样本);
    const [下拉, 数字, 日期, 勾选] = Array.from(样本.children) as HTMLElement[];
    expect(计算值(下拉, 'appearance')).not.toBe('none');
    expect(计算值(数字, 'appearance')).not.toBe('none');
    expect(计算值(日期, 'appearance')).not.toBe('none');
    expect(计算值(勾选, 'appearance')).not.toBe('none');
    现场.包装.unmount();
  });
});
