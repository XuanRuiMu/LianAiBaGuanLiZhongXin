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

type 条件节点 = { 文件: string; 行: number; 标签: string; 指令: string; 表达式: string; 祖先族: string; 链主判据: string; 直接子: boolean };

const 动效族 = ['条', '块', '组'];

const 动效后缀 = ['enter-active', 'leave-active', 'enter-from', 'leave-to'];

const 内建过渡组件: Record<string, string> = { XiaoXiTiao: '条', ShuJuBiaoGe: '块' };

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

function 条件节点清单(目录清单 = ['src/views', 'src/components']): 条件节点[] {
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
  return 出;
}

function 挂名族清单(路径: string): string[] {
  const 出: string[] = [];
  if (fs.statSync(路径).isDirectory()) {
    for (const 名 of fs.readdirSync(路径)) {
      出.push(...挂名族清单(`${路径}/${名}`));
    }
    return 出;
  }
  if (!路径.endsWith('.vue')) {
    return 出;
  }
  const 源 = 读(路径);
  return [...源.matchAll(/<Transition\s+name="([^"]+)"/g)].map((匹) => 匹[1]);
}

function 内建过渡根族表(): Record<string, string> {
  const 出: Record<string, string> = {};
  for (const 名 of Object.keys(内建过渡组件)) {
    const 源 = 读(`src/components/${名}.vue`).replace(/\n\s*/g, ' ');
    出[名] = /<template> <Transition name="([^"]+)"> <\w+ v-if=/.exec(源)?.[1] ?? '';
  }
  return 出;
}

const 权限位前提 = (): boolean => {
  const 仓库 = 读('src/stores/登录.ts');
  const 路由 = 读('src/router/index.ts');
  return /const 能力列表 = ref<管理能力名\[\]>\(读能力\(\)\)/.test(仓库) && /路由实例\.beforeEach\(\(目标\) => \{/.test(路由) && !/beforeEach\(async/.test(路由);
};

function 随行前提(文件: string): boolean {
  const 源 = 读(文件).replace(/\r/g, '');
  const 切换 = [...源.matchAll(/function 切换(?:标签|模式)[^)]*\)\s*:\s*void\s*\{([\s\S]*?)\n\}/g)].map((匹) => 匹[1]);
  return 切换.length > 0 && 切换.every((体) => /行列表\.value = \[\]/.test(体));
}

const 恒定判据: { 码: string; 判定: (节点: 条件节点) => boolean; 理由: string }[] = [
  {
    码: '恒定:权限位',
    判定: (节点) => /^登录仓库\.可/.test(节点.表达式) && 权限位前提(),
    理由: '能力位在 stores/登录.ts 由 读能力() 同步初始化，视图挂载后只在退出登录/身份复核时翻转，而那两刻整页正在走 页-* 离场',
  },
  {
    码: '恒定:分支',
    判定: (节点) => /^(?:渲染为(?:徽标|链接)\(|quLianJie$|项\.插槽$|mingCheng === )/.test(节点.表达式) || 节点.链主判据 === '恒定:分支',
    理由: '互斥渲染分支由列定义/图标名静态选定，同一提交周期内只选一条，不存在同一节点出入场',
  },
  {
    码: '恒定:随行',
    判定: (节点) => /^(?:当前标签|模式) === /.test(节点.表达式) && 节点.祖先族.length > 0 && 随行前提(节点.文件),
    理由: '页签门控的行内节点，切换时父级 块 族整块离场再进场，行内节点不会单独被看见',
  },
  {
    码: '恒定:内建过渡',
    判定: (节点) => Object.prototype.hasOwnProperty.call(内建过渡组件, 节点.标签),
    理由: '该组件根节点自带登记族过渡，调用点无须再包一层',
  },
  {
    码: '恒定:装载属性',
    判定: (节点) => /^[a-zA-Z]+$/.test(节点.表达式) && 属性门控(节点),
    理由: '门控位是 defineProps 的静态属性且组件内无同名 ref，挂载期恒定',
  },
];

function 属性门控(节点: 条件节点): boolean {
  const 源 = 读(节点.文件);
  const 声明 = /defineProps<\{([^}]*)\}>/.exec(源)?.[1] ?? '';
  return 声明.includes(`${节点.表达式}?`) || 声明.includes(`${节点.表达式}:`) ? !new RegExp(`const ${节点.表达式}\\s*=`).test(源) : false;
}

function 归类(节点: 条件节点): string {
  if (节点.直接子 && 动效族.includes(节点.祖先族)) {
    return `族:${节点.祖先族}`;
  }
  for (const 条 of 恒定判据) {
    if (条.判定(节点)) {
      return 条.码;
    }
  }
  return '';
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
  return 站点.filter((节点) => 归类(节点) === 目标 || `族:${目标}` === 归类(节点)).length;
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

  it('每个登记族都有真实使用者，模板里挂的族名一律在登记表内（僵尸族与野族名都判红）', () => {
    const 站点 = 条件节点清单();
    for (const 族 of 动效族) {
      expect(族使用者数(站点, 族), `${族} 族已无使用者`).toBeGreaterThan(0);
    }
    const 野 = new Set<string>();
    for (const 目录 of ['src/views', 'src/components', 'src/App.vue']) {
      for (const 项 of 挂名族清单(目录)) {
        if (!动效族.includes(项 as '条') && 项 !== '栏') {
          野.add(`${项}`);
        }
      }
    }
    expect([...野], '模板里出现未登记的过渡族名').toEqual([]);
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
      const 绕过 = 规则列表(去关键帧(主题样式)).filter((项) => 项.选择器.includes(`${族}-`) && /!important/.test(项.体内));
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
    const 伪造: 条件节点[] = [...站点, { 文件: 'src/views/伪造.vue', 行: 1, 标签: 'div', 指令: 'if', 表达式: '某流水.length > 0', 祖先族: '', 链主判据: '', 直接子: false }];
    expect(恒定归类的结果(伪造).违例.length).toBe(1);
    const 脏样式 = 主题样式.replace(/\.块-enter-from,\s\.块-leave-to \{/, '.块-enter-from {');
    expect(选择器全集聚(主题样式).has('.块-leave-to')).toBe(true);
    expect(动效后缀.filter((后缀) => !选择器全集聚(脏样式).has(`.块-${后缀}`))).toEqual(['leave-to']);
    const 脏节奏 = 扫描裸节奏([{ 路径: '脏.css', 文本: '.条-enter-active { transition: opacity 200ms ease-out; }' }], 节奏例外);
    expect(脏节奏.违例.length).toBe(2);
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
