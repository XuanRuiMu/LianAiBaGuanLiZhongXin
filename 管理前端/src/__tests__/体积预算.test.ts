import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { 源码指纹 } from '../构建指纹';

const 统计文件 = 'dist/build-stats.json';
const 首屏预算字节 = 49_160;
const 全站预算字节 = 88_800;
const 首屏原始预算字节 = 126_070;
const FP15前首屏实测字节 = 48_768;
const FP15前全站基线字节 = 84_300;
/**
 * FP-16 增量申报（两笔，均带实测与产物证据）：
 *
 * 一、玩家可见文本独立审查：新增面向管理员的准确指引文案 `通用文案.确认后重试`
 * （XU_YAO「需再次确认」可重试，原先被粗粒度前缀归到「按提示修正后重新提交」，与可重试按钮矛盾）。
 * 首屏 gzip 48_936 → 48_953（+17B）、全站 87_630 → 87_691（+61B）。
 *
 * 二、就绪与重试收口：`retryAfterMs` 倒计时与重试锁（`api/错误展示.ts`）、traceId 折叠诊断区
 * （`components/XiaoXiTiao.vue`）、懒加载壳层就绪条（`components/就绪错误条.vue` ＋
 * `api/探针.ts`）。首屏只多出壳层装载器（`App.vue` 走
 * `import('./components/就绪错误条.vue')`），探针、错误状态机与错误条组件都不进首屏分块，
 * 由 `FP16重试与就绪收口.test.ts` 的源码断言与产物指纹断言双向锁死。
 * 首屏 gzip 48_953 → 49_143（+190B，仍在 49_160 硬门内，余量 17B）、
 * 首屏原始 125_214 → 125_680（+466B，仍在 126_070 硬门内，余量 390B）。
 *
 * 全站增量按对照实验拆成两笔：摘掉就绪条装载器后实测 88_070，即倒计时与折叠诊断本身
 * 占 379B；接上懒加载就绪条再加 572B（就绪条分块 397B ＋ 默认分块把共享的错误条与错误
 * 状态机单独成块后十个视图各改写一次 import 约 180B）。三项合计 951B，默认分块下与
 * 旧全站裁定值 88_000（余量仅 309B）不可兼得：首屏两门不抬，全站门由负责人裁决重锚为
 * 88_700。实测锁一律取当前 build 的真实值，不得设成高于实际（由「源码指纹与固定实测字节
 * 绑定」判红）。
 *
 * FP-19（浏览器取证）增量：`api/错误展示.ts` 的句末标点归一与摘要/详情拼装、
 * `components/XiaoXiTiao.vue` 的折叠诊断、`components/ShuJuBiaoGe.vue` 的表格滚动容器、
 * `主题.css` 与 `App.vue` 的窄屏档（表格 min-width、条值列按视口收缩、min-width:0 链、
 * 移动端导航横条）。全站 88_642 → 88_787（+145B：CSS 约 +69B、错误条拼装 +43B、表格容器
 * +23B），首屏 49_143 → 49_140（−3B：窄屏规则全在 CSS 分块，而首屏门只计
 * `assets/index-*.js`）、首屏原始 125_680 未变。这笔增量有测试与产物证据：
 * `FP19标点与窄屏布局.test.ts` 锁三种标点入参、滚动容器、`min-width:0` 链、禁全局裁切与
 * 四档布局不变量，真机 320/390/768/1280 复核 `documentElement.scrollWidth ≤ innerWidth`。
 * 该增量已由负责人批准，全站门随之重锚 88_700 → **88,800**；首屏两条硬门 49_160 / 126_070
 * 保持不变、继续守住。不做杠杆②（`列定义 → 枚举映射` 按视图切分），不砍功能，不删测试。
 * 实测锁仍取当前 build 的真实值，不得设成高于实际。
 *
 * FP-19 复测追加（操作区窄容器逐字换行）：判据从视口宽度改成容器宽度——真机 1024px 视口
 * （正文容器仅 686px）同样复现按钮 122px、行高 308px，故 `.表滚` 声明 `container-type:
 * inline-size`，`@container (max-width: 56rem)` 内同时声明 `.账簿表 td { white-space: nowrap }`
 * 与 `.账簿表 td.操作 { flex-wrap: nowrap }`：单元格文本不断行 → 表格 min-content 抬到
 * 1011px → 操作列按内容拿满宽度 → 按钮不再压到 1 字宽逐字换行；页面本身不溢出，容器内横滚。
 * 两项都只写在容器档内：基础档 `.账簿表 td.操作` 仍是 `flex-wrap: wrap`，桌面 942px 容器不
 * 命中 56rem 档 → 桌面排版与改动前逐字一致（行高 120–121px 是改动前就有的两行操作区，
 * 要压到单行就得让桌面表格横滚 69px，那才是桌面布局变更，故不做）。
 * 为抵消本轮字节，`api/错误展示.ts` 的 18 个十进制指纹换成同顺序的 18 个错误码字符串
 * （集合与顺序经 node 逐位校验相等，`映射守卫.test.ts` 18 项覆盖行为）：随机数字不可压缩，
 * 反而比可压缩的码串多花 69B gzip，同时删掉 `码指纹` 函数，语义不变。
 * 真机复核 320/390/768/1024：行高 67–68px、按钮 45px 单行、逐字换行按钮 0 个、整页无横向
 * 溢出、按钮可聚焦；1280 桌面：按钮 45px、逐字 0、行高与改动前一致；`/feng-jin` 表格在双栏
 * 网格内 390px 视口行高 49px、整页无横向溢出（`.表滚` 去掉 `min-width: 0`，改由 containment
 * 让内在尺寸不参与网格拉伸，FP-19 断言同步改为「网格轨 min-width:0 + 滚动容器 containment」）。
 * 体积：首屏 49_143 → 49_142（−1B）、首屏原始 125_680 未变、全站 88_787 → 88_720（−67B）。
 */
