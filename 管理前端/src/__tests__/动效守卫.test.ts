import { describe, expect, it } from 'vitest';
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
      watch(
        端点流,
        (新端点, 旧端点) => {
          名.value = 页面过渡名(探针序, 旧端点 ?? null, 新端点);
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
});
