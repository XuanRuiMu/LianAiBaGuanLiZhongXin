import { describe, it, expect } from 'vitest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { 创建测试应用, 签发管理令牌, 授权头, 创建模拟池, 测试用户编号 } from './测试辅助';

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
    expect(响应.body.shu_ju.jiao_se).toBe('chao_guan');
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

type 旗标组 = { 管理员: boolean; 运营: boolean; 审核员: boolean };

function 三角色池(旗标: 旗标组, 密码 = 'mi-ma-123') {
  const 哈希 = bcrypt.hashSync(密码, 4);
  return 创建模拟池((文本) => {
    if (文本.includes('FROM "用户" WHERE "手机号"')) {
      return [{ ID: 测试用户编号, 手机号: '13800000000', 用户名: 'jiao-se-yuan', 密码哈希: 哈希, ...旗标 }];
    }
    if (文本.includes('SELECT "管理员"')) {
      return [{ ...旗标 }];
    }
    return [{ ID: 测试用户编号 }];
  });
}

function 曲奇令牌(响应: { headers: Record<string, unknown> }, 名: string): string {
  const 项 = (响应.headers['set-cookie'] as unknown as string[]).find((条) => 条.startsWith(`${名}=`));
  return decodeURIComponent(String(项).split(';')[0].split('=')[1] ?? '');
}

// FP-17 扩权后按契约第8行口径：运营=读+封禁+统计，审核员=读+封禁审核（矩阵字面量金丝雀，改矩阵必改此行）
const 三角色用例: Array<{ 角色: string; 旗标: 旗标组; 能力: string[] }> = [
  { 角色: 'chao_guan', 旗标: { 管理员: true, 运营: false, 审核员: false }, 能力: ['cha_kan', 'feng_jin', 'feng_jin_shen_he', 'tong_ji_xie', 'gao_we'] },
  { 角色: 'yun_ying', 旗标: { 管理员: false, 运营: true, 审核员: false }, 能力: ['cha_kan', 'feng_jin', 'tong_ji_xie'] },
  { 角色: 'shen_he_yuan', 旗标: { 管理员: false, 运营: false, 审核员: true }, 能力: ['cha_kan', 'feng_jin_shen_he'] },
];

describe('YH-108 三角色登录链路', () => {
  for (const 用例 of 三角色用例) {
    it(`${用例.角色}可登录且令牌与响应携带同一角色标识`, async () => {
      const 自备 = 三角色池(用例.旗标);
      const { 应用 } = 创建测试应用({ 池: 自备.池 });
      const 响应 = await request(应用).post(登录路径).send({ shou_ji_hao: '13800000000', mi_ma: 'mi-ma-123' });
      expect(响应.status).toBe(200);
      expect(响应.body.shu_ju.jiao_se).toBe(用例.角色);
      expect(响应.body.shu_ju.neng_li).toEqual(用例.能力);
      const 载荷 = jwt.decode(曲奇令牌(响应, 'guan_li_ling_pai')) as Record<string, unknown>;
      expect(载荷['jiaoSe']).toBe(用例.角色);
      expect(载荷['guanLi']).toBeUndefined();
      expect(载荷['yongHuId']).toBe(测试用户编号);
    });

    it(`${用例.角色}持Cookie可通过管理员门禁读取账号列表`, async () => {
      const 自备 = 三角色池(用例.旗标);
      const { 应用 } = 创建测试应用({ 池: 自备.池 });
      const 登录 = await request(应用).post(登录路径).send({ shou_ji_hao: '13800000000', mi_ma: 'mi-ma-123' });
      const 曲奇头 = (登录.headers['set-cookie'] as unknown as string[]).map((项) => String(项).split(';')[0]).join('; ');
      const 列表 = await request(应用).get('/api/guan-li/zhang-hao-lie-biao').set('Cookie', 曲奇头);
      expect(列表.status).toBe(200);
      const 身份 = await request(应用).get('/api/guan-li/wo-de-jiao-se').set('Cookie', 曲奇头);
      expect(身份.status).toBe(200);
      expect(身份.body.shu_ju.jiao_se).toBe(用例.角色);
    });

    it(`${用例.角色}刷新轮换按查库角色签票`, async () => {
      const 自备 = 三角色池(用例.旗标);
      const { 应用 } = 创建测试应用({ 池: 自备.池 });
      const 登录 = await request(应用).post(登录路径).send({ shou_ji_hao: '13800000000', mi_ma: 'mi-ma-123' });
      const 旧刷新 = 曲奇令牌(登录, 'guan_li_shua_xin');
      const 轮换 = await request(应用).post('/api/guan-li/shua-xin').send({ shua_xin_ling_pai: 旧刷新 });
      expect(轮换.status).toBe(200);
      expect(轮换.body.shu_ju.jiao_se).toBe(用例.角色);
      expect(轮换.body.shu_ju.neng_li).toEqual(用例.能力);
      const 载荷 = jwt.decode(曲奇令牌(轮换, 'guan_li_ling_pai')) as Record<string, unknown>;
      expect(载荷['jiaoSe']).toBe(用例.角色);
    });
  }

  it('三旗标全伪账号登录403且不签发令牌', async () => {
    const 自备 = 三角色池({ 管理员: false, 运营: false, 审核员: false });
    const { 应用 } = 创建测试应用({ 池: 自备.池 });
    const 响应 = await request(应用).post(登录路径).send({ shou_ji_hao: '13800000000', mi_ma: 'mi-ma-123' });
    expect(响应.status).toBe(403);
    expect(响应.body.cuo_wu_ma).toBe('WU_GUAN_LI_QUAN_XIAN');
    expect(响应.headers['set-cookie']).toBeUndefined();
  });

  it('登录查询语句按三角色列读取，不再只认管理员单列', async () => {
    const 自备 = 三角色池({ 管理员: false, 运营: true, 审核员: false });
    const { 应用, 查询记录 } = 创建测试应用({ 池: 自备.池 });
    const 响应 = await request(应用).post(登录路径).send({ shou_ji_hao: '13800000000', mi_ma: 'mi-ma-123' });
    expect(响应.status).toBe(200);
    const 登录查 = 查询记录.find((记录) => 记录.文本.includes('FROM "用户" WHERE "手机号"'));
    expect(登录查?.文本).toContain('"运营"');
    expect(登录查?.文本).toContain('"审核员"');
  });
});