const 首屏实测字节 = 49_142;
const 首屏原始实测字节 = 125_680;
const 全站实测字节 = 88_720;
const 允许余量字节 = 全站预算字节 - 全站实测字节;

interface 分块度量 {
  名称: string;
  字节数: number;
  gzip字节数: number;
}

interface 体积统计 {
  清单: 分块度量[];
  源码指纹: string;
}

function 解析统计(原文: string): 体积统计 {
  const 统计 = JSON.parse(原文) as 体积统计;
  if (!Array.isArray(统计.清单) || 统计.清单.length === 0) {
    throw new Error('build-stats.json 没有有效产物清单');
  }
  if (!/^[a-f0-9]{64}$/.test(统计.源码指纹)) {
    throw new Error('build-stats.json 缺少有效源码指纹');
  }
  if (统计.源码指纹 !== 源码指纹()) {
    throw new Error('源码已变更，请先重新 build');
  }
  for (const 项 of 统计.清单) {
    if (项.字节数 <= 0 || 项.gzip字节数 <= 0) {
      throw new Error(`产物度量无效：${项.名称}`);
    }
  }
  return 统计;
}

function 读取统计(): 体积统计 {
  return 解析统计(fs.readFileSync(统计文件, 'utf8'));
}

function 体积统计Of(清单: 分块度量[]): 体积统计 {
  return { 清单, 源码指纹: 源码指纹() };
}

function 取首屏(统计: 体积统计): 分块度量 {
  const 首屏 = 统计.清单.find((项) => 项.名称.startsWith('assets/index-') && 项.名称.endsWith('.js'));
  if (首屏 === undefined) {
    throw new Error('build-stats.json 缺少首屏 index 分块');
  }
  return 首屏;
}

function 取全站(统计: 体积统计): 分块度量[] {
  const 全站 = 统计.清单.filter(
    (项) => 项.名称.startsWith('assets/') && (项.名称.endsWith('.js') || 项.名称.endsWith('.css')),
  );
  if (全站.length === 0) {
    throw new Error('build-stats.json 缺少全站 js/css 分块');
  }
  return 全站;
}

function 求全站Gzip(统计: 体积统计): number {
  return 取全站(统计).reduce((和, 项) => 和 + 项.gzip字节数, 0);
}

