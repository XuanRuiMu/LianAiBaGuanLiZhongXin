import { describe, it, expect } from 'vitest';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { 创建测试应用, 签发管理令牌, 授权头, 创建模拟池 } from './测试辅助';

const 登录路径 = '/api/guan-li/deng-lu';

function 带用户池(管理员 = true, 密码 = 'mi-ma-123') {
  const 哈希 = bcrypt.hashSync(密码, 4);
  const { 池, 查询记录 } = 创建模拟池((文本) => {
    if (文本.includes('SELECT "管理员"')) return [{ 管理员: true }];
    if (文本.includes('FROM "用户" WHERE "手机号"')) {
      return [{ ID: '22222222-2222-4222-8222-222222222222', 手机号: '13800000000', 用户名: 'guan-li-yuan', 密码哈希: 哈希, 管理员 }];
    }
    return [{ ID: '22222222-2222-4222-8222-222222222222' }];
  });
  return { 池, 查询记录 };
}

describe('管理登录签发', () => {
  it('正确账密签发管理令牌走安全Cookie不回明文', async () => {
    const { 池 } = 带用户池(true);
    const { 应用 } = 创建测试应用({ 池 });
    const 响应 = await request(应用).post(登录路径).send({ shou_ji_hao: '13800000000', mi_ma: 'mi-ma-123' });
    expect(响应.status).toBe(200);
    expect(响应.body.cheng_gong).toBe(true);
    expect(响应.body.shu_ju.ling_pai).toBeUndefined();
    expect(响应.body.shu_ju.shua_xin_ling_pai).toBeUndefined();
    expect(响应.body.shu_ju.guan_li).toBe(true);
    const 曲奇 = 响应.headers['set-cookie'] as unknown as string[] | undefined;
    expect(Array.isArray(曲奇)).toBe(true);
    expect(曲奇!.some((项) => 项.includes('guan_li_ling_pai=') && 项.includes('HttpOnly'))).toBe(true);
    expect(曲奇!.some((项) => 项.includes('guan_li_shua_xin=') && 项.includes('HttpOnly'))).toBe(true);
  });

  it('签发管理令牌曲奇载荷无手机号明文', async () => {
    const { 池 } = 带用户池(true);
    const { 应用 } = 创建测试应用({ 池 });
    const 响应 = await request(应用).post(登录路径).send({ shou_ji_hao: '13800000000', mi_ma: 'mi-ma-123' });
    expect(响应.status).toBe(200);
    const 曲奇 = 响应.headers['set-cookie'] as unknown as string[];
    const 令牌项 = 曲奇.find((项) => 项.startsWith('guan_li_ling_pai='));
    const 令牌值 = String(令牌项).split(';')[0].split('=')[1] ?? '';
    const 载荷段 = decodeURIComponent(令牌值).split('.')[1] ?? '';
    const 明文 = Buffer.from(载荷段, 'base64url').toString('utf8');
    expect(明文).not.toContain('13800000000');
  });

  it('刷新轮换成功旧刷新复用吊销', async () => {
    const { 池 } = 带用户池(true);
    const { 应用 } = 创建测试应用({ 池 });
    const 登录 = await request(应用).post(登录路径).send({ shou_ji_hao: '13800000000', mi_ma: 'mi-ma-123' });
    expect(登录.status).toBe(200);
    const 登录曲奇 = 登录.headers['set-cookie'] as unknown as string[];
    const 刷新项 = 登录曲奇.find((项) => 项.startsWith('guan_li_shua_xin='));
    const 旧刷新 = decodeURIComponent(String(刷新项).split(';')[0].split('=')[1] ?? '');
    const 轮换 = await request(应用).post('/api/guan-li/shua-xin').send({ shua_xin_ling_pai: 旧刷新 });
    expect(轮换.status).toBe(200);
    const 轮换曲奇 = 轮换.headers['set-cookie'] as unknown as string[];
    expect(轮换曲奇.some((项) => 项.includes('guan_li_ling_pai='))).toBe(true);
    const 复用 = await request(应用).post('/api/guan-li/shua-xin').send({ shua_xin_ling_pai: 旧刷新 });
    expect(复用.status).toBe(401);
    expect(复用.body.cuo_wu_ma).toBe('LING_PAI_WU_XIAO');
  });

  it('错误密码返回400且不签发', async () => {
    const { 池 } = 带用户池(true, 'dui-de-mi-ma-123');
    const { 应用 } = 创建测试应用({ 池 });
    const 响应 = await request(应用).post(登录路径).send({ shou_ji_hao: '13800000000', mi_ma: 'cuo-wu-mi-ma-123' });
    expect(响应.status).toBe(400);
    expect(响应.body.shu_ju).toBeNull();
  });

  it('非管理员返回403', async () => {
    const { 池 } = 带用户池(false);
    const { 应用 } = 创建测试应用({ 池 });
    const 响应 = await request(应用).post(登录路径).send({ shou_ji_hao: '13800000000', mi_ma: 'mi-ma-123' });
    expect(响应.status).toBe(403);
    expect(响应.body.cuo_wu_ma).toBe('WU_GUAN_LI_QUAN_XIAN');
  });

  it('缺参返回400', async () => {
    const { 应用 } = 创建测试应用();
    const 响应 = await request(应用).post(登录路径).send({ shou_ji_hao: '13800000000' });
    expect(响应.status).toBe(400);
  });

  it('过短密码直接拒收不查库', async () => {
    const { 池 } = 带用户池(true);
    const { 应用, 查询记录 } = 创建测试应用({ 池 });
    const 响应 = await request(应用).post(登录路径).send({ shou_ji_hao: '13800000000', mi_ma: '123' });
    expect(响应.status).toBe(400);
    expect(查询记录.some((记录) => 记录.文本.includes('FROM "用户" WHERE "手机号"'))).toBe(false);
  });

  it('曲奇令牌可调管理接口', async () => {
    const { 池 } = 带用户池(true);
    const { 应用 } = 创建测试应用({ 池 });
    const 登录 = await request(应用).post(登录路径).send({ shou_ji_hao: '13800000000', mi_ma: 'mi-ma-123' });
    const 登录曲奇 = 登录.headers['set-cookie'] as unknown as string[];
    const 曲奇头 = 登录曲奇.map((项) => String(项).split(';')[0]).join('; ');
    const 列表 = await request(应用).get('/api/guan-li/zhang-hao-lie-biao').set('Cookie', 曲奇头);
    expect(列表.status).toBe(200);
    expect(列表.body.cheng_gong).toBe(true);
  });

  it('旧粘贴令牌仍兼容通行', async () => {
    const { 应用 } = 创建测试应用();
    const 响应 = await request(应用).get('/api/guan-li/zhang-hao-lie-biao').set(授权头(签发管理令牌()));
    expect(响应.status).toBe(200);
  });
});
