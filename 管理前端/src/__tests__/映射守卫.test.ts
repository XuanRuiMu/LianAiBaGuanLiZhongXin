import { beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';
import { flushPromises, mount } from '@vue/test-utils';
import type { Component } from 'vue';
import {
  管理角色文案键表,
  封禁级别默认,
  管理角色选项,
  封禁级别文案键表,
  封禁级别选项,
  严重程度默认,
  申诉状态文案键表,
  审核状态文案键表,
  审核状态选项,
  审计事件选项,
  审计分类选项,
  思考事件文案键表,
  思考事件选项,
  优先级文案键表,
  审验结论文案键表,
  严重程度文案键表,
  严重程度选项,
  审计事件文案键表,
  审计分类文案键表,
  发送方文案键表,
  发送方选项,
  消息类型文案键表,
  关系阶段文案键表,
  取管理角色文案,
  取封禁级别文案,
  取申诉状态文案,
  取徽标文案,
  取徽标色调,
  是正常封禁级别,
} from '../枚举映射';
import { 使用登录仓库 } from '../stores/登录';
import { 路由表 } from '../router';

const 校验源路径 = '../管理后端/src/校验.ts';
const 管理员源路径 = '../管理后端/src/中间件/管理员.ts';
const 契约源路径 = '../docs/契约.md';
const 术语表源路径 = '../docs/术语表.md';
const 后端错误码源路径 = '../管理后端/src/错误码.ts';
const 后端思考源路径 = '../管理后端/src/路由/思考.ts';
const 生产事件白名单源路径 = '../../和我恋爱吧/backend/src/services/思考记录.ts';
const 生产事件迁移源路径 = '../../和我恋爱吧/backend/database/migrations/018_思考记录.sql';

function 取术语表错误码(): string[] {
  const 行 = 读(术语表源路径)
    .split(/\r?\n/)
    .find((项) => 项.startsWith('| 错误码 |'));
  if (行 === undefined) {
    throw new Error('docs/术语表.md 没有「错误码」行，三方同源守卫无出处');
  }
  const 码格 = 行.split('|')[2];
  if (码格 === undefined || 码格.trim().length === 0) {
    throw new Error('docs/术语表.md 错误码行的码清单格解析为空');
  }
  const 码 = 码格.split('/').map((项) => 项.trim()).filter((项) =>项.length > 0);
  if (码.some((项) => !/^[A-Z][A-Z_]*$/.test(项))) {
    throw new Error(`docs/术语表.md 错误码行含非码字面：${码.filter((项) => !/^[A-Z][A-Z_]*$/.test(项)).join('、')}`);
  }
  return 码;
}

function 取契约错误码(): string[] {
  const 行清单 = 读(契约源路径).split(/\r?\n/);
  const 起 = 行清单.findIndex((项) => 项.startsWith('## 十五、'));
  if (起 < 0) {
    throw new Error('docs/契约.md 缺「十五、管理端错误码表」，码表无出处');
  }
  const 码 = 行清单
    .slice(起)
    .map((项) => /^\|\s*([A-Z][A-Z_]*)\s*\|/.exec(项)?.[1])
    .filter((项): 项 is string => 项 !== undefined);
  if (码.length === 0) {
    throw new Error('docs/契约.md 十五节解析不出任何码行');
  }
  return 码;
}

function 取后端错误码(): string[] {
  const 源 = 读(后端错误码源路径);
  const 命中 = /export const 错误码 = \{([\s\S]*?)\} as const/.exec(源);
  if (命中 === null) {
    throw new Error('管理后端/src/错误码.ts 的 错误码 常量解析失败，三方同源守卫拒绝空跑');
  }
  const 码 = [...命中[1].matchAll(/'([A-Z][A-Z_]*)'/g)].map((项) => 项[1]);
  if (码.length === 0) {
    throw new Error('管理后端/src/错误码.ts 解析出 0 个码');
  }
  return 码;
}

function 集合差(左: readonly string[], 右: readonly string[]): string[] {
  const 右集 = new Set(右);
  return [...new Set(左)].filter((项) => !右集.has(项));
}

const 原码形态 = /[a-z]+_[a-z]+/;
const 未收录形态 = /未收录（[^）]*）/g;

function 读(路径: string): string {
  return fs.readFileSync(路径, 'utf8');
}

function 取字符串清单(源: string, 声明: string): string[] {
  const 命中 = new RegExp(String.raw`export const ${声明}[^=]*=\s*\[([\s\S]*?)\]`).exec(源);
  if (!命中) {
    throw new Error(`源里找不到 ${声明} 的清单，值域守卫无法执行`);
  }
  return [...命中[1].matchAll(/'([^']*)'/g)].map((项) => 项[1]);
}

function 取契约值域(声明: string): string[] {
  const 前缀 = `- ${声明}：`;
  const 行 = 读(契约源路径)
    .split(/\r?\n/)
    .find((项) => 项.startsWith(前缀));
  if (行 === undefined) {
    throw new Error(`契约.md 里没有 ${声明} 的值域登记，映射守卫无从比对`);
  }
  const 登记 = 行.slice(前缀.length).split('（')[0];
  return 登记
    .split('/')
    .map((段) => 段.replace(/[^A-Za-z_/]/g, ''))
    .filter((段) => 段.length > 0);
}

function 取契约连字值域(声明: string): string[] {
  const 前缀 = `- ${声明}：`;
  const 行 = 读(契约源路径)
    .split(/\r?\n/)
    .find((项) => 项.startsWith(前缀));
  if (行 === undefined) {
    throw new Error(`契约.md 里没有 ${声明} 的值域登记，映射守卫无从比对`);
  }
  const 段 = /`([^`]+)`/.exec(行.slice(前缀.length).split('（')[0]);
  if (段 === null) {
    throw new Error(`${声明} 的连字值域解析不到反引号段，值域守卫拒绝空跑`);
  }
  return [...new Set(段[1].split('/').filter((项) => 项.length > 0))];
}

function 取契约值域分组(声明: string): string[] {
  const 前缀 = `- ${声明}：`;
  const 行 = 读(契约源路径)
    .split(/\r?\n/)
    .find((项) => 项.startsWith(前缀));
  if (行 === undefined) {
    throw new Error(`契约.md 里没有 ${声明} 的值域登记，映射守卫无从比对`);
  }
  const 登记 = 行.slice(前缀.length).split('（')[0];
  const 组 = [...登记.matchAll(/`([^`]+)`/g)].map((匹配) => 匹配[1]);
  if (组.length < 2) {
    throw new Error(`${声明} 的登记只解析出 ${组.length} 组原码，两值守卫拒绝空跑`);
  }
  return [...new Set(组.flatMap((项) => 项.split('/')).filter((段) => 段.length > 0))];
}

