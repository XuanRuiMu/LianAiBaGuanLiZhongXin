import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { 源码指纹 } from '../构建指纹';

interface 分块度量 {
  名称: string;
  字节数: number;
  gzip字节数: number;
}

const 统计文件 = 'dist/build-stats.json';

const 首屏预算字节 = 49_160;
const 全站预算字节 = 84_530;
const 首屏原始预算字节 = 126_070;
// FP-04 本轮实测：App.vue 的路由与侧栏 <Transition> 把 Vue transition 运行时（≈2.37kB gzip）拉进首屏 index，
// 加上运动 token 层与接线共 +2799B（63374→66173）；换取的是全站单一动效路径（不为炫技开第二条渲染路径），
// 故首屏与全站三项裁定值一并上抬，抬幅 = 实测 + ≈500B 紧余量，由主代理按 skill『基线常量变更』放行权批准并记入交付报告
const 首屏实测字节 = 48_670;
// FP-04 起登记的已知杠杆有二：①axios 换原生 fetch（估 -13.9kB gzip，要重写 请求.ts 拦截器与错误归一并重跑接口层全部测试）；
// ②列定义→枚举映射 聚合改为按视图切分。①已于 FP-09 落地：请求层改为浏览器原生 fetch，axios 与其独占传递依赖全部卸载，
// 三项实测回落到 首屏 66303→48670 / 首屏原始 174991→125639 / 全站 101696→84046（gzip 净降 17650B，比登记的 -13.9kB 估幅还多 3.7kB）；
// 三枚裁定值随之从 66690 / 179670 / 101700 下调到「新实测 + ≈500B」，"只会上抬的预算不叫预算"这条口径就此兑现。
// 只剩 ② 未做，仍立专项、不与其他特性混记
// FP-05 本轮实测：3 个过渡族（条/块/组）与 71 站点台账共 +7B 首屏 / +350B 全站（66180 / 100533），三枚裁定值未动；
// 全站余量由 507B 收到 157B，因此 FP-05 判"权限位 17 站点不接动画"（补接成本属外推，≈170B 会撑破现余量），
// 该结论连同退出时序一并交 FP-06 浏览器取证证伪或坐实
// FP-05b 本轮实测：站内确认层（QueRenCeng + 第 4 族 `层`）+1026B 令全站 101559，首次破上一轮裁定值，故裁定值
// 抬到 101700。FP-08 又用掉 141B 余量中的 137B（现 66303 / 101696，剩 4B），但未再破裁定值——
// 说明"每加一个特性就抬一次预算"在这里是被度量拦住的
const 全站实测字节 = 84_046;

function 解析体积统计(原文: string): 分块度量[] {
  const 解析 = JSON.parse(原文) as { 清单?: 分块度量[]; 源码指纹?: string };
  if (!Array.isArray(解析.清单) || 解析.清单.length === 0) {
    throw new Error('build-stats.json 里没有分块清单，构建期度量插件未生效');
  }
  if (typeof 解析.源码指纹 !== 'string' || 解析.源码指纹.length === 0) {
    throw new Error('build-stats.json 缺 源码指纹 字段：体积预算无法证明度量对象就是当前源码，请重新 build');
  }
  const 当前 = 源码指纹();
  if (解析.源码指纹 !== 当前) {
    throw new Error(`源码已变更，请先 build：stats 指纹 ${解析.源码指纹.slice(0, 12)} ≠ 当前 ${当前.slice(0, 12)}`);
  }
  return 解析.清单;
}

function 读体积清单(路径 = 统计文件): 分块度量[] {
  let 原文: string;
  try {
    原文 = fs.readFileSync(路径, 'utf8');
  } catch {
    throw new Error(`缺 ${路径}：体积预算断言拒绝空跑，请先在 管理前端 执行 npm run build 生成构建产物度量`);
  }
  return 解析体积统计(原文);
}

function 取块(清单: 分块度量[], 正则: RegExp): 分块度量[] {
  return 清单.filter((项) => 正则.test(项.名称));
}