describe('构建体积预算', () => {
  it('首屏 index 分块 gzip 不超过 49.16kB 硬指标', () => {
    const 统计 = 读取统计();
    expect(取首屏(统计).gzip字节数).toBeLessThanOrEqual(首屏预算字节);
  });

  it('首屏 index 原始字节不超过 126.07kB 硬指标', () => {
    const 统计 = 读取统计();
    expect(取首屏(统计).字节数).toBeLessThanOrEqual(首屏原始预算字节);
  });

  it('全站 js 与 css 分块 gzip 之和不超过 88.80kB 硬指标，并保留 80B 余量', () => {
    const 统计 = 读取统计();
    const 全站gzip字节 = 求全站Gzip(统计);
    expect(全站gzip字节).toBeLessThanOrEqual(全站预算字节);
    expect(全站预算字节 - 全站gzip字节).toBe(允许余量字节);
  });

  it('源码指纹与当前源码及固定实测字节绑定', () => {
    const 统计 = 读取统计();
    const 首屏 = 取首屏(统计);
    expect(统计.源码指纹).toMatch(/^[a-f0-9]{64}$/);
    expect(统计.源码指纹).toBe(源码指纹());
    expect(首屏.gzip字节数).toBe(首屏实测字节);
    expect(首屏.字节数).toBe(首屏原始实测字节);
    expect(求全站Gzip(统计)).toBe(全站实测字节);
  });

  it('首屏硬门不变、全站门按 FP-19 批准增量重锚为 88,800B（余量 80B）', () => {
    expect(首屏预算字节).toBe(49_160);
    expect(首屏原始预算字节).toBe(126_070);
    expect(全站预算字节).toBe(88_800);
    expect(首屏实测字节).toBe(49_142);
    expect(首屏原始实测字节).toBe(125_680);
    expect(全站实测字节).toBe(88_720);
    expect(首屏预算字节 - 首屏实测字节).toBe(18);
    expect(首屏原始预算字节 - 首屏原始实测字节).toBe(390);
    expect(全站预算字节 - 全站实测字节).toBe(80);
    expect(允许余量字节).toBe(80);
    expect(首屏实测字节 - FP15前首屏实测字节).toBe(374);
    expect(全站实测字节 - FP15前全站基线字节).toBe(4_420);
  });

  it('反证：缺文件、空清单和源码指纹篡改都必须判红', () => {
    const 统计 = 读取统计();
    const 改指纹 = (值: string): string => JSON.stringify({ ...统计, 源码指纹: 值 });
    expect(() => fs.readFileSync('dist/不存在的-build-stats.json', 'utf8')).toThrow();
    expect(() => 解析统计(JSON.stringify({ 清单: [], 源码指纹: 统计.源码指纹 }))).toThrow(/有效产物清单/);
    expect(() => 解析统计(改指纹(''))).toThrow(/有效源码指纹/);
    expect(() => 解析统计(改指纹('f'.repeat(64)))).toThrow(/源码已变更/);
  });

  it('反证：预算、清单或度量值被改写时不能空跑', () => {
    const 统计 = 读取统计();
    const 首屏 = 取首屏(统计);
    const 全站 = 取全站(统计);
    const 全站gzip字节 = 求全站Gzip(统计);
    const 原始字节求和 = 全站.reduce((和, 项) => 和 + 项.字节数, 0);
    expect(首屏.gzip字节数 + 3_000 > 首屏预算字节).toBe(true);
    expect(首屏.字节数 + 3_000 > 首屏原始预算字节).toBe(true);
    expect(全站gzip字节 + 3_000 > 全站预算字节).toBe(true);
    expect(原始字节求和).toBeGreaterThan(全站预算字节);
    expect(全站.length).toBeGreaterThan(0);
  });

  it('反证：余量与门锁都不得空跑，度量少一字节或改门都要判红', () => {
    const 统计 = 读取统计();
    const 全站 = 取全站(统计);
    expect(全站预算字节 - 求全站Gzip(统计)).toBe(允许余量字节);
    const 少一字节 = 体积统计Of(全站.map((项, 序) => (序 === 0 ? { ...项, gzip字节数: 项.gzip字节数 - 1 } : 项)));
    expect(全站预算字节 - 求全站Gzip(少一字节)).not.toBe(允许余量字节);
    expect(全站预算字节 - 求全站Gzip(少一字节)).toBe(允许余量字节 + 1);
    const 多一字节 = 体积统计Of(全站.map((项, 序) => (序 === 0 ? { ...项, gzip字节数: 项.gzip字节数 + 1 } : 项)));
    expect(全站预算字节 - 求全站Gzip(多一字节)).toBe(允许余量字节 - 1);
    expect(() => expect(全站预算字节 - 求全站Gzip(多一字节)).toBe(允许余量字节)).toThrow();
    expect(全站预算字节).toBeGreaterThan(求全站Gzip(统计));
  });
});
