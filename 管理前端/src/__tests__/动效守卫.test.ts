import { describe, expect, it, vi } from 'vitest';
import { parse } from 'vue/compiler-sfc';
import fs from 'node:fs';
import { mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter, useRoute } from 'vue-router';
import { Transition, computed, h, nextTick, ref, resolveComponent, watch } from 'vue';
import { 导航位次, 页面过渡名, 过渡前进, 过渡后退, type 过渡名, type 页面端点 } from '../动效';

function 读(路径: string): string {
  return fs.readFileSync(路径, 'utf8');
}

type 规则 = { 选择器: string; 体内: string };

type 例外 = { 选择器: RegExp; 属性: RegExp; 值?: RegExp; 理由: string };

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

function 括号块从(文本: string, 开括号: number): string {
  let 深 = 0;
  for (let 下标 = 开括号; 下标 < 文本.length; 下标++) {
    const 符 = 文本[下标];
    if (符 === '{') {
      深 += 1;
    } else if (符 === '}') {
      深 -= 1;
      if (深 === 0) {
        return 文本.slice(开括号 + 1, 下标);
      }
    }
  }
  return '';
}

function 关键帧表(文本: string): { 名: string; 帧: 规则[] }[] {
  const 出: { 名: string; 帧: 规则[] }[] = [];
  for (const 匹 of [...文本.matchAll(/@keyframes\s+([^\s{]+)/g)]) {
    const 开 = 文本.indexOf('{', 匹.index);
    if (开 < 0) {
      continue;
    }
    出.push({ 名: 匹[1], 帧: 规则列表(括号块从(文本, 开)) });
  }
  return 出;
}

function 去关键帧(文本: string): string {
  return 剥离块(文本, /@keyframes\s+[^\s{]+/g);
}

function 剥离块(文本: string, 定位: RegExp): string {
  let 出 = 文本;
  for (const 匹 of [...文本.matchAll(定位)].reverse()) {
    const 开 = 出.indexOf('{', 匹.index);
    if (开 < 0) {
      continue;
    }
    let 深 = 0;
    let 止 = 开;
    for (; 止 < 出.length; 止++) {
      if (出[止] === '{') {
        深 += 1;
      } else if (出[止] === '}') {
        深 -= 1;
        if (深 === 0) {
          break;
        }
      }
    }
    出 = `${出.slice(0, 匹.index)}\n${出.slice(止 + 1)}`;
  }
  return 出;
}

function 规则列表(文本: string): 规则[] {
  return [...文本.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((匹) => ({
    选择器: 匹[1].trim().replace(/\s+/g, ' '),
    体内: 匹[2],
  }));
}

function 声明列表(体: string): { 属性: string; 值: string }[] {
  const 出: { 属性: string; 值: string }[] = [];
  for (const 条 of 体.split(';')) {
    const 冒 = 条.indexOf(':');
    if (冒 < 0) {
      continue;
    }
    出.push({ 属性: 条.slice(0, 冒).trim(), 值: 条.slice(冒 + 1).trim() });
  }
  return 出;
}

const 节奏属性 = /^(?:transition|animation)(?:-(?:duration|delay|timing-function|property|name|iteration-count|fill-mode|direction))?$/;

const 裸时长 = /\b\d+(?:\.\d+)?(?:ms|s)\b/;

const 裸缓动 = /\b(?:ease-in-out|ease-out|ease-in|ease|linear)\b|cubic-bezier\(/;

function 例外命中(例外表: 例外[], 选择器: string, 属性: string, 值: string): 例外 | null {
  for (const 条 of 例外表) {
    if (条.选择器.test(选择器) && 条.属性.test(属性) && (条.值 === undefined || 条.值.test(值))) {
      return 条;
    }
  }
  return null;
}

function 扫描裸节奏(样式表: { 路径: string; 文本: string }[], 例外表: 例外[] = []): { 违例: string[]; 已用例外: Set<例外> } {
  const 违例: string[] = [];
  const 已用例外 = new Set<例外>();
  for (const 项 of 样式表) {
    for (const 则 of 规则列表(去关键帧(项.文本))) {
      for (const 声明 of 声明列表(则.体内)) {
        if (!节奏属性.test(声明.属性)) {
          continue;
        }
        const 中 = 例外命中(例外表, 则.选择器, 声明.属性, 声明.值);
        if (中 !== null) {
          已用例外.add(中);
          continue;
        }
        if (裸时长.test(声明.值)) {
          违例.push(`${项.路径} → ${则.选择器} { ${声明.属性}: ${声明.值} } 写了裸时长字面量，必须引用 --时长*/--步进差 token`);
        }
        if (裸缓动.test(声明.值)) {
          违例.push(`${项.路径} → ${则.选择器} { ${声明.属性}: ${声明.值} } 写了裸缓动字面量，必须引用 --缓* token`);
        }
      }
    }
  }
  return { 违例, 已用例外 };
}

const 布局触发属性 = new Set([
  'width',
  'height',
  'min-width',
  'min-height',
  'max-width',
  'max-height',
  'top',
  'left',
  'right',
  'bottom',
  'inset',
  'margin',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'padding',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'display',
  'position',
  'font-size',
  'line-height',
  'letter-spacing',
  'grid-template-columns',
  'grid-template-rows',
  'flex-basis',
  'vertical-align',
]);

const 合成层属性 = new Set(['transform', 'opacity']);

function 首词(片段: string): string {
  return 片段.trim().split(/\s+/)[0] ?? '';
}

function 扫描布局动效(样式表: { 路径: string; 文本: string }[], 例外表: 例外[] = []): { 违例: string[]; 已用例外: Set<例外> } {
  const 违例: string[] = [];
  const 已用例外 = new Set<例外>();
  for (const 项 of 样式表) {
    for (const 则 of 规则列表(去关键帧(项.文本))) {
      for (const 声明 of 声明列表(则.体内)) {
        if (!/^(?:transition|animation)(?:-property)?$/.test(声明.属性) || 声明.值 === 'none') {
          continue;
        }
        for (const 段 of 声明.值.split(',')) {
          const 名 = 首词(段);
          if (!布局触发属性.has(名)) {
            continue;
          }
          const 中 = 例外命中(例外表, 则.选择器, 声明.属性, 段.trim());
          if (中 !== null) {
            已用例外.add(中);
            continue;
          }
          违例.push(`${项.路径} → ${则.选择器} 把 ${名} 放进 ${声明.属性}，布局属性动效会触发布局与重绘`);
        }
      }
    }
  }
  return { 违例, 已用例外 };
}

function 扫描关键帧布局(样式表: { 路径: string; 文本: string }[], 例外表: 例外[] = []): { 违例: string[]; 已用例外: Set<例外> } {
  const 违例: string[] = [];
  const 已用例外 = new Set<例外>();
  for (const 项 of 样式表) {
    for (const 组 of 关键帧表(项.文本)) {
      for (const 帧 of 组.帧) {
        for (const 声明 of 声明列表(帧.体内)) {
          if (合成层属性.has(声明.属性)) {
            continue;
          }
          const 中 = 例外命中(例外表, 组.名, 声明.属性, 声明.值);
          if (中 !== null) {
            已用例外.add(中);
            continue;
          }
          违例.push(`${项.路径} → @keyframes ${组.名} 的 ${帧.选择器} 动了 ${声明.属性}，关键帧只允许 transform 与 opacity`);
        }
      }
    }
  }
  return { 违例, 已用例外 };
}

const 节奏例外: 例外[] = [
  {
    选择器: /:-webkit-autofill/,
    属性: /^transition$/,
    值: /5000s/,
    理由: 'Chrome autofill 背景色兜底：5000s 不是节奏值而是「永不淡出」技巧，且被 视图守卫 的 autofill 断言锁死',
  },
];

const 过渡布局例外: 例外[] = [
  { 选择器: /^\.条充$/, 属性: /^transition$/, 值: /^width/, 理由: '进度条填充的语义即宽度，换 transform:scaleX 要改 DOM，属 FP-05 组件动效面' },
  { 选择器: /\.外壳$/, 属性: /^transition$/, 值: /var\(--时长微\)/, 理由: '侧栏轨道塌合只能动 grid-template-columns，时长已锁到最短档 token，代价登记在 docs/动效规范.md' },
];

const 关键帧布局例外: 例外[] = [
  { 选择器: /^描线现$/, 属性: /^stroke-dashoffset$/, 理由: 'SVG 描线的既有语义，dashoffset 不参与 HTML 布局' },
];

const 填充模式位 = /(?:^|\s)(?:both|forwards)(?:\s|$)/;

const 隐形基态: { 属性: RegExp; 隐藏: (值: string) => boolean; 说明: string }[] = [
  { 属性: /^stroke-dashoffset$/, 隐藏: (值) => 值 !== '0' && 值 !== 'none', 说明: '描边偏移非零即整条路径被推到可视范围外' },
  { 属性: /^opacity$/, 隐藏: (值) => Number.parseFloat(值) !== 1, 说明: '透明度不足 1 即基态半隐或全隐' },
  { 属性: /^visibility$/, 隐藏: (值) => 值 === 'hidden' || 值 === 'collapse', 说明: 'visibility 隐藏值' },
  { 属性: /^transform$/, 隐藏: (值) => /\bscale[xy]?\(\s*0\s*[,)]/.test(值), 说明: 'scale(0) 的 transform 是隐藏值' },
];

function 扫描填充依赖(样式表: { 路径: string; 文本: string }[]): string[] {
  const 违例: string[] = [];
  for (const 项 of 样式表) {
    for (const 则 of 规则列表(去关键帧(项.文本))) {
      const 声明们 = 声明列表(则.体内);
      const 外包 = 声明们.some(
        (声) => /^(?:animation|animation-fill-mode)$/.test(声.属性) && 填充模式位.test(声.值) && 声.值 !== 'none',
      );
      if (!外包) {
        continue;
      }
      for (const 声明 of 声明们) {
        const 判 = 隐形基态.find((条) => 条.属性.test(声明.属性));
        if (判 !== undefined && 判.隐藏(声明.值)) {
          违例.push(`${项.路径} → ${则.选择器} { ${声明.属性}: ${声明.值} } 把可见终态外包给了 animation 填充（${判.说明}），reduce 通配关掉动画后该节点永久隐形`);
        }
      }
    }
  }
  return 违例;
}

function 减少动效块全表(样式表: { 路径: string; 文本: string }[]): { 路径: string; 选择器: string }[] {
  const 出: { 路径: string; 选择器: string }[] = [];
  for (const 项 of 样式表) {
    let 源 = 项.文本;
    for (let 定位 = 源.indexOf('@media (prefers-reduced-motion'); 定位 >= 0; 定位 = 源.indexOf('@media (prefers-reduced-motion')) {
      const 块 = 括号块从(源, 源.indexOf('{', 定位));
      for (const 则 of 规则列表(块)) {
        if (!/^\*, \*::before, \*::after$/.test(则.选择器) && 声明列表(则.体内).some((声) => /^(?:transition|animation)/.test(声.属性))) {
          出.push({ 路径: 项.路径, 选择器: 则.选择器 });
        }
      }
      源 = 源.slice(定位 + 1);
    }
  }
  return 出;
}

const 全表 = 样式清单();

const 主题样式 = 读('src/主题.css');

const 外壳源 = 读('src/App.vue');

const 动效源 = 读('src/动效.ts');

const 主题模式源 = 读('src/主题模式.ts');

function 顶层块(文本: string, 定位: RegExp): string[] {
  const 出: string[] = [];
  for (const 匹 of [...文本.matchAll(定位)]) {
    const 开 = 文本.indexOf('{', 匹.index);
    if (开 >= 0) {
      出.push(括号块从(文本, 开));
    }
  }
  return 出;
}

function 取令牌表(文本: string): Record<string, string> {
  const 表: Record<string, string> = {};
  for (const 块 of 顶层块(文本, /:root\s*\{/g)) {
    for (const 匹 of 块.matchAll(/--([^\s:]+):\s*([^;]+);/g)) {
      表[匹[1]] = 匹[2].trim();
    }
  }
  return 表;
}

function 运动族(令牌: Record<string, string>): string[] {
  return Object.keys(令牌).filter((名) => /^(?:时长|缓|位移|步进|栏)/.test(名)).sort();
}

function 引用面(): string {
  return 全表.map((项) => 项.文本).join('\n') + 主题模式源;
}

function 选择器集(文本: string): Set<string> {
  return new Set(规则列表(去关键帧(文本)).map((则) => 则.选择器));
}

function 减少动效块(文本: string): string {
  const 定位 = 文本.indexOf('@media (prefers-reduced-motion: reduce)');
  if (定位 < 0) {
    return '';
  }
  return 括号块从(文本, 文本.indexOf('{', 定位));
}

const 导航序 = [...外壳源.matchAll(/\{ 路径: '([^']+)'/g)].map((匹) => 匹[1]);

const 端点 = (路径: string, 需登录 = true): 页面端点 => ({ 路径, 需登录 });

describe('FP-04 运动 token 单一真源', () => {
  it('全站 CSS 与 <style> 的 transition/animation 不含裸时长或裸缓动，白名单逐条有理由', () => {
    const 节奏 = 扫描裸节奏(全表, 节奏例外);
    const 布局 = 扫描布局动效(全表, 过渡布局例外);
    const 帧 = 扫描关键帧布局(全表, 关键帧布局例外);
    expect(节奏.违例).toEqual([]);
    expect(布局.违例).toEqual([]);
    expect(帧.违例).toEqual([]);
    for (const 条 of [...节奏例外, ...过渡布局例外, ...关键帧布局例外]) {
      expect(条.理由.length).toBeGreaterThan(9);
    }
    const 已用 = new Set<例外>([...节奏.已用例外, ...布局.已用例外, ...帧.已用例外]);
    for (const 条 of [...节奏例外, ...过渡布局例外, ...关键帧布局例外]) {
      expect(已用.has(条), `例外「${条.理由}」已无使用者，必须从白名单删除`).toBe(true);
    }
  });

  it('运动 token 族齐五档且每个都被真引用，不留孤立定义', () => {
    const 令牌 = 取令牌表(主题样式);
    const 族 = 运动族(令牌);
    expect(族.length).toBeGreaterThanOrEqual(13);
    for (const 前 of ['时长', '缓', '位移', '步进', '栏']) {
      expect(族.some((名) => 名.startsWith(前)), `运动 token 族缺 ${前} 档`).toBe(true);
    }
    const 面 = 引用面();
    const 孤立 = 族.filter((名) => !面.includes(`var(--${名})`));
    expect(孤立, '孤立 token 定义：定义了却没人 var() 引用它').toEqual([]);
  });

  it('最小时长档 token 存在且被侧栏轨道用掉，轨道动效不得比 120ms 更长', () => {
    const 令牌 = 取令牌表(主题样式);
    const 族 = 运动族(令牌);
    const 毫秒 = (名: string): number => Number.parseFloat(令牌[名]);
    const 最短 = 族.filter((名) => 名.startsWith('时长')).reduce((和, 名) => (毫秒(名) < 毫秒(和) ? 名 : 和), '时长微');
    expect(最短).toBe('时长微');
    expect(外壳源).toMatch(new RegExp(`grid-template-columns var\\(--${最短}\\)`));
  });
});

describe('FP-04 reduced-motion 必须通配且不得回退成手工枚举', () => {
  it('通配三连同时关 transition 与 animation，块内不再有第二条枚举', () => {
    const 块 = 减少动效块(主题样式);
    expect(块.length).toBeGreaterThan(0);
    const 则 = 规则列表(块);
    const 通配 = 则.find((项) => /^\*, \*::before, \*::after$/.test(项.选择器));
    expect(通配, 'reduce 块里没有 *, *::before, *::after 通配规则').toBeDefined();
    expect(通配?.体内).toMatch(/transition:\s*none\s*!important/);
    expect(通配?.体内).toMatch(/animation:\s*none\s*!important/);
    const 多余 = 则.filter((项) => 项.选择器 !== 通配?.选择器 && 声明列表(项.体内).some((声) => 声.属性.startsWith('transition') || 声.属性.startsWith('animation')));
    expect(多余.map((项) => 项.选择器), 'reduce 块又长出了手工枚举名单').toEqual([]);
  });

  it('关掉动画后必须仍看得见：任何把可见终态外包给 animation 填充的基态都判红', () => {
    expect(扫描填充依赖(全表), 'reduce 通配会把 animation 整体关掉，基态自身就必须是可见终态').toEqual([]);
    expect(扫描填充依赖([{ 路径: '脏.css', 文本: '.线 { stroke-dashoffset: 1; animation: 现 1s both; }' }])).toHaveLength(1);
    expect(扫描填充依赖([{ 路径: '脏.css', 文本: '.条 { opacity: 0; animation-fill-mode: forwards; animation-name: 现; }' }])).toHaveLength(1);
    expect(扫描填充依赖([{ 路径: '脏.css', 文本: '.卡 { visibility: hidden; animation: 现 1s infinite both; }' }])).toHaveLength(1);
    expect(扫描填充依赖([{ 路径: '脏.css', 文本: '.点 { transform: scale(0); animation: 现 1s forwards; }' }])).toHaveLength(1);
    expect(扫描填充依赖([{ 路径: '净.css', 文本: '.行 { animation: 上浮 1s backwards; }' }])).toEqual([]);
    expect(扫描填充依赖([{ 路径: '净.css', 文本: '.点 { transform: scale(0.4); opacity: 1; animation: 现 1s forwards; }' }])).toEqual([]);
  });

  it('reduce 枚举禁令覆盖组件 <style> 块：全站任何 reduce 块都不得再长出非通配的节奏选择器', () => {
    expect(减少动效块全表(全表), 'reduce 块回退成手工枚举，且扫描面必须含组件 <style>').toEqual([]);
    expect(减少动效块全表([{ 路径: '脏.vue', 文本: '<style>\n@media (prefers-reduced-motion: reduce) {\n  .新类 {\n    animation: none !important;\n  }\n}\n</style>' }])).toEqual([
      { 路径: '脏.vue', 选择器: '.新类' },
    ]);
  });

  it('反证：把 animation 通配换成旧的枚举清单必须判红', () => {
    const 旧写法 = 主题样式.replace(
      /animation: none !important;/,
      'animation: none !important;\n  }\n\n  .正文 > section, .气泡列 .气泡 {\n    animation: none !important;',
    );
    const 块 = 减少动效块(旧写法);
    const 则 = 规则列表(块);
    const 通配 = 则.find((项) => /^\*, \*::before, \*::after$/.test(项.选择器));
    const 多余 = 则.filter((项) => 项.选择器 !== 通配?.选择器 && 声明列表(项.体内).some((声) => 声.属性.startsWith('animation')));
    expect(多余.length).toBeGreaterThan(0);
    expect(减少动效块(主题样式.replace(/animation: none !important;/, ''))).not.toMatch(/animation:\s*none\s*!important/);
  });
});

describe('FP-04 路由切换过渡接线', () => {
  it('router-view 走 v-slot + Transition，方向由 ref 绑定且序只从 导航 数组派生', () => {
    expect(外壳源).toMatch(/<router-view\s+v-slot="\{\s*Component\s*\}">/);
    expect(外壳源).toMatch(/<Transition[\s\S]{0,160}?<component\s+:is="Component"\s*\/>[\s\S]{0,80}?<\/Transition>/);
    expect(外壳源).toMatch(/:name="页面过渡"/);
    expect(外壳源).toMatch(/mode="out-in"/);
    expect(外壳源).toMatch(/const 导航序 = 导航\.map\(\(项\) => 项\.路径\)/);
    expect(外壳源).toMatch(/页面过渡\.value = 页面过渡名\(导航序/);
    expect(导航序).toEqual([
      '/zhang-hao',
      '/liao-tian',
      '/si-kao-lian',
      '/feng-jin',
      '/shen-ji',
      '/tong-ji',
      '/shen-he',
    ]);
  });

  it('导航数组字面形态与能力位计数不变（后端 RBAC 矩阵直读该正则）', () => {
    expect([...外壳源.matchAll(/需能力: '([^']+)'/g)].map((匹) => 匹[1])).toEqual([
      'cha_kan',
      'cha_kan',
      'cha_kan',
      'cha_kan',
      'cha_kan',
      'tong_ji_xie',
      'cha_kan',
    ]);
  });

  it('动效模块不吃路径字面量，方向函数只接参数，序表全站只有 导航 一份', () => {
    expect(动效源).not.toMatch(/'\/[a-z]/);
    expect(动效源).toMatch(/导航序: readonly string\[\]/);
    expect(外壳源).toMatch(/<router-view/);
  });

  it('前进/后退两族过渡各自齐 enter-active/leave-active/enter-from/leave-to，且只动 transform 与 opacity', () => {
    const 令牌 = 取令牌表(主题样式);
    expect(令牌.时长中).toBeDefined();
    const 则 = 规则列表(去关键帧(主题样式));
    for (const 族 of [过渡前进, 过渡后退]) {
      for (const 后缀 of ['enter-active', 'leave-active', 'enter-from', 'leave-to']) {
        expect(选择器集(主题样式).has(`.${族}-${后缀}`), `${族}-${后缀} 未声明`).toBe(true);
      }
    }
    for (const 族 of [过渡前进, 过渡后退]) {
      const 活跃 = 则.filter((项) => 项.选择器 === `.${族}-enter-active` || 项.选择器 === `.${族}-leave-active`);
      expect(活跃.length).toBe(2);
      for (const 项 of 活跃) {
        for (const 声明 of 声明列表(项.体内)) {
          if (声明.属性 !== 'transition') {
            continue;
          }
          for (const 段 of 声明.值.split(',')) {
            expect(['transform', 'opacity'], `${族} 的 ${项.选择器} 混进了非合成层属性`).toContain(首词(段));
          }
        }
      }
    }
  });

  it('侧栏进出与轨道塌合同档并行：栏 族四条齐且 leave 不动 transform', () => {
    for (const 后缀 of ['enter-active', 'leave-active', 'enter-from', 'leave-to']) {
      expect(选择器集(主题样式).has(`.栏-${后缀}`), `栏-${后缀} 未声明`).toBe(true);
    }
    expect(外壳源).toMatch(/<Transition name="栏">[\s\S]{0,120}?<aside/);
    const 则 = 规则列表(去关键帧(主题样式)).filter((项) => 项.选择器 === '.栏-leave-active');
    expect(则[0]?.体内).not.toMatch(/transform/);
  });

  it('主题切换：类名在 TS 与 CSS 两侧同源，且 add/remove 成对', () => {
    const 类名 = /const 主题过渡类 = '([^']+)'/.exec(主题模式源)?.[1];
    expect(类名, '主题模式.ts 没导出主题过渡类名').toBeTruthy();
    const 则 = 规则列表(去关键帧(主题样式)).filter((项) => 项.选择器.includes(`html.${类名}`));
    expect(则.length).toBe(1);
    expect(则[0].选择器.split(',').map((段) => 段.trim())).toEqual([
      `html.${类名} *`,
      `html.${类名} *::before`,
      `html.${类名} *::after`,
    ]);
    expect(声明列表(则[0].体内)[0]?.值).toMatch(/var\(--时长短\)/);
    expect(主题模式源).toMatch(/classList\.add\(主题过渡类\)/);
    expect(主题模式源).toMatch(/classList\.remove\(主题过渡类\)/);
    expect(主题模式源).toMatch(/getPropertyValue\(过渡时长令牌\)/);
    expect(主题模式源).toMatch(/const 过渡时长令牌 = '--时长短'/);
  });
});

describe('FP-04 方向判定纯函数', () => {
  it('前进与后退按导航序相对位置判定', () => {
    expect(页面过渡名(导航序, 端点(导航序[0]), 端点(导航序[6]))).toBe(过渡前进);
    expect(页面过渡名(导航序, 端点(导航序[6]), 端点(导航序[0]))).toBe(过渡后退);
    expect(页面过渡名(导航序, 端点(导航序[3]), 端点(导航序[4]))).toBe(过渡前进);
    expect(页面过渡名(导航序, 端点(导航序[4]), 端点(导航序[3]))).toBe(过渡后退);
  });

  it('登录页与业务页互跳：进业务页为前进，回登录页为后退', () => {
    expect(页面过渡名(导航序, 端点('/deng-lu', false), 端点(导航序[0]))).toBe(过渡前进);
    expect(页面过渡名(导航序, 端点(导航序[2]), 端点('/deng-lu', false))).toBe(过渡后退);
    expect(页面过渡名(导航序, 端点('/deng-lu', false), 端点('/deng-lu', false))).toBe(过渡前进);
  });

  it('同序位靠路径深度定方向：列表进详情前进，详情回列表后退', () => {
    expect(页面过渡名(导航序, 端点('/zhang-hao'), 端点('/zhang-hao/42'))).toBe(过渡前进);
    expect(页面过渡名(导航序, 端点('/zhang-hao/42'), 端点('/zhang-hao'))).toBe(过渡后退);
    expect(页面过渡名(导航序, 端点('/zhang-hao/42'), 端点('/zhang-hao/43'))).toBe(过渡前进);
  });

  it('未知路径不猜序：离开登记表后退、进入登记表前进，两边都不认识时中性前进', () => {
    expect(页面过渡名(导航序, 端点(导航序[1]), 端点('/wei-zhi'))).toBe(过渡后退);
    expect(页面过渡名(导航序, 端点('/wei-zhi'), 端点(导航序[1]))).toBe(过渡前进);
    expect(页面过渡名(导航序, 端点('/wei-zhi'), 端点('/ye-zhi-wei-zhi'))).toBe(过渡前进);
    expect(页面过渡名([], 端点('/zhang-hao'), 端点('/liao-tian'))).toBe(过渡前进);
  });

  it('首屏没有上一页时中性前进，且旧页端点不可用时不抛错', () => {
    expect(页面过渡名(导航序, null, 端点(导航序[0]))).toBe(过渡前进);
    expect(页面过渡名([], null, 端点('/deng-lu', false))).toBe(过渡前进);
  });

  it('导航位次取最长前缀，父目录不被子目录抢位', () => {
    const 序 = ['/a', '/a/b', '/b'];
    expect(导航位次(序, '/a')).toBe(0);
    expect(导航位次(序, '/a/b')).toBe(1);
    expect(导航位次(序, '/a/b/7')).toBe(1);
    expect(导航位次(序, '/a/7')).toBe(0);
    expect(导航位次(序, '/ab')).toBe(-1);
    expect(导航位次(序, '/b/1')).toBe(2);
    expect(导航位次(序, '/')).toBe(-1);
  });

  it('反证：故意把后退喂成前进、把 CSS 节奏改回字面量、把序表抄第二份，都必须判红', () => {
    expect(页面过渡名(导航序, 端点(导航序[6]), 端点(导航序[0]))).not.toBe(过渡前进);
    const 脏样式 = `${主题样式}\n.新类 { transition: opacity 200ms ease; }\n`;
    expect(扫描裸节奏([{ 路径: '脏.css', 文本: 脏样式 }], 节奏例外).违例.length).toBe(2);
    expect(扫描布局动效([{ 路径: '脏.css', 文本: '.条 { transition: width 240ms linear; }' }], []).违例.length).toBe(1);
    expect(扫描关键帧布局([{ 路径: '脏.css', 文本: '@keyframes 坏 { from { margin-left: 4px; } }' }], []).违例.length).toBe(1);
    expect(扫描裸节奏([{ 路径: '脏.css', 文本: 'input.输入:-webkit-autofill { transition: background-color 200ms ease; }' }], 节奏例外).违例.length).toBe(2);
    const 抄序表 = `${动效源}\nconst 序 = ['/zhang-hao', '/liao-tian'];\nexport default 序;\n`;
    expect(/'\/[a-z]/.test(抄序表)).toBe(true);
    const 无过渡 = 外壳源.replace(/<Transition[\s\S]{0,160}?<component\s+:is="Component"\s*\/>[\s\S]{0,80}?<\/Transition>/, '<component :is="Component" />');
    expect(无过渡).not.toMatch(/<Transition[\s\S]{0,160}?<component\s+:is="Component"/);
    const 孤立 = `${主题样式}\n:root { --时长未知档: 999ms; }\n`;
    const 令牌 = 取令牌表(主题样式);
    expect(运动族(令牌).length).toBeGreaterThanOrEqual(13);
    expect(运动族(取令牌表(孤立)).includes('时长未知档')).toBe(true);
    expect(引用面().includes('var(--时长未知档)')).toBe(false);
  });
});

describe('FP-05b 层族与站内确认层接线', () => {
  it('确认层组件根真的挂 层 族，且全站 层 族使用者恰好是它的开关节点', () => {
    const 根族 = 内建过渡根族表();
    expect(根族.QueRenCeng, 'QueRenCeng.vue 根节点没有 <Transition name="层">').toBe(内建过渡组件.QueRenCeng);
    expect(族使用者数(条件节点清单(), '层')).toBe(1);
  });

  it('反证：一个未接 层 族、判据又不是恒定四判据的同类面节点必须判红（守卫不空跑）', () => {
    const 站点 = 条件节点清单();
    expect(恒定归类的结果(站点).违例).toEqual([]);
    const 伪造: 条件节点 = { 文件: 'src/components/伪造层.vue', 行: 1, 标签: 'div', 指令: 'if', 表达式: '待执行 !== null', 祖先族: '', 链主判据: '', 直接子: false, 并生循环: false };
    const 结果 = 恒定归类的结果([...站点, 伪造]);
    expect(结果.违例.length).toBe(1);
    expect(结果.违例[0]).toContain('待执行 !== null');
  });
});

type 条件节点 = { 文件: string; 行: number; 标签: string; 指令: string; 表达式: string; 祖先族: string; 链主判据: string; 直接子: boolean; 并生循环: boolean };

const 动效族 = ['条', '块', '组', '层'];

const 动效后缀 = ['enter-active', 'leave-active', 'enter-from', 'leave-to'];

const 内建过渡组件: Record<string, string> = { XiaoXiTiao: '条', ShuJuBiaoGe: '块', QueRenCeng: '层' };

function 分选择器(选择器: string): string[] {
  return 选择器.split(',').map((段) => 段.trim()).filter((段) => 段.length > 0);
}

function 选择器全集聚(文本: string): Set<string> {
  const 出 = new Set<string>();
  for (const 则 of 规则列表(去关键帧(文本))) {
    for (const 段 of 分选择器(则.选择器)) {
      出.add(段);
    }
  }
  return 出;
}

function 标签结束(文本: string, 起: number): number {
  let 引号 = '';
  for (let 下标 = 起; 下标 < 文本.length; 下标++) {
    const 符 = 文本[下标];
    if (引号 !== '') {
      if (符 === 引号) {
        引号 = '';
      }
      continue;
    }
    if (符 === '"' || 符 === "'") {
      引号 = 符;
      continue;
    }
    if (符 === '>') {
      return 下标;
    }
  }
  return -1;
}

function 条件节点扫描(源: string, 路径: string): 条件节点[] {
  const 起 = 源.indexOf('<template');
  const 止 = 源.lastIndexOf('</template>');
  if (起 < 0 || 止 < 0) {
    return [];
  }
  const 模板 = 源.slice(起, 止);
  const 出: 条件节点[] = [];
  const 栈: { 标签: string; 族: string }[] = [];
  const 上父 = new Map<string, 条件节点>();
  const 断了 = new Set<string>();
  let 游标 = 0;
  while (游标 < 模板.length) {
    游标 = 模板.indexOf('<', 游标);
    if (游标 < 0) {
      break;
    }
    if (模板.startsWith('<!--', 游标)) {
      游标 = 模板.indexOf('-->', 游标) + 3;
      continue;
    }
    if (模板.startsWith('</', 游标)) {
      const 闭名 = /^<\/([a-zA-Z0-9-]+)/.exec(模板.slice(游标))?.[1] ?? '';
      const 弹 = 栈.map((项) => 项.标签).lastIndexOf(闭名);
      if (弹 >= 0) {
        栈.length = 弹;
      }
      游标 = 模板.indexOf('>', 游标) + 1;
      continue;
    }
    const 开 = /^<([a-zA-Z0-9-]+)/.exec(模板.slice(游标));
    if (开 === null) {
      游标 += 1;
      continue;
    }
    const 结 = 标签结束(模板, 游标);
    if (结 < 0) {
      break;
    }
    const 属性 = 模板.slice(游标, 结);
    const 匹 = /\sv-(if|else-if|else|show)(?:="([^"]*)")?/.exec(属性);
    const 父 = 栈.map((项) => 项.标签).join('>');
    if (匹) {
      const 祖先 = 栈.filter((项) => 项.族.length > 0);
      const 前 = 上父.get(父);
      const 节点: 条件节点 = {
        文件: 路径,
        行: 源.slice(0, 起 + 游标).split('\n').length,
        标签: 开[1],
        指令: 匹[1],
        表达式: (匹[2] ?? '').trim(),
        祖先族: 祖先.length > 0 ? 祖先[祖先.length - 1].族 : '',
        链主判据: 匹[1] === 'if' || 匹[1] === 'show' || 前 === undefined || 断了.has(父) ? '' : 前.链主判据 || 归类(前),
        直接子: 栈.length > 0 && 栈[栈.length - 1].标签 === 'Transition',
        并生循环: /\sv-for\b/.test(属性),
      };
      上父.set(父, 节点);
      断了.delete(父);
      出.push(节点);
    } else {
      断了.add(父);
    }
    if (!属性.endsWith('/')) {
      栈.push({ 标签: 开[1], 族: 开[1] === 'Transition' ? /name="([^"]+)"/.exec(属性)?.[1] ?? '' : '' });
    }
    游标 = 结 + 1;
  }
  return 出;
}

const 站点缓存 = new Map<string, 条件节点[]>();

function 条件节点清单(目录清单 = ['src/views', 'src/components']): 条件节点[] {
  const 缓存键 = 目录清单.join('|');
  const 已缓存 = 站点缓存.get(缓存键);
  if (已缓存 !== undefined) {
    return 已缓存;
  }
  const 出: 条件节点[] = [];
  function 走(目录: string): void {
    for (const 名 of fs.readdirSync(目录)) {
      const 全 = `${目录}/${名}`;
      if (fs.statSync(全).isDirectory()) {
        走(全);
      } else if (名.endsWith('.vue')) {
        出.push(...条件节点扫描(读(全), 全));
      }
    }
  }
  for (const 目录 of 目录清单) {
    走(目录);
  }
  站点缓存.set(缓存键, 出);
  return 出;
}

function 挂名族清单(路径: string): { 文件: string; 族: string; 动态: boolean }[] {
  if (fs.statSync(路径).isDirectory()) {
    return fs.readdirSync(路径).flatMap((名) => 挂名族清单(`${路径}/${名}`));
  }
  if (!路径.endsWith('.vue')) {
    return [];
  }
  const 源 = 读(路径);
  const 出: { 文件: string; 族: string; 动态: boolean }[] = [];
  let 游 = 0;
  while ((游 = 源.indexOf('<Transition', 游)) >= 0) {
    if (/[a-zA-Z]/.test(源.charAt(游 + 11))) {
      游 += 11;
      continue;
    }
    const 结 = 标签结束(源, 游);
    if (结 < 0) {
      break;
    }
    const 属性 = 源.slice(游, 结);
    const 静 = /\sname="([^"]+)"/.exec(属性);
    出.push({ 文件: 路径, 族: 静 === null ? '' : 静[1], 动态: 静 === null && /\s:name=/.test(属性) });
    游 = 结 + 1;
  }
  return 出;
}

function 内建过渡根族表(): Record<string, string> {
  const 出: Record<string, string> = {};
  for (const 名 of Object.keys(内建过渡组件)) {
    const 源 = 读(`src/components/${名}.vue`).replace(/\n\s*/g, ' ');
    出[名] = /<template> <Transition name="([^"]+)"> <\w+ v-if=/.exec(源)?.[1] ?? '';
  }
  return 出;
}

function 函数体(源: string, 名: string): string {
  const 声明 = new RegExp(`function ${名}\\(`).exec(源);
  if (声明 === null) {
    return '';
  }
  const 开 = 源.indexOf('{', 声明.index);
  return 开 < 0 ? '' : 括号块从(源, 开);
}

const 能力写点封闭 = (仓库: string): boolean => {
  const 全站 = (仓库.match(/能力列表\.value =/g) ?? []).length;
  const 允许 = ['设置身份', '同步存储', '退出登录'].map((名) => 函数体(仓库, 名)).join('\n');
  return 全站 > 0 && 全站 === (允许.match(/能力列表\.value =/g) ?? []).length;
};

const 非测试源码缓存 = new Map<string, string[]>();

function 非测试源码清单(目录 = 'src'): string[] {
  const 已缓存 = 非测试源码缓存.get(目录);
  if (已缓存 !== undefined) {
    return 已缓存;
  }
  const 出: string[] = [];
  for (const 名 of fs.readdirSync(目录)) {
    if (名 === '__tests__') {
      continue;
    }
    const 全 = `${目录}/${名}`;
    if (fs.statSync(全).isDirectory()) {
      出.push(...非测试源码清单(全));
    } else if (名.endsWith('.ts') || 名.endsWith('.vue')) {
      出.push(全);
    }
  }
  非测试源码缓存.set(目录, 出);
  return 出;
}

const 读方越界 = (源: string): boolean => [...源.matchAll(/能力列表\.([\w[]+)/g)].some((匹) => 匹[1] !== 'includes');

const 能力读方封闭 = (): boolean =>
  非测试源码清单()
    .filter((文件) => 文件 !== 'src/stores/登录.ts')
    .every((文件) => !读方越界(读(文件)));

const 冷启动放行前提 = (仓库 = 读('src/stores/登录.ts'), 路由 = 读('src/router/index.ts')): boolean => {
  const 单次闸门 = /function 冷启动会话\(\): Promise<boolean> \{[\s\S]{0,80}?if \(冷启动已续期\) \{[\s\S]{0,80}?冷启动已续期 = true;[\s\S]{0,80}?return 续期会话\(\);/.test(仓库);
  const 守卫等待 = /路由实例\.beforeEach\(async \(目标\) => \{[\s\S]{0,240}?if \(持久令牌冷启动\(\) && 守卫判定\(目标\.path, null, false\) !== null\) \{[\s\S]{0,120}?await 使用登录仓库\(\)\.冷启动会话\(\);[\s\S]{0,240}?return 守卫判定\(目标\.path, 读令牌\(\), 可免登录进入\(\)\)/.test(路由);
  return 单次闸门 && 守卫等待 && /export function 持久令牌冷启动\(\): boolean \{/.test(仓库);
};

let 权限位前提缓存: boolean | undefined;

const 权限位前提 = (): boolean => {
  if (权限位前提缓存 !== undefined) {
    return 权限位前提缓存;
  }
  const 仓库 = 读('src/stores/登录.ts');
  权限位前提缓存 =
    /const 能力列表 = ref<管理能力名\[\]>\(读能力\(\)\)/.test(仓库) && 能力写点封闭(仓库) && 能力读方封闭() && 冷启动放行前提();
  return 权限位前提缓存;
};

const 随行前提缓存 = new Map<string, boolean>();

function 随行前提(文件: string): boolean {
  const 已缓存 = 随行前提缓存.get(文件);
  if (已缓存 !== undefined) {
    return 已缓存;
  }
  const 源 = 读(文件).replace(/\r/g, '');
  const 切换 = [...源.matchAll(/function 切换(?:标签|模式)[^)]*\)\s*:\s*void\s*\{([\s\S]*?)\n\}/g)].map((匹) => 匹[1]);
  const 结果 = 切换.length > 0 && 切换.every((体) => /行列表\.value = \[\]/.test(体));
  随行前提缓存.set(文件, 结果);
  return 结果;
}

const 动态运算符 = /\?|&&|\|\||\.length/;

function 转短横线(名: string): string {
  return 名.replace(/[A-Z]/g, (词) => `-${词.toLowerCase()}`);
}

let vue源清单缓存: string[] | undefined;

function vue源清单(): string[] {
  if (vue源清单缓存 !== undefined) {
    return vue源清单缓存;
  }
  const 出: string[] = [];
  function 走(目录: string): void {
    for (const 名 of fs.readdirSync(目录)) {
      const 全 = `${目录}/${名}`;
      if (fs.statSync(全).isDirectory()) {
        走(全);
      } else if (名.endsWith('.vue')) {
        出.push(全);
      }
    }
  }
  for (const 目录 of ['src/views', 'src/components']) {
    走(目录);
  }
  vue源清单缓存 = [...出, 'src/App.vue'];
  return vue源清单缓存;
}

const 装载实参封闭缓存 = new Map<string, boolean>();

const 装载实参封闭 = (属性名: string): boolean => {
  const 已缓存 = 装载实参封闭缓存.get(属性名);
  if (已缓存 !== undefined) {
    return 已缓存;
  }
  const 绑 = new RegExp(`:${转短横线(属性名)}="([^"]*)"`, 'g');
  const 实参: string[] = [];
  for (const 文件 of vue源清单()) {
    for (const 匹 of 读(文件).matchAll(绑)) {
      实参.push(匹[1].trim());
    }
  }
  const 结果 = 实参.length > 0 && 实参.every((式) => /^[\w\u4e00-\u9fa5]+文案\.[\w\u4e00-\u9fa5]+$/.test(式) || /^'[^']*'$/.test(式));
  装载实参封闭缓存.set(属性名, 结果);
  return 结果;
};

const 恒定判据: { 码: string; 判定: (节点: 条件节点) => boolean; 理由: string }[] = [
  {
    码: '恒定:权限位',
    判定: (节点) => /^登录仓库\.(?:可高危|可封禁|可封禁审核)$/.test(节点.表达式) && 权限位前提(),
    理由: '能力位同步初始化且写点封闭在服务端复核链上；跨浏览器重开的自动登录路径由路由守卫在放行前 await 冷启动会话()，权限视图在首帧即完整',
  },
  {
    码: '恒定:分支',
    判定: (节点) =>
      !动态运算符.test(节点.表达式) &&
      (/^(?:渲染为(?:徽标|链接)\(|quLianJie$|项\.插槽$|mingCheng === )/.test(节点.表达式) || 节点.链主判据 === '恒定:分支'),
    理由: '互斥渲染分支由列定义与 项.插槽 静态选定，同一提交周期内只选一条；表达式含 ?/||/&&/.length 即为动态选形，不得免做',
  },
  {
    码: '恒定:随行',
    判定: (节点) => /^(?:当前标签|模式) === /.test(节点.表达式) && 节点.祖先族.length > 0 && 随行前提(节点.文件),
    理由: '页签门控的行内节点，切换时父级 块 族整块离场再进场，行内节点不会单独被看见',
  },
  {
    码: '恒定:装载属性',
    判定: (节点) => /^[a-zA-Z]+$/.test(节点.表达式) && 属性门控(节点) && 装载实参封闭(节点.表达式),
    理由: '门控位是 defineProps 的静态属性、组件内无同名 ref，且全站调用点实参一律是文案常量或字面量，挂载期恒定',
  },
];

function 属性门控(节点: 条件节点): boolean {
  const 源 = 读(节点.文件);
  const 声明 = /defineProps<\{([^}]*)\}>/.exec(源)?.[1] ?? '';
  return 声明.includes(`${节点.表达式}?`) || 声明.includes(`${节点.表达式}:`) ? !new RegExp(`const ${节点.表达式}\\s*=`).test(源) : false;
}

const 归类缓存 = new WeakMap<条件节点, string>();

function 归类(节点: 条件节点): string {
  if (归类缓存.has(节点)) {
    return 归类缓存.get(节点) ?? '';
  }
  let 结果: string;
  if (节点.并生循环 || (节点.直接子 && 节点.标签 === 'template')) {
    结果 = '';
  } else if (节点.直接子 && 动效族.includes(节点.祖先族)) {
    结果 = `族:${节点.祖先族}`;
  } else {
    结果 = 恒定判据.find((条) => 条.判定(节点))?.码 ?? '';
  }
  归类缓存.set(节点, 结果);
  return 结果;
}

function 恒定归类的结果(站点: 条件节点[]): { 违例: string[]; 已用: Set<string> } {
  const 违例: string[] = [];
  const 已用 = new Set<string>();
  for (const 节点 of 站点) {
    const 码 = 归类(节点);
    if (码 === '') {
      违例.push(`${节点.文件}:${节点.行} <${节点.标签} v-${节点.指令}="${节点.表达式}"> 未接登记族过渡，也不属于任何恒定判据`);
      continue;
    }
    if (码.startsWith('恒定:')) {
      已用.add(码);
    }
  }
  return { 违例, 已用 };
}

function 族使用者数(站点: 条件节点[], 族: string): number {
  return 站点.filter((节点) => 归类(节点) === `族:${族}`).length;
}

function 按判据计数(站点: 条件节点[], 判据: string): number {
  const 目标 = 判据.trim();
  return 站点.filter((节点) => {
    const 码 = 归类(节点);
    return 码 === 目标 || `族:${目标}` === 码;
  }).length;
}

function ast条件节点数(目录清单: string[]): { 总数: number; 明细: Record<string, number> } {
  const 明细: Record<string, number> = {};
  let 总数 = 0;
  function 走(目录: string): void {
    for (const 名 of fs.readdirSync(目录)) {
      const 全 = `${目录}/${名}`;
      if (fs.statSync(全).isDirectory()) {
        走(全);
        continue;
      }
      if (!名.endsWith('.vue')) {
        continue;
      }
      const 解析 = parse(读(全), { filename: 全 });
      if (解析.errors.length > 0) {
        throw new Error(`${全} 编译失败：${解析.errors.map((错) => 错.message).join('；')}`);
      }
      const 根 = 解析.descriptor.template === null ? undefined : 解析.descriptor.template.ast;
      let 计 = 0;
      const 指令名 = new Set(['if', 'else-if', 'else', 'show']);
      function 遍历(节: unknown): void {
        const 项 = 节 as { props?: unknown[]; children?: unknown[] };
        if (Array.isArray(项.props) && 项.props.some((牌) => {
          const 导 = 牌 as { type?: number; name?: string };
          return 导.type === 7 && typeof 导.name === 'string' && 指令名.has(导.name);
        })) {
          计 += 1;
        }
        if (Array.isArray(项.children)) {
          for (const 子 of 项.children) {
            遍历(子);
          }
        }
      }
      if (根) {
        遍历(根);
      }
      明细[全] = 计;
      总数 += 计;
    }
  }
  for (const 目录 of 目录清单) {
    走(目录);
  }
  return { 总数, 明细 };
}

describe('FP-05 组件级动效与瞬时面穷尽', () => {
  it('三族各自齐 enter-active/leave-active/enter-from/leave-to，只动 transform/opacity 且全部引用 token', () => {
    const 则 = 规则列表(去关键帧(主题样式));
    for (const 族 of 动效族) {
      const 缺 = 动效后缀.filter((后缀) => !选择器全集聚(主题样式).has(`.${族}-${后缀}`));
      expect(缺, `${族} 族缺类：${缺.join(', ')}`).toEqual([]);
      for (const 后缀 of ['enter-active', 'leave-active']) {
        const 命 = 则.filter((项) => 分选择器(项.选择器).includes(`.${族}-${后缀}`));
        expect(命.length, `${族}-${后缀} 未声明`).toBe(1);
        for (const 声明 of 声明列表(命[0].体内)) {
          expect(声明.属性).toBe('transition');
          for (const 段 of 声明.值.split(',')) {
            expect(['transform', 'opacity'], `${族}-${后缀} 混进了非合成层属性 ${段}`).toContain(首词(段));
            expect(段).toMatch(/var\(--时长(?:微|短|中)\)/);
            expect(段).toMatch(/var\(--缓(?:出|入)\)/);
          }
        }
      }
      const 起 = 则.filter((项) => 分选择器(项.选择器).includes(`.${族}-enter-from`));
      expect(起.length).toBe(1);
      for (const 声明 of 声明列表(起[0].体内)) {
        if (声明.属性 === 'transform') {
          expect(声明.值).toMatch(/var\(--位移(?:近|中)\)/);
        }
      }
    }
  });

  it('每个登记族都有真实使用者，模板里挂的族名一律在登记表内（僵尸族、野族名与绑定式族名都判红）', () => {
    const 站点 = 条件节点清单();
    for (const 族 of 动效族) {
      expect(族使用者数(站点, 族), `${族} 族已无使用者`).toBeGreaterThan(0);
    }
    const 全部挂名 = ['src/views', 'src/components', 'src/App.vue'].flatMap((目录) => 挂名族清单(目录));
    expect(全部挂名.length).toBeGreaterThan(0);
    const 无名 = 全部挂名.filter((项) => 项.族 === '' && !项.动态).map((项) => 项.文件);
    expect(无名, '<Transition> 未挂字面族名').toEqual([]);
    const 已登记 = new Set([...动效族, '栏', 过渡前进, 过渡后退]);
    const 野 = [...new Set(全部挂名.filter((项) => 项.族 !== '' && !已登记.has(项.族)).map((项) => 项.族))];
    expect(野, '模板里出现未登记的过渡族名').toEqual([]);
    expect(
      全部挂名.filter((项) => 项.动态).map((项) => 项.文件),
      ':name 绑定的族名只允许出现在 App.vue 的方向感知路由过渡一处',
    ).toEqual(['src/App.vue']);
  });

  it('穷尽性：视图与组件的每一个条件节点都必须落到登记族或封闭的恒定判据，落不到即判红', () => {
    const { 违例, 已用 } = 恒定归类的结果(条件节点清单());
    expect(违例, '瞬时面未接过渡：\n' + 违例.join('\n')).toEqual([]);
    for (const 条 of 恒定判据) {
      expect(已用.has(条.码), `恒定判据「${条.码}」已无站点，必须从守卫删除`).toBe(true);
    }
  });

  it('内建过渡组件的根必须真的挂着登记族，否则按 v-if 站点判红（防组件侧偷偷摘掉 Transition）', () => {
    const 根族 = 内建过渡根族表();
    for (const 组件 of Object.keys(内建过渡组件)) {
      expect(根族[组件], `${组件}.vue 的根节点不再有 <Transition> 包裹`).toBe(内建过渡组件[组件]);
    }
  });

  it('reduced-motion 通配必须覆盖新族：族类名不得出现在 reduce 块或任何 !important 绕过位', () => {
    const 块 = 减少动效块(主题样式);
    expect(块).toMatch(/transition: none !important;/);
    for (const 族 of 动效族) {
      expect(块, `${族} 族被塞进 reduce 块，回退成手工枚举`).not.toContain(`.${族}-`);
      const 绕过 = 全表.flatMap((项) => 规则列表(去关键帧(项.文本))).filter((项) => 项.选择器.includes(`${族}-`) && /!important/.test(项.体内));
      expect(绕过.map((项) => 项.选择器), `${族} 族用 !important 绕开通配`).toEqual([]);
    }
    const 全站规则 = 全表.flatMap((项) => 规则列表(去关键帧(项.文本)));
    const 带强制 = 全站规则.filter((项) => 声明列表(项.体内).some((声) => /^(?:transition|animation)$/.test(声.属性) && /!important/.test(声.值)));
    expect(带强制.map((项) => 项.选择器.replace(/\s+/g, ' ').trim()).sort(), '!important 动效声明只能有 reduce 通配与主题翻转两处').toEqual([
      '*, *::before, *::after',
      'html.主题过渡 *, html.主题过渡 *::before, html.主题过渡 *::after',
    ]);
  });

  it('动效规范的模式台账必须与源码实测逐行相等（文档不得与实现分叉）', () => {
    const 文档 = 读('../docs/动效规范.md').replace(/\r/g, '');
    const 站点 = 条件节点清单();
    const 行清单 = [...文档.matchAll(/^\|\s*(P\d+)\s*\|\s*([^|]+?)\s*\|\s*(\d+)\s*\|\s*([^|]+?)\s*\|$/gm)];
    expect(行清单.length).toBe(恒定判据.length + 动效族.length);
    let 合计 = 0;
    for (const 匹 of 行清单) {
      const [, 编号, 判据, 数量, 模式名] = 匹;
      const 实 = 按判据计数(站点, 判据);
      合计 += 实;
      expect(`${模式名}|${判据}|${实}`, `台账 ${编号} 的站点数与实测不符`).toBe(`${模式名}|${判据}|${数量}`);
    }
    expect(合计, '台账合计与扫描到的条件节点数不等，说明有站点没进台账').toBe(站点.length);
  });

  it('反证：撤掉时间线包裹、伪造未接过渡的瞬时面、拿掉 leave-to、族里写裸时长，四项都必须判红', () => {
    const 站点 = 条件节点清单();
    const 时间线 = 站点.filter((项) => 项.文件 === 'src/views/思考链.vue' && 项.表达式 === '行列表.length > 0');
    expect(时间线.length).toBe(1);
    const 脏源 = 读('src/views/思考链.vue').replace(/<Transition name="块">(\s*)<ol/, '<ol$1');
    const 脏模板 = 条件节点扫描(脏源, 'src/views/思考链.vue');
    expect(恒定归类的结果(脏模板).违例.some((项) => 项.includes('行列表.length > 0'))).toBe(true);
    const 伪造: 条件节点[] = [...站点, { 文件: 'src/views/伪造.vue', 行: 1, 标签: 'div', 指令: 'if', 表达式: '某流水.length > 0', 祖先族: '', 链主判据: '', 直接子: false, 并生循环: false }];
    expect(恒定归类的结果(伪造).违例.length).toBe(1);
    const 同节点双指令: 条件节点[] = [...站点, { 文件: 'src/views/伪造.vue', 行: 2, 标签: 'tr', 指令: 'if', 表达式: '行.异常', 祖先族: '块', 链主判据: '', 直接子: true, 并生循环: true }];
    expect(恒定归类的结果(同节点双指令).违例.some((项) => 项.includes('行.异常'))).toBe(true);
    const 片段直子: 条件节点[] = [...站点, { 文件: 'src/views/伪造.vue', 行: 3, 标签: 'template', 指令: 'if', 表达式: '错误', 祖先族: '组', 链主判据: '', 直接子: true, 并生循环: false }];
    expect(恒定归类的结果(片段直子).违例.some((项) => 项.includes('v-if="错误"'))).toBe(true);
    const 动态选形: 条件节点[] = [...站点, { 文件: 'src/views/伪造.vue', 行: 4, 标签: 'g', 指令: 'if', 表达式: "mingCheng === 主题 ? 'a' : 'b'", 祖先族: '', 链主判据: '', 直接子: false, 并生循环: false }];
    expect(恒定归类的结果(动态选形).违例.length).toBe(1);
    const 内建根站点: 条件节点[] = [...站点, { 文件: 'src/views/伪造.vue', 行: 5, 标签: 'XiaoXiTiao', 指令: 'if', 表达式: '说明', 祖先族: '', 链主判据: '', 直接子: false, 并生循环: false }];
    expect(恒定归类的结果(内建根站点).违例.some((项) => 项.includes('<XiaoXiTiao'))).toBe(true);
    const 脏样式 = 主题样式.replace(/\.块-leave-to/g, '.块-removed');
    expect(选择器全集聚(主题样式).has('.块-leave-to')).toBe(true);
    expect(动效后缀.filter((后缀) => !选择器全集聚(脏样式).has(`.块-${后缀}`))).toEqual(['leave-to']);
    const 脏节奏 = 扫描裸节奏([{ 路径: '脏.css', 文本: '.条-enter-active { transition: opacity 200ms ease-out; }' }], 节奏例外);
    expect(脏节奏.违例.length).toBe(2);
  });
});

describe('FP-08 离场语义与站点归类修正', () => {
  const 离场屏蔽选择器 = '[class*="-leave-active"]';

  function 离场屏蔽缺陷(样式表: { 路径: string; 文本: string }[]): string[] {
    const 出: string[] = [];
    for (const 项 of 样式表) {
      for (const 则 of 规则列表(去关键帧(项.文本))) {
        for (const 段 of 分选择器(则.选择器)) {
          if (段 !== 离场屏蔽选择器) {
            continue;
          }
          const 声明们 = 声明列表(则.体内);
          const 屏蔽 = 声明们.find((声) => 声.属性 === 'pointer-events');
          if (屏蔽 === undefined || 屏蔽.值 !== 'none' || 声明们.length !== 1) {
            出.push(`${项.路径} 的 ${段} 规则体必须恰好是一条 pointer-events: none`);
          }
        }
      }
    }
    return 出;
  }

  it('台账有独立枚举源：compiler-sfc 的 AST 与正则扫描器逐文件对拼计数，分叉即红', () => {
    const 站 = 条件节点清单();
    const 独立 = ast条件节点数(['src/views', 'src/components']);
    expect(独立.总数, `AST 枚举 ${独立.总数} ≠ 扫描器枚举 ${站.length}，扫描器在漏计`).toBe(站.length);
    const 分组: Record<string, number> = {};
    for (const 项 of 站) {
      分组[项.文件] = (分组[项.文件] ?? 0) + 1;
    }
    const 分叉 = Object.keys(独立.明细)
      .filter((文件) => 独立.明细[文件] !== (分组[文件] ?? 0))
      .map((文件) => `${文件}: AST ${独立.明细[文件]} vs 扫描器 ${分组[文件] ?? 0}`);
    expect(分叉, '扫描器与 AST 逐文件分叉').toEqual([]);
    const 掉一个 = 站.filter((项) => !(项.文件 === 'src/views/思考链.vue' && 项.表达式 === '行列表.length > 0'));
    expect(掉一个.length).toBe(站.length - 1);
    expect(掉一个.length === 独立.总数, '扫描器漏计一个节点就必须被 AST 源抓到').toBe(false);
  });

  it('离场节点在动画期内不得可点：一条后缀通配屏蔽全部族的 leave-active', () => {
    const 命中 = 全表
      .flatMap((项) => 规则列表(去关键帧(项.文本)))
      .filter((则) => 分选择器(则.选择器).includes(离场屏蔽选择器));
    expect(命中.length, '离场屏蔽规则必须存在且只能有一条').toBe(1);
    expect(离场屏蔽缺陷(全表)).toEqual([]);
    const 词 = /^\[class\*="([^"]+)"\]$/.exec(离场屏蔽选择器);
    expect(词?.[1], '屏蔽必须按 -leave-active 后缀通配，写成枚举就能漏掉新族').toBe('-leave-active');
    for (const 族 of [...动效族, '栏', 过渡前进, 过渡后退]) {
      expect(选择器全集聚(主题样式).has(`.${族}-leave-active`), `${族} 族缺 leave-active，通配屏蔽会落空`).toBe(true);
    }
    const 拆掉 = 全表.map((项) => ({ 路径: 项.路径, 文本: 项.文本.replace(/\[class\*="-leave-active"\]\s*\{\s*pointer-events:\s*none;\s*\}/, '[class*="-leave-active"] {\n  color: inherit;\n}') }));
    expect(离场屏蔽缺陷(拆掉)).toHaveLength(1);
  });

  it('QueRenCeng 的 aria 锚点实例内唯一，全站挂载点仍按台账登记为一处', () => {
    const 挂载点 = vue源清单().filter((文件) => 文件 !== 'src/components/QueRenCeng.vue' && /<QueRenCeng[\s>]/.test(读(文件)));
    expect(挂载点, '台账 P8 只登记一处挂载点；新增站点要先同步 §十 台账与站点数').toEqual(['src/views/账号列表.vue']);
    const 声明 = 读('src/components/QueRenCeng.vue');
    const 锚点 = [...声明.matchAll(/(:?)aria-(?:labelledby|describedby)="([^"]+)"/g)].map((匹) => ({ 静态: 匹[1] === '', 值: 匹[2] }));
    expect(锚点).toHaveLength(2);
    expect(锚点.filter((项) => 项.静态).map((项) => 项.值), '静态 aria 锚点会让同页第二个实例互相指错节点，必须绑实例内唯一 id').toEqual([]);
    expect([...声明.matchAll(/\sid="/g)].length, '组件内不得再留静态 id 字面量').toBe(0);
    const 声明的id = [...声明.matchAll(/:id="([^"]+)"/g)].map((匹) => 匹[1]).sort();
    expect(声明的id).toHaveLength(2);
    expect(锚点.map((项) => 项.值).sort()).toEqual(声明的id);
  });

  it('恒定:内建过渡判据已废除：组件根自带族过渡不再为调用点的 v-if 免做', () => {
    expect(恒定判据.map((条) => 条.码)).not.toContain('恒定:内建过渡');
    expect(条件节点清单().some((节点) => Object.prototype.hasOwnProperty.call(内建过渡组件, 节点.标签)), '内建过渡组件的调用点不得再写 v-if').toBe(false);
    const 外壳模板 = 读('src/views/思考链.vue');
    expect(外壳模板).toMatch(/:xian-shi="说明错误 === null && \(!说明 \|\| 说明\.dai_bu_chong\.length === 0\)"/);
    expect(外壳模板).not.toMatch(/<XiaoXiTiao\s+v-if=/);
  });

  it('P4 前提是机器可检的封闭判据，不是存在性检查', () => {
    expect(权限位前提(), '恒定:权限位的三条前提必须同时成立：同步初始化 + 写读点封闭 + 守卫放行前已 await').toBe(true);
    expect(读方越界('const 补位 = () => 登录仓库.能力列表.push(\'gao_we\');'), '外部改数组能绕过挂载期恒定').toBe(true);
    expect(读方越界('const 清空 = () => { 登录仓库.能力列表.value = []; };')).toBe(true);
    expect(读方越界('const 可见 = computed(() => 导航.filter((项) => 登录仓库.能力列表.includes(项.需能力)));')).toBe(false);
    expect(能力写点封闭('function 设置身份(): void {\n    能力列表.value = [];\n  }\n  function 别处(): void {\n    能力列表.value = [];\n  }')).toBe(false);
    expect(能力写点封闭('function 设置身份(): void {\n    能力列表.value = [];\n  }')).toBe(true);
    const 路由源 = 读('src/router/index.ts');
    expect(冷启动放行前提(读('src/stores/登录.ts'), 路由源.replace('beforeEach(async', 'beforeEach(').replace('await 使用登录仓库().冷启动会话();', '')), '守卫退回同步放行必须让前提判红').toBe(false);
    expect(冷启动放行前提(读('src/stores/登录.ts').replace('冷启动已续期 = true;', ''), 路由源), '单次闸门被摘掉必须让前提判红').toBe(false);
    expect(冷启动放行前提(读('src/stores/登录.ts').replace('export function 持久令牌冷启动', 'function 持久令牌冷启动'), 路由源), '冷启动判定不再是导出真源必须让前提判红').toBe(false);
  });

  it('待补充空态经 条 族在两向都真的消费 enter 与 leave 类', async () => {
    const { default: XiaoXiTiao } = await import('../components/XiaoXiTiao.vue');
    const 原始 = window.getComputedStyle;
    const 等 = (毫秒: number): Promise<void> => new Promise((完成) => setTimeout(完成, 毫秒));
    // jsdom 不注入 CSS，getComputedStyle 的时长恒为 0s，Vue 会跳过过渡帧直接摘节点：
    // 这里把时长桩成真实档位，好让 enter/leave 两类落在 DOM 上可被断言（只桩测试环境，不动实现）。
    vi.spyOn(window, 'getComputedStyle').mockImplementation(((目: Element) => {
      const 样 = 原始(目) as CSSStyleDeclaration;
      return new Proxy(样, {
        get: (标, 键) => {
          if (键 === 'transitionDuration') {
            return '0.16s';
          }
          if (键 === 'transitionDelay') {
            return '0s';
          }
          if (键 === 'transitionProperty') {
            return 'opacity, transform';
          }
          return Reflect.get(标, 键) as never;
        },
      });
    }) as unknown as typeof window.getComputedStyle);
    const 包装 = mount(XiaoXiTiao, { props: { xingTai: 'kong', xianShi: false, wenBen: '待补充' }, attachTo: document.body });
    const 场内 = (): Element | null => document.body.querySelector('.空态');
    const 类名 = (): string[] => (场内() === null ? [] : [...场内()!.classList]);
    async function 等条件(谓词: () => boolean, 说明: string): Promise<void> {
      for (let 次 = 0; 次 < 40; 次++) {
        if (谓词()) {
          return;
        }
        await 等(25);
      }
      throw new Error(`${说明}；实际类名：${类名().join(' ')}`);
    }
    try {
      expect(场内()).toBe(null);
      await 包装.setProps({ xianShi: true });
      await nextTick();
      expect(类名()).toEqual(expect.arrayContaining(['空态', '条-enter-from', '条-enter-active']));
      await 等条件(() => !类名().some((名) => 名.startsWith('条-')), '入场过渡类未在时限内收敛');
      await 包装.setProps({ xianShi: false });
      await 等条件(() => 类名().includes('条-leave-active'), '离场帧未出现 条-leave-active，说明没有出动画');
      expect(场内(), '离场帧必须仍在场内').not.toBe(null);
      await 等条件(() => 场内() === null, '离场结束后节点未被摘除');
    } finally {
      vi.restoreAllMocks();
      包装.unmount();
    }
  });
});

const 探针甲 = { render: () => h('section', '甲页') };

const 探针乙 = { render: () => h('section', '乙页') };

const 等帧 = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 60));

describe('FP-04 路由过渡落地时序', () => {
  const 探针序 = ['/tan', '/lu'];

  const 探针宿主 = {
    setup() {
      const 当前路由 = useRoute();
      const 端点流 = computed<页面端点>(() => ({
        路径: 当前路由.path,
        需登录: (当前路由.meta as { xuYaoDengLu?: boolean }).xuYaoDengLu ?? true,
      }));
      const 名 = ref<过渡名>(过渡前进);
      const 已提交端点 = ref<页面端点 | null>(null);
      watch(
        端点流,
        (新端点) => {
          名.value = 页面过渡名(探针序, 已提交端点.value, 新端点);
          if (当前路由.matched.length > 0) {
            已提交端点.value = 新端点;
          }
        },
        { immediate: true },
      );
      return () =>
        h('div', { class: 'tan-zhen' }, [
          h(resolveComponent('router-view'), null, {
            default: (槽: { Component: unknown }) =>
              h(Transition, { name: 名.value, mode: 'out-in', appear: true }, {
                default: () => (槽.Component ? h(槽.Component as never) : h('i')),
              }),
          }),
          h('i', { class: 'guo-du-dang' }, 名.value),
        ]);
    },
  };

  const 档 = (包装: ReturnType<typeof mount>): string => 包装.get('.guo-du-dang').text();

  it('切页那一帧的过渡档已是正确方向，且 out-in 期间不并存两份页面内容', async () => {
    const 路由器 = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/tan', component: 探针甲, meta: { xuYaoDengLu: true } },
        { path: '/lu', component: 探针乙, meta: { xuYaoDengLu: false } },
      ],
    });
    await 路由器.push('/tan');
    await 路由器.isReady();
    const 包装 = mount(探针宿主, { global: { plugins: [路由器] }, attachTo: document.body });
    expect(包装.findAll('section')).toHaveLength(1);
    expect(包装.text()).toContain('甲页');
    expect(档(包装)).toBe(过渡前进);
    await 路由器.push('/lu');
    await nextTick();
    expect(包装.findAll('section')).toHaveLength(1);
    expect(档(包装)).toBe(过渡后退);
    await 等帧();
    expect(包装.findAll('section')).toHaveLength(1);
    expect(包装.text()).toContain('乙页');
    expect(包装.text()).not.toContain('甲页');
    await 路由器.push('/tan');
    await nextTick();
    expect(包装.findAll('section')).toHaveLength(1);
    expect(档(包装)).toBe(过渡前进);
    await 等帧();
    expect(包装.findAll('section')).toHaveLength(1);
    expect(包装.text()).toContain('甲页');
    expect(包装.text()).not.toContain('乙页');
    包装.unmount();
  });

  it('FP-10 DEF-2 冷启动首个页面判为中性前进：无导航序关系的路径不得判成后退', async () => {
    const 路由器 = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/lu', component: 探针乙, meta: { xuYaoDengLu: false } },
        { path: '/tan', component: 探针甲, meta: { xuYaoDengLu: true } },
        { path: '/:pathMatch(.*)*', component: { render: () => null } },
      ],
    });
    const 包装 = mount(探针宿主, { global: { plugins: [路由器] }, attachTo: document.body });
    expect(档(包装), '初始导航尚未落地时仍是中性前进').toBe(过渡前进);
    void 路由器.push('/lu');
    await 等帧();
    expect(包装.text()).toContain('乙页');
    expect(档(包装), '冷启动进入免登录页与首屏之间没有导航序关系，判后退等于把「进入应用」演成「退回上一页」').toBe(过渡前进);
    await 路由器.push('/tan');
    await nextTick();
    expect(档(包装), '真进需登录页照旧前进（§二 判据 2 不退化）').toBe(过渡前进);
    await 路由器.push('/lu');
    await nextTick();
    expect(档(包装), '站内回免登录页照旧后退（本修只改无导航序关系的首屏）').toBe(过渡后退);
    包装.unmount();
  });

  it('外壳的方向接线以「已提交端点」为唯一上一页真源，不把 START_LOCATION 占位路由当上一页', () => {
    expect(外壳源, '首帧方向改由 已提交端点 承载后，探针宿主与外壳必须同源').toMatch(/页面过渡\.value = 页面过渡名\(导航序, 已提交端点\.value, 新端点\)/);
    expect(外壳源, '把 vue-router 的占位起始路由当「上一页」就是 DEF-2 的根因').not.toMatch(/旧端点 \?\? null/);
  });
});