function 比对值域(枚举名: string, 键列表: readonly string[], 值域: readonly string[]): string[] {
  const 键集 = new Set(键列表);
  const 值集 = new Set(值域);
  const 违例: string[] = [];
  for (const 码 of 值域) {
    if (!键集.has(码)) {
      违例.push(`${枚举名} 缺映射：${码}`);
    }
  }
  for (const 键 of 键列表) {
    if (!值集.has(键)) {
      违例.push(`${枚举名} 多出不存在的键：${键}`);
    }
  }
  return 违例;
}

const 校验源 = 读(校验源路径);
const 后端白名单 = {
  封禁级别: 取字符串清单(校验源, '账号封禁级别白名单'),
  写入封禁级别: 取字符串清单(校验源, '账号封禁写入级别白名单'),
  申诉状态: 取字符串清单(校验源, '账号申诉状态白名单'),
  审核状态: 取字符串清单(校验源, '审核状态白名单'),
  优先级: 取字符串清单(校验源, '工单优先级白名单'),
  审验结论: 取字符串清单(校验源, '审核伸缩结果白名单'),
  审计事件: 取字符串清单(校验源, '审计事件白名单'),
  发送方: 取字符串清单(校验源, '发送方白名单'),
  严重程度: 取字符串清单(校验源, '严重程度白名单'),
  思考事件: 取字符串清单(读(后端思考源路径), '思考事件白名单'),
};
const 管理角色值域 = 取字符串清单(读(管理员源路径), '管理角色清单');
const 消息类型值域 = 取契约值域('消息类型值域');
const 审计分类值域 = 取契约值域('审计分类值域');
const 关系阶段值域 = 取契约值域分组('关系阶段值域');
const 思考事件契约值域 = 取契约连字值域('思考事件值域');
const 思考事件生产白名单 = [...读(生产事件白名单源路径).matchAll(/'(guan-li-yuan-[a-z-]+)'/g)].map((项) => 项[1]);
const 思考事件迁移值域 = [...new Set(
  ([...读(生产事件迁移源路径).matchAll(/'(guan-li-yuan-[a-z-]+)'/g)].map((项) => 项[1])),
)];

