import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import {
  测试超管手机号,
  测试超管用户名,
  建号语句,
  哈希代价,
  满足口令规则,
  生成口令,
  执行建号,
  建号失败提示,
  组装输出,
} from '../../scripts/建测试超管账号';
import { 校验手机号, 校验失败 } from '../../src/校验';
import { 创建模拟池 } from './测试辅助';

const 固定测试口令 = 'ceShiGuDingKouLing1234567';

const 后端根 = path.resolve(__dirname, '..', '..');

describe('FP-02 专用测试超管 seed 脚本', () => {
  it('建号语句只插入新行，不含任何改动既有行的语句', () => {
    expect(建号语句).toContain('INSERT INTO "用户"');
    const 大写 = 建号语句.toUpperCase();
    for (const 禁词 of ['UPDATE', 'DELETE', 'TRUNCATE', 'DROP', 'ALTER', 'MERGE']) {
      expect(大写, `建号语句不得含 ${禁词}`).not.toContain(禁词);
    }
    expect(建号语句).toContain('ON CONFLICT ("手机号") DO NOTHING');
  });

  it('手机号与用户名一律走绑定参数，语句里不含任何字面量', () => {
    expect(建号语句).toContain('$1');
    expect(建号语句).toContain('$2');
    expect(建号语句).toContain('$3');
    expect(建号语句).not.toContain(测试超管手机号);
    expect(建号语句).not.toContain(测试超管用户名);
    expect(建号语句).not.toContain(固定测试口令);
  });

  it('三旗标全开为真值常量，且不写游戏侧免密登录用的 测试 列', async () => {
    const { 池, 查询记录 } = 创建模拟池();
    await 执行建号(池, 固定测试口令);
    expect(建号语句).toContain('"管理员"');
    expect(建号语句).toContain('"运营"');
    expect(建号语句).toContain('"审核员"');
    const 旗标段 = 建号语句.slice(建号语句.indexOf('VALUES'), 建号语句.indexOf('ON CONFLICT'));
    expect(旗标段.split('TRUE').length - 1).toBe(3);
    expect(建号语句).not.toMatch(/"测试"/);
    expect(查询记录).toHaveLength(1);
  });

  it('默认手机号即管理端登录白名单可过的常量', () => {
    expect(校验手机号('shou_ji_hao', 测试超管手机号)).toBe(测试超管手机号);
    expect(测试超管手机号).toHaveLength(11);
    expect(测试超管用户名.trim().length).toBeGreaterThan(0);
  });

  it('口令规则与管理端登录复杂度逐条对齐', () => {
    const 用例: Array<[string, boolean]> = [
      ['', false],
      ['a'.repeat(6) + '1', false],
      ['ab123456', true],
      ['ab' + '1'.repeat(6), true],
      ['a'.repeat(200) + '1', false],
      ['a' + '1'.repeat(199), true],
      ['abcdefghij', false],
      ['1234567890', false],
      ['abcdefgh!!', false],
      ['AB12_-ab90', true],
    ];
    for (const [口令, 期望] of 用例) {
      expect(满足口令规则(口令), `长度 ${口令.length} 的 ${期望 ? '合格' : '不合格'}口令`).toBe(期望);
    }
  });

  it('管理端登录路由的复杂度分支未漂移，否则本守卫必须判红', () => {
    const 源码 = fs.readFileSync(path.join(后端根, 'src', '路由', '登录.ts'), 'utf8');
    for (const 片段 of ['密码.length < 8', '密码.length > 200', '/[A-Za-z]/.test(密码)', '/[0-9]/.test(密码)']) {
      expect(源码, `管理端登录口令校验已改口径：找不到 ${片段}`).toContain(片段);
    }
  });

  it('生成的口令每次不同、字符集安全且全部满足管理端复杂度', () => {
    const 样本: string[] = [];
    for (let 次 = 0; 次 < 30; 次 += 1) {
      const 口令 = 生成口令();
      expect(满足口令规则(口令), '生成口令必须过管理端复杂度').toBe(true);
      expect(口令).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(口令.length).toBeGreaterThanOrEqual(8);
      样本.push(口令);
    }
    expect(new Set(样本).size).toBe(样本.length);
  });

  it('执行建号只发一条参数化 INSERT，口令以 bcrypt 哈希入库且不外泄', async () => {
    const { 池, 查询记录 } = 创建模拟池();
    const 结果 = await 执行建号(池, 固定测试口令);
    expect(结果).toBe('已创建');
    expect(查询记录).toHaveLength(1);
    expect(查询记录[0].文本).toBe(建号语句);
    expect(查询记录[0].参数[0]).toBe(测试超管手机号);
    expect(查询记录[0].参数[1]).toBe(测试超管用户名);
    const 哈希 = String(查询记录[0].参数[2]);
    expect(哈希).not.toBe(固定测试口令);
    expect(哈希).toMatch(new RegExp(`^\\$2[aby]\\$${哈希代价}\\$`));
    expect(await bcrypt.compare(固定测试口令, 哈希)).toBe(true);
  });

  it('重复执行走「已存在即不插入」分支且仍只一条语句', async () => {
    const { 池, 查询记录 } = 创建模拟池(() => []);
    const 结果 = await 执行建号(池, 固定测试口令);
    expect(结果).toBe('已存在');
    expect(查询记录).toHaveLength(1);
    expect(查询记录[0].文本.toUpperCase()).not.toContain('UPDATE');
  });

  it('非法手机号与弱口令一律拒绝，且一条语句都不发', async () => {
    const 手机号池 = 创建模拟池();
    await expect(执行建号(手机号池.池, 固定测试口令, '12345678901')).rejects.toBeInstanceOf(校验失败);
    expect(手机号池.查询记录).toHaveLength(0);

    const 长度池 = 创建模拟池();
    await expect(执行建号(长度池.池, 固定测试口令, '138000004324608979')).rejects.toBeInstanceOf(校验失败);
    expect(长度池.查询记录).toHaveLength(0);

    const 口令池 = 创建模拟池();
    await expect(执行建号(口令池.池, '12345678')).rejects.toBeInstanceOf(校验失败);
    expect(口令池.查询记录).toHaveLength(0);

    const 弱口令池 = 创建模拟池();
    await expect(执行建号(弱口令池.池, 'abcdefghij')).rejects.toBeInstanceOf(校验失败);
    expect(弱口令池.查询记录).toHaveLength(0);
  });

  it('连接失败与唯一键冲突只回中文处置提示，不外泄连接串与凭据', () => {
    const 冲突 = 建号失败提示(Object.assign(new Error('duplicate key value'), { code: '23505' }));
    expect(冲突).toContain('已被占用');
    expect(冲突).toContain('不改动既有账号');

    const 连不上 = 建号失败提示(Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' }));
    expect(连不上).toContain('数据库连接失败');

    const 鉴权 = 建号失败提示(
      Object.assign(new Error('password authentication failed for user "mima-yanzheng"'), { code: '28000' }),
    );
    expect(鉴权).toContain('数据库连接失败');
    for (const 禁串 of ['mima-yanzheng', '://', '5432', 'password']) {
      expect(鉴权, `提示不得外泄 ${禁串}`).not.toContain(禁串);
      expect(冲突).not.toContain(禁串);
      expect(连不上).not.toContain(禁串);
    }

    const 缺唯一索引 = 建号失败提示(Object.assign(new Error('no unique or exclusion constraint'), { code: '42P10' }));
    expect(缺唯一索引).toContain('唯一约束');
    expect(缺唯一索引).toContain('幂等');

    const 未知 = 建号失败提示(new Error('某种没见过的错'));
    expect(未知).toContain('建号未完成');
    expect(未知).not.toContain('某种没见过的错');
  });

  it('输出只在已创建时带出口令，已存在时不打印任何口令', () => {
    const 已创建 = 组装输出('已创建', 测试超管手机号, 固定测试口令);
    expect(已创建).toContain(测试超管手机号);
    expect(已创建).toContain(固定测试口令);
    expect(已创建.split('\n').filter((行) => 行.includes(固定测试口令))).toHaveLength(1);

    const 已存在 = 组装输出('已存在', 测试超管手机号, 固定测试口令);
    expect(已存在).toContain(测试超管手机号);
    expect(已存在).not.toContain(固定测试口令);
    expect(已存在).toContain('未插入');
  });
});
