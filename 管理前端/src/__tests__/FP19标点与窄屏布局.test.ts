import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { mount } from '@vue/test-utils';
import XiaoXiTiao from '../components/XiaoXiTiao.vue';
import { 业务错误 } from '../api/请求';
import { 取错误展示, 拼错误详情, 拼错误摘要 } from '../api/错误展示';

const 主题样式 = fs.readFileSync('src/主题.css', 'utf8');
const 外壳源 = fs.readFileSync('src/App.vue', 'utf8');
const 外壳样式 = /<style scoped>([\s\S]*?)<\/style>/.exec(外壳源)?.[1] ?? '';
const 表格组件源 = fs.readFileSync('src/components/ShuJuBiaoGe.vue', 'utf8');

function 规则体(样式: string, 选择器: string): string {
  const 转义 = 选择器.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[}\\n])\\s*${转义}\\s*\\{([^}]*)\\}`, 'm').exec(样式)?.[1] ?? '';
}

function 媒体块(样式: string, 条件: string, 前缀 = '@media'): string {
  const 起 = 样式.indexOf(`${前缀} (${条件}) {`);
  if (起 < 0) {
    return '';
  }
  let 深 = 0;
  for (let 位 = 起 + `${前缀} (${条件}) {`.length - 1; 位 < 样式.length; 位 += 1) {
    if (样式[位] === '{') {
      深 += 1;
    } else if (样式[位] === '}') {
      深 -= 1;
      if (深 === 0) {
        return 样式.slice(起, 位 + 1);
      }
    }
  }
  return '';
}

const 窄屏主题 = (): string => 媒体块(主题样式, 'max-width: 719px');
const 容器窄 = (): string => 媒体块(主题样式, 'max-width: 56rem', '@container');
const 窄屏外壳 = (): string => 媒体块(外壳样式, 'max-width: 719px');
const 宽屏 = (): string => 媒体块(外壳样式, 'min-width: 960px');

function 服务端错误(消息: string): 业务错误 {
  return new 业务错误({
    code: 'YI_LAI_QUE_SHI',
    message: 消息,
    traceId: 'fp19-pun',
    retryable: true,
  });
}

const 三种入参: ReadonlyArray<readonly [string, string]> = [
  ['句号结尾', '依赖服务暂时不可用，请稍后重试。'],
  ['感叹号叠写', '依赖服务暂时不可用！！'],
  ['无句末标点', '依赖服务暂时不可用'],
];

describe('FP-19 错误摘要标点归一', () => {
  it.each(三种入参)('%s 的后端消息拼装后不得出现叠标点', (_名, 消息) => {
    const 展示 = 取错误展示(服务端错误(消息));
    const 摘要 = 拼错误摘要(展示);
    expect(摘要.startsWith(消息.replace(/[。！？；，、\s]+$/u, ''))).toBe(true);
    expect(摘要).toMatch(/^[^；。！？]*；影响：/u);
    expect(摘要).not.toMatch(/[。！？；，、]\s*[；，、]/u);
    expect(摘要).not.toContain('。。');
    expect(摘要).not.toContain('！！');
    expect(摘要.endsWith(展示.下一步)).toBe(true);
  });

  it.each(三种入参)('%s 落到 DOM 后摘要与固定前缀之间只有一个分隔符', (_名, 消息) => {
    const 展示 = 取错误展示(服务端错误(消息));
    const 包装 = mount(XiaoXiTiao, { props: { xingTai: 'cuo-wu', 错误展示: 展示 } });
    const 摘要 = 包装.get('[data-testid="cuo-wu-zhan-yao"]').text();
    expect(摘要).not.toMatch(/[。！？][；]/u);
    expect(摘要).toMatch(/^[^；。！？]*；影响：/u);
    expect(摘要).toContain(展示.影响);
    expect(摘要).toContain(展示.下一步);
  });

  it('折叠诊断结构保持：诊断区仍带错误码与追踪编号，摘要不带码', () => {
    const 展示 = 取错误展示(服务端错误('依赖服务暂时不可用，请稍后重试。'));
    const 包装 = mount(XiaoXiTiao, { props: { xingTai: 'cuo-wu', 错误展示: 展示, cuoWuMa: 'YI_LAI_QUE_SHI' } });
    const 诊断 = 包装.get('[data-testid="cuo-wu-zhen-dui"]');
    expect(诊断.text()).toContain('YI_LAI_QUE_SHI');
    expect(诊断.text()).toContain(展示.追踪编号);
    expect(拼错误详情(展示)).toContain(展示.错误码);
    expect(包装.get('[data-testid="cuo-wu-zhan-yao"]').text()).not.toContain('YI_LAI_QUE_SHI');
  });

  it('归一只削句末标点，句中标点原样保留', () => {
    const 展示 = 取错误展示(服务端错误('依赖服务缺失，请稍后重试。'));
    expect(拼错误摘要(展示)).toContain('依赖服务缺失，请稍后重试；');
  });
});

describe('FP-19 窄屏不得整页横向溢出', () => {
  it('表格必须落在显式横向滚动容器里，页面本身不滚', () => {
    expect(规则体(主题样式, '.表滚')).toMatch(/overflow-x:\s*auto/u);
    expect(规则体(主题样式, '.表滚')).toMatch(/container-type:\s*inline-size/u);
    expect(表格组件源.replace(/\n\s*/gu, ' ')).toMatch(/<Transition name="块"> <div v-if="[^"]+"\s+class="表滚"\s*> <table class="账簿表">/u);
    expect(表格组件源.replace(/\n\s*/gu, ' ')).toMatch(/<\/table> <\/div> <\/Transition>/u);
  });

  it('min-width:0 边界完整：网格侧栏轨靠 min-width:0，滚动容器靠 inline-size containment', () => {
    expect(规则体(主题样式, '.表滚')).toMatch(/container-type:\s*inline-size/u);
    expect(规则体(外壳样式, '.正文区')).toMatch(/min-width:\s*0/u);
  });

  it('禁止用全局 overflow:hidden 裁内容来假装不溢出', () => {
    for (const 样式 of [主题样式, 外壳样式, 容器窄()]) {
      expect(样式).not.toMatch(/(?:^|[\s,{}])(?:html|body)\s*\{[^}]*overflow-x:\s*hidden/u);
      expect(样式).not.toMatch(/\.外壳\s*\{[^}]*overflow-x:\s*hidden/u);
    }
  });

  it('窄容器内单元格与按钮文案都不逐字换行：判据按容器宽度而非视口宽度', () => {
    expect(规则体(主题样式, '.账簿表 td.操作')).toMatch(/display:\s*flex/u);
    expect(规则体(主题样式, '.账簿表 td.操作')).toMatch(/flex-wrap:\s*wrap/u);
    expect(规则体(主题样式, '.表滚')).toMatch(/container-type:\s*inline-size/u);
    expect(容器窄()).toMatch(/\.账簿表 td \{[^}]*white-space:\s*nowrap/u);
    expect(容器窄()).toMatch(/\.账簿表 td\.操作 \{[^}]*flex-wrap:\s*nowrap/u);
    expect(容器窄()).not.toMatch(/overflow/u);
    expect(主题样式).not.toMatch(/@media \(max-width: 1\d{3}px\)[\s\S]{0,120}账簿表/u);
    expect(规则体(主题样式, '.条值')).toMatch(/min-width:\s*min\(150px, 24vw\)/u);
    expect(规则体(主题样式, '.统计卡组')).toMatch(/grid-template-columns:\s*1fr/u);
    expect(规则体(主题样式, '.账簿 > .字段')).toMatch(/flex:\s*1 1 150px/u);
  });

  it('窄屏按钮保持可聚焦的真实 button，不靠隐藏操作区', () => {
    const 列表源 = fs.readFileSync('src/views/账号列表.vue', 'utf8');
    expect(列表源).toMatch(/data-testid="shou-yu-an-niu"[\s\S]{0,120}?<\/button>/u);
    expect(列表源).toMatch(/data-testid="hui-shou-an-niu"[\s\S]{0,120}?<\/button>/u);
    for (const 源 of [列表源, 主题样式, 容器窄()]) {
      expect(源).not.toMatch(/操作[^{]*\{[^}]*display:\s*none/u);
      expect(源).not.toMatch(/\.操作[^{]*\{[^}]*visibility:\s*hidden/u);
    }
    expect(主题样式).toMatch(/\.按钮次,\s*\.按钮危 \{[^}]*min-height: 42px/u);
  });

  it('768 平板与 1280 桌面不被窄屏规则改动', () => {
    expect(窄屏主题()).not.toMatch(/grid-template-columns/u);
    expect(窄屏外壳()).not.toMatch(/grid-template-columns/u);
    expect(媒体块(主题样式, 'min-width: 768px')).toMatch(/repeat\(2, 1fr\)/u);
    expect(媒体块(主题样式, 'min-width: 1024px')).toMatch(/\.双栏 \{/u);
    expect(规则体(主题样式, '.账簿表')).toMatch(/width:\s*100%/u);
    expect(规则体(主题样式, '.账簿表')).not.toMatch(/min-width/u);
    expect(窄屏主题()).not.toMatch(/\.账簿表/u);
  });
});

describe('FP-19 移动端侧栏可访问', () => {
  it('窄屏把导航改成可横向滚动的横条，桌面仍是竖列', () => {
    expect(规则体(窄屏外壳(), '.栏导航')).toMatch(/flex-direction: row/u);
    expect(规则体(窄屏外壳(), '.栏导航')).toMatch(/overflow-x: auto/u);
    expect(窄屏外壳()).toMatch(/\.栏导航 a,\s*\.栏占位 \{[^}]*flex: none/u);
    expect(宽屏()).toMatch(/\.栏导航 \{[^}]*flex: 1/u);
  });

  it('导航是真 landmark 且链接可聚焦，不靠纯视觉隐藏', () => {
    expect(外壳源).toContain('<nav');
    expect(外壳源).toContain('aria-label');
    expect(外壳源).not.toMatch(/<nav[^>]*aria-hidden/u);
    expect(外壳源).not.toMatch(/<nav[^>]*\shidden/u);
    expect(外壳源).not.toMatch(/<nav[^>]*style="[^"]*display:\s*none/u);
    expect(外壳源).not.toMatch(/tabindex="-1"/u);
  });
});