const 全部管理角色 = Object.keys(管理角色文案键表);
const 全部封禁级别 = Object.keys(封禁级别文案键表);
const 全部申诉状态 = Object.keys(申诉状态文案键表);
const 全部审核状态 = Object.keys(审核状态文案键表);
const 全部审计事件 = Object.keys(审计事件文案键表);
const 全部发送方 = Object.keys(发送方文案键表);
const 全部消息类型 = Object.keys(消息类型文案键表);
const 全部关系阶段 = Object.keys(关系阶段文案键表);
const 全部关系阶段拼音码 = 全部关系阶段.filter((码) => /[A-Za-z]/.test(码));

describe('FP-02 映射值域全覆盖守卫', () => {
  it('后端白名单与契约值域均实读到非空清单', () => {
    expect(后端白名单.封禁级别).toHaveLength(4);
    expect(后端白名单.写入封禁级别).toHaveLength(3);
    expect(后端白名单.申诉状态).toHaveLength(4);
    expect(后端白名单.审核状态).toHaveLength(10);
    expect(后端白名单.优先级).toHaveLength(4);
    expect(后端白名单.审验结论).toHaveLength(3);
    expect(后端白名单.审计事件).toHaveLength(19);
    expect(后端白名单.发送方).toHaveLength(3);
    expect(后端白名单.严重程度).toHaveLength(3);
    expect(管理角色值域).toHaveLength(3);
    expect(消息类型值域).toHaveLength(6);
    expect(审计分类值域).toHaveLength(1);
    expect(关系阶段值域).toHaveLength(20);
    expect(后端白名单.思考事件).toHaveLength(4);
    expect(思考事件契约值域).toHaveLength(4);
    expect(思考事件生产白名单).toHaveLength(8);
    expect(思考事件迁移值域).toHaveLength(4);
  });

  it('思考事件值域四处出处（族键表 / 契约 / 生产白名单 / 库层约束 / 管理端入参）逐码同源', () => {
    const 族键 = Object.keys(思考事件文案键表);
    expect(集合差(族键, 思考事件契约值域)).toEqual([]);
    expect(集合差(思考事件契约值域, 族键)).toEqual([]);
    expect(集合差(族键, [...new Set(思考事件生产白名单)])).toEqual([]);
    expect(集合差([...new Set(思考事件生产白名单)], 族键)).toEqual([]);
    expect(集合差(族键, 思考事件迁移值域)).toEqual([]);
    expect(集合差(思考事件迁移值域, 族键)).toEqual([]);
    expect(集合差(族键, 后端白名单.思考事件)).toEqual([]);
    expect(集合差(后端白名单.思考事件, 族键)).toEqual([]);
  });

  it('关系阶段两形原码都映到同一显示名，档位与真源逐条对得上', () => {
    const 档名对 = [
      ['lengDan', '冷淡'],
      ['shuYuan', '疏远'],
      ['renShi', '认识'],
      ['shuXi', '熟悉'],
      ['pengYou', '朋友'],
      ['haoYou', '好友'],
      ['aiMei', '暧昧'],
      ['xinDong', '心动'],
      ['reLian', '热恋'],
      ['shenAi', '深爱'],
    ] as const;
    expect(档名对.map(([码]) => 码)).toEqual([...new Set(关系阶段值域.filter((码) => /^[a-z]/i.test(码)))]);
    for (const [码, 名] of 档名对) {
      expect(取徽标文案('关系阶段', 码), `拼音码 ${码}`).toBe(名);
      expect(取徽标文案('关系阶段', 名), `中文档名 ${名}`).toBe(名);
    }
    expect(取徽标文案('关系阶段', null)).toBe('未记录');
    expect(取徽标文案('关系阶段', 'yi_wu_dang')).toBe('未收录（yi_wu_dang）');
  });

  it('每张映射表的键集合与实读值域双向相等', () => {
    const 违例 = [
      ...比对值域('封禁级别', Object.keys(封禁级别文案键表), 后端白名单.封禁级别),
      ...比对值域('封禁级别选项', 封禁级别选项.map((项) => 项.值), 后端白名单.写入封禁级别),
      ...比对值域('申诉状态', Object.keys(申诉状态文案键表), 后端白名单.申诉状态),
      ...比对值域('审核状态', Object.keys(审核状态文案键表), 后端白名单.审核状态),
      ...比对值域('优先级', Object.keys(优先级文案键表), 后端白名单.优先级),
      ...比对值域('审验结论', Object.keys(审验结论文案键表), 后端白名单.审验结论),
      ...比对值域('审计事件', Object.keys(审计事件文案键表), 后端白名单.审计事件),
      ...比对值域('发送方', Object.keys(发送方文案键表), 后端白名单.发送方),
      ...比对值域('发送方选项', 发送方选项.map((项) => 项.值), 后端白名单.发送方),
      ...比对值域('管理角色', Object.keys(管理角色文案键表), 管理角色值域),
      ...比对值域('管理角色选项', 管理角色选项.map((项) => 项.值), 管理角色值域),
      ...比对值域('消息类型', Object.keys(消息类型文案键表), 消息类型值域),
      ...比对值域('审计分类', Object.keys(审计分类文案键表), 审计分类值域),
      ...比对值域('严重程度', Object.keys(严重程度文案键表), 后端白名单.严重程度),
      ...比对值域('严重程度选项', 严重程度选项.map((项) => 项.值), 后端白名单.严重程度),
      ...比对值域('关系阶段', Object.keys(关系阶段文案键表), 关系阶段值域),
      ...比对值域('思考事件', Object.keys(思考事件文案键表), 后端白名单.思考事件),
      ...比对值域('思考事件', Object.keys(思考事件文案键表), 思考事件契约值域),
      ...比对值域('思考事件选项', 思考事件选项.map((项) => 项.值), 后端白名单.思考事件),
      ...比对值域('审计事件选项', 审计事件选项.map((项) => 项.值), 后端白名单.审计事件),
      ...比对值域('审计分类选项', 审计分类选项.map((项) => 项.值), 审计分类值域),
      ...比对值域('审核状态选项', 审核状态选项.map((项) => 项.值), 后端白名单.审核状态),
    ];
    expect(违例).toEqual([]);
    expect(后端白名单.严重程度).toContain(严重程度默认);
    expect(后端白名单.写入封禁级别).toContain(封禁级别默认);
  });

  it('反证：漏映射、多映射与值域收缩都必须被判红', () => {
    const 漏一个 = { ...审核状态文案键表 } as Record<string, string>;
    delete 漏一个.yun_xing_zhong;
    expect(比对值域('审核状态', Object.keys(漏一个), 后端白名单.审核状态)).toEqual(['审核状态 缺映射：yun_xing_zhong']);

    const 多一个 = { ...封禁级别文案键表, xin_zeng_ji: '级别永久' } as Record<string, string>;
    expect(比对值域('封禁级别', Object.keys(多一个), 后端白名单.封禁级别)).toEqual(['封禁级别 多出不存在的键：xin_zeng_ji']);

    const 少一形 = { ...关系阶段文案键表 } as Record<string, string>;
    delete 少一形.深爱;
    expect(比对值域('关系阶段', Object.keys(少一形), 关系阶段值域)).toEqual(['关系阶段 缺映射：深爱']);

    const 收缩样张 = 读(契约源路径).replace(/- 消息类型值域：`[^`]+`/, '- 消息类型值域：`wenben/tuPian`');
    const 命中 = /- 消息类型值域：`([^`]+)`/.exec(收缩样张);
    expect(命中).not.toBeNull();
    expect(比对值域('消息类型', Object.keys(消息类型文案键表), (命中 as RegExpExecArray)[1].split('/'))).toEqual([
      '消息类型 多出不存在的键：biaoQingBao',
      '消息类型 多出不存在的键：yuYin',
      '消息类型 多出不存在的键：wenJian',
      '消息类型 多出不存在的键：neiXinHuoDong',
    ]);

    expect(取徽标文案('审核状态', 'xin_zeng_zhuang_tai')).toBe('未收录（xin_zeng_zhuang_tai）');
    const 思考事件少一码 = 后端白名单.思考事件.filter((码) => 码 !== 'guan-li-yuan-yin-cang-xin-xi');
    expect(比对值域('思考事件', Object.keys(思考事件文案键表), 思考事件少一码)).toEqual([
      '思考事件 多出不存在的键：guan-li-yuan-yin-cang-xin-xi',
    ]);
    expect(比对值域('思考事件', Object.keys(思考事件文案键表), [...后端白名单.思考事件, 'guan-li-yuan-xin-zeng'])).toEqual([
      '思考事件 缺映射：guan-li-yuan-xin-zeng',
    ]);
    expect(取徽标文案('思考事件', 'guan-li-yuan-xin-zeng')).toBe('未收录（guan-li-yuan-xin-zeng）');
  });

  it('三态口径：命中中文名、无值未记录、缺席即确定态、域外未收录（原始码）', () => {
    expect(取封禁级别文案('zheng_chang')).toBe('正常');
    expect(取封禁级别文案('')).toBe('正常');
    expect(取封禁级别文案(undefined)).toBe('正常');
    expect(取封禁级别文案('yi_wu_zhong_ji_bie')).toBe('未收录（yi_wu_zhong_ji_bie）');
    expect(取申诉状态文案('wu')).toBe('无申诉');
    expect(取申诉状态文案(null)).toBe('无申诉');
    expect(取申诉状态文案('zheng_chang')).toBe('未收录（zheng_chang）');
    expect(取徽标文案('审核状态', 'dai_er_shen')).toBe('待复审');
    expect(取徽标文案('审核状态', 'yun_xing_zhong')).toBe('运行中');
    expect(取徽标文案('审计事件', 'guan_li_pi_liang_shen_he')).toBe('多项审核');
    expect(取徽标文案('审计分类', 'guan_li')).toBe('管理操作');
    expect(取徽标文案('发送方', 'yonghu')).toBe('用户');
    expect(取徽标文案('消息类型', 'neiXinHuoDong')).toBe('内心活动');
    expect(取管理角色文案('zhi_dai_wei')).toBe('未收录（zhi_dai_wei）');
    expect(取管理角色文案(null)).toBe('无管理身份');
    expect(取徽标文案('思考事件', 'guan-li-yuan-shen-du-si-kao')).toBe('深度思考');
    expect(取徽标文案('思考事件', 'guan-li-yuan-hao-gan-du-bian-hua')).toBe('好感度变化');
    expect(取徽标文案('思考事件', 'guan-li-yuan-wei-zhi')).toBe('未收录（guan-li-yuan-wei-zhi）');
    expect(取徽标文案('思考事件', null)).toBe('未记录');
    expect(取徽标文案('严重程度', 严重程度默认)).toBe('中等');
    expect(取徽标文案('严重程度', 'yi_wu_dang')).toBe('未收录（yi_wu_dang）');
    expect(取徽标文案('严重程度', null)).toBe('未记录');
    expect(取徽标色调('封禁级别', null)).toBe('安');
    expect(取徽标色调('封禁级别', 'zheng_chang')).toBe('安');
    for (const 码 of ['feng_jin_1_fen', 'feng_jin_1_tian', 'yong_feng']) {
      expect(取徽标色调('封禁级别', 码), `封禁级别 ${码} 不得按时长分色`).toBe('危');
    }
    expect(取徽标色调('封禁级别', 'yi_wu_zhong')).toBe('警');
    expect(取徽标色调('管理角色', null)).toBe('墨');
    expect(取徽标色调('管理角色', 'chao_guan')).toBe('警');
    expect(取徽标色调('申诉状态', null)).toBe('安');
    expect(取徽标色调('严重程度', '严重')).toBe('危');
    expect(取徽标色调('严重程度', null)).toBe('危');
  });

  it('反证：L-03 谓词与显示口径对空值不再各说各话', () => {
    expect(是正常封禁级别(null)).toBe(true);
    expect(取封禁级别文案(null)).toBe('正常');
    expect(是正常封禁级别('zheng_chang')).toBe(true);
    expect(取封禁级别文案('zheng_chang')).toBe('正常');
    expect(是正常封禁级别('yi_wu_zhong')).toBe(false);
    for (const 码 of 后端白名单.封禁级别) {
      expect(是正常封禁级别(码)).toBe(取封禁级别文案(码) === '正常');
    }
  });
});

describe('FP-09C 错误码三方同源', () => {
  const 术语表码 = 取术语表错误码();
  const 契约码 = 取契约错误码();
  const 后端码 = 取后端错误码();

  it('术语表 六 ⇄ 契约.md 十五 ⇄ 错误码.ts 三向集合相等', () => {
    expect(术语表码.length).toBeGreaterThanOrEqual(18);
    expect(契约码.length).toBeGreaterThanOrEqual(18);
    expect(后端码.length).toBeGreaterThanOrEqual(18);
    expect([...集合差(后端码, 契约码), ...集合差(契约码, 后端码)]).toEqual([]);
    expect([...集合差(后端码, 术语表码), ...集合差(术语表码, 后端码)]).toEqual([]);
    expect(new Set(后端码).size).toBe(后端码.length);
  });

  it('反证：少一行、多一行、改一行都能被打红', () => {
    expect(集合差(后端码, [...契约码, 'XIN_ZENG_MA'])).toEqual([]);
    expect(集合差([...契约码, 'XIN_ZENG_MA'], 后端码)).toEqual(['XIN_ZENG_MA']);
    expect(集合差(后端码, 契约码.filter((项) => 项 !== 'XIAN_LIU'))).toEqual(['XIAN_LIU']);
    expect(集合差(后端码, 术语表码.filter((项) => 项 !== 'NEI_BU_CUO_WU'))).toEqual(['NEI_BU_CUO_WU']);
    expect(() => 取契约值域('不存在的值域')).toThrow(/契约\.md 里没有/);
  });
});

function 去豁免(文本: string): string {
  return 文本.replace(未收录形态, '');
}

function 断言无裸原码(来源: string, 文本: string, 上屏码清单: readonly string[]): void {
  const 净文本 = 去豁免(文本);
  const 命中 = 原码形态.exec(净文本);
  expect(命中, `渲染结果 ${来源} 仍含裸原码 ${命中?.[0] ?? ''}`).toBeNull();
  for (const 码 of 上屏码清单) {
    expect(净文本.includes(码), `渲染结果 ${来源} 仍含未映射原码 ${码}`).toBe(false);
  }
}

async function 挂视图(组件: Component, 路径: string, 需要外壳 = false) {
  const 路由器: Router = createRouter({ history: createMemoryHistory(), routes: 路由表 });
  await 路由器.push(路径);
  const 包装 = mount(组件, {
    global: {
      plugins: [路由器],
      stubs: 需要外壳 ? { RouterView: true } : {},
    },
  });
  return 包装;
}

beforeEach(() => {
  setActivePinia(createPinia());
  window.sessionStorage.clear();
  vi.clearAllMocks();
  使用登录仓库().设置身份('chao_guan', ['cha_kan', 'feng_jin', 'feng_jin_shen_he', 'tong_ji_xie', 'gao_we']);
});

vi.mock('../api/管理', () => ({
  账号列表: vi.fn().mockResolvedValue({ 行: [], 分页: undefined }),
  账号详情: vi.fn().mockResolvedValue({}),
  授予角色: vi.fn(),
  回收角色: vi.fn(),
  接管角色: vi.fn(),
  结束接管: vi.fn(),
  我的身份: vi.fn().mockResolvedValue({ yong_hu_id: 'yi', jiao_se: 'chao_guan', neng_li: ['cha_kan'] }),
  管理登录: vi.fn(),
  聊天消息: vi.fn().mockResolvedValue({ 行: [], 分页: undefined }),
  好友消息: vi.fn().mockResolvedValue({ 行: [], 分页: undefined }),
  记忆列表: vi.fn().mockResolvedValue({ 行: [], 分页: undefined }),
  对话摘要列表: vi.fn().mockResolvedValue({ 行: [], 分页: undefined }),
  关键事件列表: vi.fn().mockResolvedValue({ 行: [], 分页: undefined }),
  接管记录列表: vi.fn().mockResolvedValue({ 行: [], 分页: undefined }),
  评估列表: vi.fn().mockResolvedValue({ 行: [], 分页: undefined }),
  思考记录列表: vi.fn().mockResolvedValue({ 行: [], 分页: undefined }),
  思考记录详情: vi.fn(),
  思考说明: vi.fn().mockResolvedValue({
    you_du_li_si_kao_chi_jiu_hua_biao: true,
    sheng_ming: '思考链回放口径',
    hui_fang_zhun_ze: '回放以已保存记录为准',
    shi_shi_shi_jian: [],
    shi_shi_shuo_ming: '实时说明',
    dan_tiao_jie_duan_zi_fu_shu: 1500,
    yi_chi_jiu_hua_cha_xun: [],
    dai_bu_chong_shuo_ming: '',
    dai_bu_chong: [],
  }),
  封禁记录: vi.fn().mockResolvedValue({ 行: [], 分页: undefined }),
  写入封禁: vi.fn(),
  账号封禁列表: vi.fn().mockResolvedValue({ 行: [], 分页: undefined }),
  解封账号: vi.fn(),
  审核申诉: vi.fn(),
  审计日志: vi.fn().mockResolvedValue({ 行: [], 分页: undefined }),
  审计保留: vi.fn().mockResolvedValue({ zong_shu: 1 }),
  注册统计: vi.fn().mockResolvedValue({}),
  消息统计: vi.fn().mockResolvedValue({}),
  好感度统计: vi.fn().mockResolvedValue({}),
  留存统计: vi.fn().mockResolvedValue({}),
  用量统计: vi.fn().mockResolvedValue({}),
  埋点字典: vi.fn().mockResolvedValue({}),
  就绪检查: vi.fn(),
  指标概览: vi.fn(),
  审核列表: vi.fn().mockResolvedValue({ 行: [], 分页: undefined }),
  审核新建: vi.fn(),
  审核初审: vi.fn(),
  审核复审: vi.fn(),
  审核多项处理: vi.fn(),
  处理记录列表: vi.fn().mockResolvedValue({ 行: [], 分页: undefined }),
}));

const 接口 = await import('../api/管理');

describe('FP-02 渲染结果不出现裸原码', () => {
  it('账号列表：管理角色与封禁级别全值域渲染为中文', async () => {
    vi.mocked(接口.账号列表).mockResolvedValue({
      行: 全部封禁级别.map((级别, 序号) => ({
        ID: `用户${序号}`,
        昵称: `昵称${序号}`,
        手机号: '13800000000',
        角色: 全部管理角色[序号 % 全部管理角色.length],
        封禁级别: 级别,
        创建时间: '2026-09-20 10:00:00',
      })),
      分页: undefined,
    });
    const { default: 页 } = await import('../views/账号列表.vue');
    const 包装 = await 挂视图(页, '/zhang-hao');
    await flushPromises();
    const 文本 = 包装.text();
    expect(文本).toContain('超级管理员');
    expect(文本).toContain('审核员');
    expect(文本).toContain('永久封禁');
    断言无裸原码('账号列表', 文本, [...全部管理角色, ...全部封禁级别]);
  });

  it('账号详情：申诉状态收一套映射口径，不再吐原码', async () => {
    vi.mocked(接口.账号详情).mockResolvedValue({
      ID: 'yi',
      昵称: '甲',
      用户名: 'jia',
      角色: 'shen_he_yuan',
      封禁级别: 'feng_jin_1_fen',
      申诉状态: 'shen_su_zhong',
      创建时间: '2026-09-20 10:00:00',
    });
    const { default: 页 } = await import('../views/账号详情.vue');
    const 包装 = await 挂视图(页, '/zhang-hao/yong-hu-yi');
    await flushPromises();
    const 文本 = 包装.text();
    expect(文本).toContain('申诉中');
    expect(文本).toContain('审核员');
    expect(文本).toContain('封禁 1 分钟');
    断言无裸原码('账号详情', 文本, ['shen_he_yuan', 'feng_jin_1_fen', 'shen_su_zhong']);
  });

  it('封禁管理：级别与申诉状态全值域渲染为中文', async () => {
    vi.mocked(接口.封禁记录).mockResolvedValue({ 行: [], 分页: undefined });
    vi.mocked(接口.账号封禁列表).mockResolvedValue({
      行: 全部申诉状态.map((码, 序号) => ({
        用户ID: `用户${序号}`,
        级别: 全部封禁级别[序号],
        申诉状态: 码,
        最后原因: '测试原因',
      })),
      分页: undefined,
    });
    const { default: 页 } = await import('../views/封禁管理.vue');
    const 包装 = await 挂视图(页, '/feng-jin');
    await flushPromises();
    const 文本 = 包装.text();
    expect(文本).toContain('无申诉');
    expect(文本).toContain('已解除');
    expect(文本).toContain('封禁 1 天');
    expect(文本).toContain('永久封禁');
    断言无裸原码('封禁管理', 文本, [...全部申诉状态, ...全部封禁级别]);
  });

  it('审核运营：审核状态全值域渲染为中文', async () => {
    vi.mocked(接口.审核列表).mockResolvedValue({
      行: 全部审核状态.map((码, 序号) => ({
        ID: `目标${序号}`,
        状态: 码,
        创建时间: '2026-09-20 10:00:00',
      })),
      分页: undefined,
    });
    const { default: 页 } = await import('../views/审核运营.vue');
    const 包装 = await 挂视图(页, '/shen-he');
    await flushPromises();
    const 文本 = 包装.text();
    expect(文本).toContain('待初审');
    expect(文本).toContain('运行中');
    断言无裸原码('审核运营', 文本, 全部审核状态);
  });

  it('聊天记录：发送方与消息类型渲染为中文，下拉选项不再显示原码', async () => {
    vi.mocked(接口.聊天消息).mockResolvedValue({
      行: 全部消息类型.map((类型, 序号) => ({
        ID: `消息${序号}`,
        发送者: 全部发送方[序号 % 全部发送方.length],
        类型: 类型,
        内容: '测试内容',
        创建时间: '2026-09-20 10:00:00',
      })),
      分页: undefined,
    });
    const { default: 页 } = await import('../views/聊天记录.vue');
    const 包装 = await 挂视图(页, '/liao-tian');
    await flushPromises();
    const 文本 = 包装.text();
    expect(文本).toContain('角色');
    expect(文本).toContain('系统');
    expect(文本).toContain('表情包');
    expect(文本).toContain('内心活动');
    const 选项文本 = 包装.findAll('option').map((项) => 项.text()).join('');
    expect(选项文本).toContain('用户');
    expect(选项文本).toContain('系统');
    断言无裸原码('聊天记录', 文本, [...全部发送方, ...全部消息类型]);
  });

  it('思考链：事件走未收录（原始码），行快照收口后整页无裸原码', async () => {
    vi.mocked(接口.思考记录列表).mockResolvedValue({
      行: [{ ID: 'ji-lu-yi', 事件: 'guan-li-yuan-shen-du-si-kao', 摘要: '一段摘要', 创建时间: '2026-09-20 10:00:00' }],
      分页: undefined,
    });
    const { default: 页 } = await import('../views/思考链.vue');
    const 包装 = await 挂视图(页, '/si-kao-lian');
    await flushPromises();
    expect(包装.text()).toContain('深度思考');
    expect(包装.text()).not.toContain('guan-li-yuan-shen-du-si-kao');
    expect(包装.findAll('pre')).toHaveLength(1);
    断言无裸原码('思考链', 包装.text(), []);
  });

  it('审计日志：审计事件与审计分类全值域渲染为中文', async () => {
    vi.mocked(接口.审计日志).mockResolvedValue({
      行: 全部审计事件.map((码, 序号) => ({
        ID: `记录${序号}`,
        事件类型: 码,
        用户ID: 'yi',
        IP: '127.0.0.1',
        详情: { 动作明细: '明细' },
        类型: 审计分类值域[0],
        创建时间: '2026-09-20 10:00:00',
      })),
      分页: undefined,
    });
    const { default: 页 } = await import('../views/审计日志.vue');
    const 包装 = await 挂视图(页, '/shen-ji');
    await flushPromises();
    const 文本 = 包装.text();
    expect(文本).toContain('管理员登录');
    expect(文本).toContain('解密手机号');
    expect(文本).toContain('管理操作');
    断言无裸原码('审计日志', 文本, [...全部审计事件, ...审计分类值域]);
  });

  it('统计图表：发送方渲染为中文，模型类型按外部标识原样展示，关系阶段两形都走映射', async () => {
    vi.mocked(接口.消息统计).mockResolvedValue({
      lie_biao: 全部发送方.map((码, 序号) => ({ 日期: `2026-09-2${序号 + 1}`, 发送方: 码, 数量: 3 })),
    });
    vi.mocked(接口.用量统计).mockResolvedValue({
      lie_biao: [{ 日期: '2026-09-20', 模型类型: 'deepseek-chat', 总数: 5 }],
    });
    vi.mocked(接口.好感度统计).mockResolvedValue({
      zong_lan: { 总数: 4, 平均分: 62.5, 最高分: 90, 最低分: 35 },
      an_jie_duan: [
        { 阶段: 'lengDan', 数量: 2, 平均分: 50 },
        { 阶段: '热恋', 数量: 1, 平均分: 90 },
        { 阶段: 'yi_wu_dang', 数量: 1, 平均分: 35 },
      ],
    });
    const { default: 页 } = await import('../views/统计图表.vue');
    const 包装 = await 挂视图(页, '/tong-ji');
    await flushPromises();
    const 文本 = 包装.text();
    expect(文本).toContain('用户');
    expect(文本).toContain('deepseek-chat');
    expect(文本).toContain('冷淡');
    expect(文本).toContain('热恋');
    expect(文本).toContain('未收录（yi_wu_dang）');
    断言无裸原码('统计图表', 文本, [...全部发送方, ...全部关系阶段拼音码]);
  });

  it('登录页与应用外壳：无数据行也不出现裸原码', async () => {
    const { default: 登录页 } = await import('../views/登录页.vue');
    断言无裸原码('登录页', (await 挂视图(登录页, '/deng-lu')).text(), []);

    window.sessionStorage.setItem('guan_li_hui_hua', 'yi_deng_lu');
    const { default: 外壳 } = await import('../App.vue');
    const 包装 = await 挂视图(外壳, '/zhang-hao', true);
    await flushPromises();
    expect(包装.find('[data-testid="dang-qian-jiao-se"]').text()).toBe('超级管理员');
    断言无裸原码('应用外壳', 包装.text(), 全部管理角色);
  });
});