const 清单 = 读体积清单();
const 首屏块 = 取块(清单, /^assets\/index-[^/]*\.js$/);
const 全站块 = 取块(清单, /^assets\/.+\.(js|css)$/);
const 首屏gzip字节 = 首屏块.reduce((和, 项) => 和 + 项.gzip字节数, 0);
const 首屏原始字节 = 首屏块.reduce((和, 项) => 和 + 项.字节数, 0);
const 全站gzip字节 = 全站块.reduce((和, 项) => 和 + 项.gzip字节数, 0);

describe('FP-09C 构建体积预算', () => {
  it('build-stats.json 由 vite 构建期插件产出，缺文件即抛错而不是跳过', () => {
    expect(读体积清单()).toBeInstanceOf(Array);
    expect(首屏块).toHaveLength(1);
    expect(全站块.length).toBeGreaterThanOrEqual(15);
    for (const 项 of 清单) {
      expect(项.字节数, 项.名称).toBeGreaterThan(0);
      expect(项.gzip字节数, 项.名称).toBeGreaterThan(0);
    }
  });

  it('首屏 index 分块 gzip 不超过 49.16kB 硬指标', () => {
    expect(首屏gzip字节).toBeLessThanOrEqual(首屏预算字节);
    expect(首屏gzip字节).toBeLessThanOrEqual(首屏实测字节);
  });

  it('首屏 index 分块原始字节不超过基线 126.07kB', () => {
    expect(首屏原始字节).toBeLessThanOrEqual(首屏原始预算字节);
  });

  it('全站 js+css 分块 gzip 之和不超过裁定值 84.53kB，且锁死在本轮实测值', () => {
    expect(全站gzip字节).toBeLessThanOrEqual(全站预算字节);
    expect(全站gzip字节).toBeLessThanOrEqual(全站实测字节);
  });

  it('反证：预算被抬高、清单缺失、度量法换成 dist 文件系统求和都必须被判红', () => {
    expect(() => 读体积清单('dist/不存在的-build-stats.json')).toThrow(/先.*build/);
    expect(() => 读体积清单('src/术语.ts')).toThrow();
    expect(首屏gzip字节 + 3_000 > 首屏预算字节).toBe(true);
    expect(全站gzip字节 + 3_000 > 全站预算字节).toBe(true);
    const 原始字节求和 = 全站块.reduce((和, 项) => 和 + 项.字节数, 0);
    expect(原始字节求和).toBeGreaterThan(全站预算字节);
    expect(首屏实测字节).toBeLessThan(首屏原始预算字节);
  });

  it('反证：stats 的源码指纹被篡改、被删或指向别人家的源码都必须判红（V-06）', () => {
    const 原文 = fs.readFileSync(统计文件, 'utf8');
    const 正常 = 解析体积统计(原文);
    expect(正常.length).toBeGreaterThan(0);
    const 解析 = JSON.parse(原文) as { 清单: 分块度量[]; 源码指纹: string };
    expect(解析.源码指纹).toBe(源码指纹());
    const 换一份 = (改动: { 源码指纹?: string }) =>
      JSON.stringify({ 清单: 解析.清单, ...改动 });
    expect(() => 解析体积统计(换一份({}))).toThrow(/源码指纹/);
    expect(() => 解析体积统计(换一份({ 源码指纹: '' }))).toThrow(/源码指纹/);
    expect(() => 解析体积统计(换一份({ 源码指纹: 'f'.repeat(64) }))).toThrow(/源码已变更/);
    const 末位 = 解析.源码指纹.endsWith('0') ? '1' : '0';
    expect(() => 解析体积统计(换一份({ 源码指纹: `${解析.源码指纹.slice(0, -1)}${末位}` }))).toThrow(/源码已变更/);
    expect(() => 解析体积统计(JSON.stringify({ 清单: [], 源码指纹: 解析.源码指纹 }))).toThrow(/分块清单/);
    expect(源码指纹()).toMatch(/^[0-9a-f]{64}$/);
  });
});
