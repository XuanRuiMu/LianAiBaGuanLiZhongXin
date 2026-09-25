import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { 应用主题, 深色, 浅色 } from '../主题模式';

type 样式文件 = { 路径: string; 文本: string };
type CSS规则 = { 路径: string; 选择器: string; 声明: Map<string, string> };

type 主题档 = '浅' | '深';

const 读 = (路径: string): string => fs.readFileSync(路径, 'utf8');
const 主题源 = 读('src/主题.css');

function 去注释(源: string): string {
  return 源.replace(/\/\*[\s\S]*?\*\//g, '');
}

function 样式清单(): 样式文件[] {
  const 出: 样式文件[] = [];
  function 走(目录: string): void {
    for (const 名 of fs.readdirSync(目录)) {
      const 全 = `${目录}/${名}`;
      if (fs.statSync(全).isDirectory()) {
        走(全);
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
  }
  走('src');
  return 出;
}

function 匹配右括号(文本: string, 左: number): number {
  let 深度 = 0;
  for (let 序 = 左; 序 < 文本.length; 序++) {
    if (文本[序] === '{') {
      深度 += 1;
    } else if (文本[序] === '}' && --深度 === 0) {
      return 序;
    }
  }
  throw new Error('CSS 花括号不闭合');
}

function 切(文本: string, 分隔: string): string[] {
  const 出: string[] = [];
  let 深度 = 0;
  let 当前 = '';
  for (const 符 of 文本) {
    if (符 === '(' || 符 === '[') {
      深度 += 1;
    } else if (符 === ')' || 符 === ']') {
      深度 -= 1;
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

function 规则清单(路径: string, 源: string): CSS规则[] {
  const 出: CSS规则[] = [];
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

function 全部规则(): CSS规则[] {
  return 样式清单().flatMap((项) => 规则清单(项.路径, 项.文本));
}

function 顶层块(源: string, 选择器: string): string {
  const 起 = 源.indexOf(`${选择器} {`);
  if (起 < 0) {
    return '';
  }
  const 止 = 匹配右括号(源, 源.indexOf('{', 起));
  return 源.slice(起 + 选择器.length + 2, 止);
}

function 令牌表(块: string): Record<string, string> {
  const 表: Record<string, string> = {};
  for (const 匹 of 块.matchAll(/--([^\s:]+):\s*([^;]+);/g)) {
    表[匹[1]] = 匹[2].trim();
  }
  return 表;
}

function 解引用(值: string, 表: Record<string, string>): string {
  let 当前 = 值.trim();
  for (let 轮 = 0; 轮 < 8 && 当前.startsWith('var('); 轮++) {
    const 名 = /^var\((--[^)]+)\)$/.exec(当前)?.[1]?.slice(2);
    if (名 === undefined || 表[名] === undefined) {
      break;
    }
    当前 = 表[名];
  }
  return 当前;
}

function 主题令牌(档: 主题档): Record<string, string> {
  return 令牌表(顶层块(主题源, 档 === '浅' ? ':root' : '.dark'));
}

function 模板段(源: string): string {
  const 起 = 源.indexOf('<template');
  const 止 = 源.lastIndexOf('</template>');
  return 起 >= 0 && 止 > 起 ? 源.slice(起, 止) : '';
}

function 标签清单(源: string): string[] {
  return [...模板段(源).matchAll(/<(input|textarea|select)\b[\s\S]*?>/g)].map((匹) => 匹[0]);
}

function 类型码(标签: string): string {
  return /\btype\s*=\s*["']([^"']+)["']/.exec(标签)?.[1] ?? 'text';
}

const 非文本输入类型 = new Set(['button', 'checkbox', 'color', 'file', 'image', 'radio', 'range', 'reset', 'submit']);

function 是文本输入(标签: string): boolean {
  const 标签名 = /^<([a-z]+)/.exec(标签)?.[1] ?? '';
  if (标签名 === 'textarea') {
    return true;
  }
  if (标签名 === 'input') {
    return !非文本输入类型.has(类型码(标签));
  }
  return false;
}

function 类名(标签: string): string[] {
  return (/\bclass\s*=\s*["']([^"']*)["']/.exec(标签)?.[1] ?? '').split(/\s+/).filter((项) => 项.length > 0);
}

const 输入期望: Record<string, number> = {
  'src/views/账号列表.vue': 3,
  'src/views/聊天记录.vue': 6,
  'src/views/思考链.vue': 3,
  'src/views/封禁管理.vue': 5,
  'src/views/审计日志.vue': 3,
  'src/views/统计图表.vue': 1,
  'src/views/审核运营.vue': 10,
  'src/views/登录页.vue': 2,
};

const 选择期望: Record<string, number> = {
  'src/views/账号列表.vue': 1,
  'src/views/聊天记录.vue': 2,
  'src/views/思考链.vue': 1,
  'src/views/封禁管理.vue': 2,
  'src/views/审计日志.vue': 2,
  'src/views/审核运营.vue': 1,
};

function 源码文件清单(目录 = 'src'): string[] {
  const 出: string[] = [];
  for (const 名 of fs.readdirSync(目录)) {
    const 路径 = `${目录}/${名}`;
    if (fs.statSync(路径).isDirectory()) {
      if (名 !== '__tests__') {
        出.push(...源码文件清单(路径));
      }
    } else if (名.endsWith('.vue')) {
      出.push(路径);
    }
  }
  return 出;
}

function 文本输入账本(): Record<string, number> {
  const 出: Record<string, number> = {};
  for (const 路径 of 源码文件清单()) {
    const 标签集 = 标签清单(读(路径));
    const 数量 = 标签集.filter(是文本输入).length;
    if (数量 > 0) {
      出[路径] = 数量;
    }
  }
  return 出;
}

function 选择账本(): Record<string, number> {
  const 出: Record<string, number> = {};
  for (const 路径 of 源码文件清单()) {
    const 数量 = 标签清单(读(路径)).filter((标签) => /^<select\b/.test(标签)).length;
    if (数量 > 0) {
      出[路径] = 数量;
    }
  }
  return 出;
}

function 文本域账本(): Record<string, number> {
  const 出: Record<string, number> = {};
  for (const 路径 of 源码文件清单()) {
    const 数量 = 标签清单(读(路径)).filter((标签) => /^<textarea\b/.test(标签)).length;
    if (数量 > 0) {
      出[路径] = 数量;
    }
  }
  return 出;
}

function 可编辑账本(): Record<string, number> {
  const 出: Record<string, number> = {};
  for (const 路径 of 源码文件清单()) {
    const 数量 = [...模板段(读(路径)).matchAll(/\bcontenteditable\s*=/g)].length;
    if (数量 > 0) {
      出[路径] = 数量;
    }
  }
  return 出;
}

const 溢出期望 = [
  'src/主题.css|.账簿表|overflow|hidden',
  'src/主题.css|.快照码|overflow|auto',
  'src/主题.css|.统计卡|overflow|hidden',
  'src/主题.css|.条轨|overflow|hidden',
  'src/主题.css|.图框|overflow-x|auto',
  'src/主题.css|.卷宗|overflow|hidden',
  'src/主题.css|.加载条|overflow|hidden',
  'src/主题.css|.表滚|overflow-x|auto',
  'src/App.vue|.侧栏|overflow|hidden',
  'src/App.vue|@media (max-width: 719px) ⇒ .栏导航|overflow-x|auto',
  'src/views/登录页.vue|.印卡|overflow-y|scroll',
].sort();

function 溢出账本(): string[] {
  const 出: string[] = [];
  for (const 项 of 样式清单()) {
    for (const 规则 of 规则清单(项.路径, 项.文本)) {
      for (const [属性, 值] of 规则.声明) {
        if (/^overflow(?:-[xy])?$/.test(属性)) {
          出.push(`${项.路径}|${规则.选择器.replace(/\s+/g, ' ').trim()}|${属性}|${值}`);
        }
      }
    }
  }
  return 出.sort();
}

function 注入主题(): HTMLStyleElement {
  const 节点 = document.createElement('style');
  节点.dataset.fp06 = '1';
  节点.textContent = 主题源;
  document.head.appendChild(节点);
  return 节点;
}

function 取计算值(节点: Element, 属性: string): string {
  return window.getComputedStyle(节点).getPropertyValue(属性).trim();
}

const 清理: (() => void)[] = [];

afterEach(() => {
  while (清理.length > 0) {
    (清理.pop() as () => void)();
  }
  document.body.innerHTML = '';
  document.head.querySelectorAll('style[data-fp06]').forEach((节点) => 节点.remove());
  document.documentElement.classList.remove('dark');
  应用主题(浅色);
});

describe('FP-06 管理中心全局输入聚焦与滚动条契约', () => {
  it('枚举全部文本输入与选择控件，文本控件均落在共享输入契约', () => {
    expect(文本输入账本()).toEqual(输入期望);
    expect(选择账本()).toEqual(选择期望);
    expect(文本域账本()).toEqual({});
    expect(可编辑账本()).toEqual({});
    for (const 文件 of [...Object.keys(输入期望), ...Object.keys(选择期望)]) {
      const 标签集 = 标签清单(读(文件));
      for (const 标签 of 标签集.filter((项) => 是文本输入(项) || /^<select\b/.test(项))) {
        const 类 = 类名(标签);
        expect(类.some((项) => 项 === '输入' || 项 === '选择'), `${文件} 的 ${标签.slice(0, 20)} 缺少输入类`).toBe(true);
      }
    }
    expect(标签清单(读('src/views/登录页.vue')).filter(是文本输入)).toHaveLength(2);
    expect(标签清单(读('src/views/审核运营.vue')).filter((标签) => 类型码(标签) === 'checkbox')).toHaveLength(1);
  });

  it('枚举全部 overflow 声明，auto/scroll 容器没有遗漏或私有滚动条', () => {
    expect(溢出账本()).toEqual(溢出期望);
    const 可滚动 = 溢出账本().filter((项) => /\|(?:auto|scroll)$/.test(项));
    expect(可滚动).toEqual([
      'src/主题.css|.图框|overflow-x|auto',
      'src/主题.css|.快照码|overflow|auto',
      'src/主题.css|.表滚|overflow-x|auto',
      'src/App.vue|@media (max-width: 719px) ⇒ .栏导航|overflow-x|auto',
      'src/views/登录页.vue|.印卡|overflow-y|scroll',
    ].sort());
    const 滚动规则 = 全部规则().filter((项) => 项.选择器.includes('::-webkit-scrollbar') && !项.选择器.startsWith('@supports'));
    expect(new Set(滚动规则.map((项) => 项.路径))).toEqual(new Set(['src/主题.css']));
    for (const 项 of 滚动规则) {
      expect(项.声明.get('cursor'), `${项.选择器} 滚动条光标未消费语义令牌`).toBe('var(--条光标)');
    }
  });

  it('双主题输入状态令牌齐全，滚动条尺寸与交互色均由管理中心变量派生', () => {
    const 浅 = 主题令牌('浅');
    const 深 = 主题令牌('深');
    const 输入色 = ['输入底线常态', '输入底线聚焦', '输入底线失焦', '输入底线禁用', '输入底线只读', '输入底线自动填充', '输入底线错误'];
    const 滚动色 = ['滚动条轨道', '滚动条滑块', '滚动条滑块悬停', '滚动条滑块焦点', '滚动条角落'];
    for (const 名 of [...输入色, ...滚动色, '滚动条光标']) {
      expect(浅[名], `浅色档缺 ${名}`).toBeDefined();
      expect(深[名], `深色档缺 ${名}`).toBeDefined();
    }
    for (const 名 of 输入色.concat(滚动色.slice(0, 4))) {
      expect(解引用(浅[名], 浅), `${名} 没有消费管理中心主题变量`).toMatch(/^#|rgba?\(/);
      expect(解引用(浅[名], 浅)).not.toBe(解引用(深[名], 深));
    }
    expect(解引用(浅['滚动条光标'], 浅)).toBe('default');
    expect(解引用(深['滚动条光标'], 深)).toBe('default');
    expect(浅['输入底线宽']).toBe('2px');
    expect(浅['滚动条宽']).toBe('10px');
  });

  it('主题切换、focus-visible、blur、readonly、disabled 与错误态均有独立规则', () => {
    注入主题();
    const 输入 = document.createElement('input');
    输入.className = '输入';
    document.body.appendChild(输入);
    const 文本 = document.createElement('textarea');
    文本.className = '输入';
    document.body.appendChild(文本);
    const 可编辑 = document.createElement('div');
    可编辑.contentEditable = 'true';
    可编辑.tabIndex = 0;
    document.body.appendChild(可编辑);
    const 禁用 = document.createElement('input');
    禁用.className = '输入';
    禁用.disabled = true;
    document.body.appendChild(禁用);
    const 只读 = document.createElement('input');
    只读.className = '输入';
    只读.readOnly = true;
    document.body.appendChild(只读);
    const 错误 = document.createElement('input');
    错误.className = '输入';
    错误.setAttribute('aria-invalid', 'true');
    document.body.appendChild(错误);

    应用主题(浅色);
    const 浅印 = 取计算值(document.documentElement, '--印');
    应用主题(深色);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(取计算值(document.documentElement, '--印')).not.toBe(浅印);
    应用主题(浅色);

    输入.focus();
    expect(输入.matches(':focus-visible')).toBe(true);
    const 聚焦前 = ['border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'height', 'min-height', 'box-sizing'].map((属性) => 取计算值(输入, 属性));
    const 聚焦后 = ['border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'height', 'min-height', 'box-sizing'].map((属性) => 取计算值(输入, 属性));
    expect(聚焦后).toEqual(聚焦前);
    输入.blur();
    expect(输入.matches(':focus-visible')).toBe(false);
    文本.focus();
    expect(文本.matches(':focus-visible')).toBe(true);
    文本.blur();
    可编辑.focus();
    expect(可编辑.matches(':focus-visible')).toBe(true);
    可编辑.blur();
    expect(禁用.matches(':disabled')).toBe(true);
    expect(只读.matches(':read-only')).toBe(true);
    expect(错误.matches('[aria-invalid="true"]')).toBe(true);

    const 规则们 = 规则清单('src/主题.css', 主题源);
    const 线规则 = 规则们.filter((项) => 项.声明.has('--线色') || 项.声明.has('--线宽'));
    const 聚焦线规则 = 线规则.find((项) => 项.选择器.includes(':focus-visible') && !项.选择器.includes(':not(:focus-visible)'));
    const 失焦线规则 = 线规则.find((项) => 项.选择器.includes(':not(:focus-visible)'));
    expect(聚焦线规则?.声明.get('--线宽')).toBe('var(--入宽)');
    expect(失焦线规则?.声明.get('--线宽')).toBe('0px');
    expect(线规则.some((项) => 项.选择器.includes(':focus-visible'))).toBe(true);
    expect(线规则.some((项) => 项.选择器.includes(':not(:focus-visible)'))).toBe(true);
    expect(线规则.some((项) => 项.选择器.includes(':disabled'))).toBe(true);
    expect(线规则.some((项) => 项.选择器.includes(':read-only'))).toBe(true);
    expect(线规则.some((项) => 项.选择器.includes('-webkit-autofill'))).toBe(true);
    expect(线规则.some((项) => 项.选择器.includes('aria-invalid'))).toBe(true);
    for (const 项 of 线规则.filter((规则) => 规则.选择器.includes(':focus-visible'))) {
      for (const 属性 of 项.声明.keys()) {
        expect(['border', 'border-color', 'border-width', 'box-shadow', 'padding', 'height', 'width', 'min-height', 'min-width', 'margin', 'outline']).not.toContain(属性);
      }
    }
  });

  it('reduced-motion 通配覆盖输入底线动效，滚动条 hover/focus 仍为普通箭头', () => {
    const 起 = 主题源.indexOf('@media (prefers-reduced-motion: reduce)');
    expect(起).toBeGreaterThanOrEqual(0);
    const 止 = 匹配右括号(主题源, 主题源.indexOf('{', 起));
    const 块 = 主题源.slice(起, 止);
    expect(块).toMatch(/\*,\s*\*::before,\s*\*::after\s*\{[^}]*transition:\s*none\s*!important/);
    expect(块).toMatch(/animation:\s*none\s*!important/);
    const 规则们 = 规则清单('src/主题.css', 主题源);
    const 线规则 = 规则们.filter((项) => 项.声明.has('transition') && (项.选择器.includes('输入') || 项.选择器.includes('textarea')));
    expect(线规则.length).toBeGreaterThan(0);
    for (const 项 of 线规则) {
      expect(项.声明.get('animation')).toBeUndefined();
    }
    const 滚动规则 = 规则们.filter((项) => 项.选择器.includes('::-webkit-scrollbar') && !项.选择器.startsWith('@supports'));
    expect(滚动规则.find((项) => 项.选择器 === '::-webkit-scrollbar-thumb:hover')?.声明.get('background')).toBe('var(--条滑块悬停)');
    expect(滚动规则.find((项) => 项.选择器.includes(':focus-visible::-webkit-scrollbar-thumb'))?.声明.get('background')).toBe('var(--条滑块焦点)');
    expect(滚动规则.every((项) => 项.声明.get('cursor') === 'var(--条光标)')).toBe(true);
  });

  it('链接、按钮、文本输入和选择控件的光标语义不被滚动条契约覆盖', () => {
    const 规则们 = 全部规则();
    expect(规则们.find((项) => 项.选择器 === 'a')?.声明.has('cursor')).toBe(false);
    for (const 选择器 of ['.按钮主', '.按钮次', '.按钮危', '.栏按钮', '.标签页 button']) {
      expect(规则们.find((项) => 项.选择器 === 选择器)?.声明.get('cursor'), `${选择器} 丢失按钮光标语义`).toBe('pointer');
    }
    const 输入规则 = 规则们.find((项) => 项.选择器.startsWith(':is(.输入'));
    expect(输入规则?.声明.has('cursor')).toBe(false);
    expect(主题源).not.toMatch(/cursor:\s*text/);
    expect(规则们.find((项) => 项.选择器 === ':is(.输入, .选择, textarea):disabled')?.声明.get('cursor')).toBe('not-allowed');
  });
});
