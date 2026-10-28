import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { 创建测试应用, 创建模拟池, 签发管理令牌, 授权头 } from './测试辅助';
import { 剥离控制字符, 清洗展示文本, 清洗行, 清洗行列表 } from '../../src/文本清洗';

/**
 * 输出安全：管理端读出口清洗真源（src/文本清洗.ts）与四条接线路由的回归。
 * 口径与主项目 backend/src/utils/控制字符.ts 完全一致：保留 \n 与 \t，其余全剥。
 */

const 编号 = '11111111-1111-4111-8111-111111111111';
const 换行 = String.fromCharCode(0x0a);
const 制表 = String.fromCharCode(0x09);

const 控制字符样本: Array<[string, string]> = [
  ['NUL', String.fromCharCode(0x00)],
  ['SOH', String.fromCharCode(0x01)],
  ['VT', String.fromCharCode(0x0b)],
  ['FF', String.fromCharCode(0x0c)],
  ['SO', String.fromCharCode(0x0e)],
  ['US', String.fromCharCode(0x1f)],
  ['DEL', String.fromCharCode(0x7f)],
  ['CR', String.fromCharCode(0x0d)],
];

function 管理员行(文本: string): Record<string, unknown>[] | null {
  if (文本.includes('SELECT "管理员"')) {
    return [{ 管理员: true, 运营: false, 审核员: false }];
  }
  return null;
}

describe('文本清洗真源：剥控制字符与码点截断', () => {
  it.each(控制字符样本)('%s 被剥', (_名, 字) => {
    expect(剥离控制字符(`甲${字}乙`)).toBe('甲乙');
  });

  it('非字符 U+FFFE U+FFFF 被剥', () => {
    expect(剥离控制字符(`甲${String.fromCodePoint(0xfffe)}乙`)).toBe('甲乙');
    expect(剥离控制字符(`甲${String.fromCodePoint(0xffff)}乙`)).toBe('甲乙');
  });

  it('换行与制表保留（消息类正文的合理排版）', () => {
    expect(剥离控制字符(`第一行${换行}第二行`)).toBe(`第一行${换行}第二行`);
    expect(剥离控制字符(`列一${制表}列二`)).toBe(`列一${制表}列二`);
  });

  it('空串原样返回；非字符串入参返回空串不抛错', () => {
    expect(剥离控制字符('')).toBe('');
    expect(剥离控制字符(undefined as never)).toBe('');
    expect(剥离控制字符(42 as never)).toBe('');
  });

  it('清洗展示文本按码点截断，不劈 emoji 代理对', () => {
    expect(清洗展示文本('x'.repeat(3000), 2000)).toHaveLength(2000);
    const 表情 = 清洗展示文本('😀'.repeat(3000), 10);
    expect([...表情]).toHaveLength(10);
    expect(表情).toBe('😀'.repeat(10));
  });

  it('清洗行只动配置内的字符串字段，其余列原样保留', () => {
    const 行 = 清洗行(
      { 内容: `危${String.fromCharCode(0x00)}害`, 用户ID: 编号, 重要度: 3, 备注: null },
      [{ 字段: '内容', 上限: 2000 }],
    );
    expect(行['内容']).toBe('危害');
    expect(行['用户ID']).toBe(编号);
    expect(行['重要度']).toBe(3);
    expect(行['备注']).toBeNull();
  });

  it('清洗行列表保持行序与行数', () => {
    const 列表 = 清洗行列表(
      [{ 内容: `甲${String.fromCharCode(0x1b)}` }, { 内容: '乙' }, { 内容: '丙' }],
      [{ 字段: '内容', 上限: 2000 }],
    );
    expect(列表.map((项) => 项['内容'])).toEqual(['甲', '乙', '丙']);
  });
});

describe('读出口接线：聊天消息列表', () => {
  it('消息正文剥控制字符并按 2000 码点截断', async () => {
    const 正文 = '危'.repeat(2500) + String.fromCharCode(0x00) + String.fromCharCode(0x1b);
    const { 池 } = 创建模拟池(
      (文本) => 管理员行(文本) ?? (文本.includes('COUNT(*)') ? [{ 总数: '1' }] : [{ ID: 编号, 内容: 正文 }]),
    );
    const { 应用 } = 创建测试应用({ 池 });
    const 响应 = await request(应用).get('/api/guan-li/xiao-xi').set(授权头(签发管理令牌()));
    expect(响应.status).toBe(200);
    const 行 = (响应.body.shu_ju as Array<Record<string, unknown>>)[0];
    expect(行['内容']).toBe('危'.repeat(2000));
  });

  it('好友消息正文同样剥控制字符', async () => {
    const { 池 } = 创建模拟池(
      (文本) => 管理员行(文本) ?? (文本.includes('COUNT(*)') ? [{ 总数: '1' }] : [{ ID: 编号, 内容: `广告${String.fromCharCode(0x07)}骚扰` }]),
    );
    const { 应用 } = 创建测试应用({ 池 });
    const 响应 = await request(应用).get('/api/guan-li/hao-you-xiao-xi').set(授权头(签发管理令牌()));
    expect(响应.status).toBe(200);
    const 行 = (响应.body.shu_ju as Array<Record<string, unknown>>)[0];
    expect(行['内容']).toBe('广告骚扰');
  });
});

describe('读出口接线：审核列表', () => {
  it('举报原因剥控制字符', async () => {
    const { 池 } = 创建模拟池(
      (文本) => 管理员行(文本) ?? (文本.includes('COUNT(*)') ? [{ 总数: '1' }] : [{ ID: 编号, 原因: `刷屏${String.fromCharCode(0x00)}广告` }]),
    );
    const { 应用 } = 创建测试应用({ 池 });
    const 响应 = await request(应用).get('/api/guan-li/ju-bao-lie-biao').set(授权头(签发管理令牌()));
    expect(响应.status).toBe(200);
    const 行 = (响应.body.shu_ju as Array<Record<string, unknown>>)[0];
    expect(行['原因']).toBe('刷屏广告');
  });
});

describe('读出口接线：封禁记录列表', () => {
  it('封禁原因剥控制字符', async () => {
    const { 池 } = 创建模拟池(
      (文本) => 管理员行(文本) ?? (文本.includes('COUNT(*)') ? [{ 总数: '1' }] : [{ ID: 编号, 原因: `辱骂${String.fromCharCode(0x1f)}他人` }]),
    );
    const { 应用 } = 创建测试应用({ 池 });
    const 响应 = await request(应用).get('/api/guan-li/feng-jin-ji-lu').set(授权头(签发管理令牌()));
    expect(响应.status).toBe(200);
    const 行 = (响应.body.shu_ju as Array<Record<string, unknown>>)[0];
    expect(行['原因']).toBe('辱骂他人');
  });
});

describe('读出口接线：思考记录详情', () => {
  it('单条正文剥控制字符并按 5000 码点截断', async () => {
    const 正文 = '思'.repeat(6000) + String.fromCharCode(0x7f);
    const { 池 } = 创建模拟池((文本) => 管理员行(文本) ?? [{ ID: 编号, 内容: 正文 }]);
    const { 应用 } = 创建测试应用({ 池 });
    const 响应 = await request(应用).get(`/api/guan-li/si-kao-ji-lu/${编号}`).set(授权头(签发管理令牌()));
    expect(响应.status).toBe(200);
    const 数据 = 响应.body.shu_ju as Record<string, unknown>;
    expect(数据['内容']).toBe('思'.repeat(5000));
  });
});
