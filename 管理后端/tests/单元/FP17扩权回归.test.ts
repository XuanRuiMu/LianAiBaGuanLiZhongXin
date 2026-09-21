import { describe, it, expect } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import {
  创建测试应用,
  签发管理令牌,
  授权头,
  创建模拟池,
  默认行,
  测试用户编号,
} from './测试辅助';
import type { GuanLiJiaoSe } from '../../src/中间件/管理员';

/**
 * FP-17（用户裁决 L-27「按文档扩权」）扩权安全回归。
 * 口径唯一真源：src/中间件/管理员.ts::角色能力矩阵（docs/契约.md 第8行逐字一致守卫在 RBAC矩阵.test.ts）。
 * 本文件只钉三件事：扩到位的（运营封禁/统计、审核员封禁审核）2xx；
 * 不得顺带放开的（授回收/夺舍/归还/审核评审发布）403；申报与伪造一律不生效。
 */

type 旗标组 = { 管理员: boolean; 运营: boolean; 审核员: boolean };

const 角色旗标: Record<GuanLiJiaoSe, 旗标组> = {
  chao_guan: { 管理员: true, 运营: false, 审核员: false },
  yun_ying: { 管理员: false, 运营: true, 审核员: false },
  shen_he_yuan: { 管理员: false, 运营: false, 审核员: true },
};

const 目标编号 = '77777777-7777-4777-8777-777777777777';

const 统计路由清单 = [
  '/api/guan-li/tong-ji/zhu-ce',
  '/api/guan-li/tong-ji/xiao-xi',
  '/api/guan-li/tong-ji/hao-gan-du',
  '/api/guan-li/tong-ji/liu-cun',
  '/api/guan-li/tong-ji/ai-yong-liang',
  '/api/guan-li/tong-ji/mai-dian-zi-dian',
];

const 超管专属写: Array<{ 路径: string; 正文: Record<string, unknown> }> = [
  { 路径: '/api/guan-li/shou-quan', 正文: { yong_hu_id: 目标编号, jiao_se: 'yun_ying', que_ren: true } },
  { 路径: '/api/guan-li/hui-shou', 正文: { yong_hu_id: 目标编号, jiao_se: 'yun_ying', que_ren: true } },
  { 路径: '/api/guan-li/duo-she', 正文: { jiao_se_id: 目标编号 } },
  { 路径: '/api/guan-li/gui-huan', 正文: { jiao_se_id: 目标编号 } },
  { 路径: '/api/guan-li/ju-bao-xin-jian', 正文: { yuan_yin: 'fp17' } },
  { 路径: '/api/guan-li/ju-bao-yi-shen', 正文: { mu_biao_id: 目标编号, tong_guo: true } },
  { 路径: '/api/guan-li/ju-bao-er-shen', 正文: { mu_biao_id: 目标编号, tong_guo: true } },
  { 路径: '/api/guan-li/ju-bao-pi-liang', 正文: { mu_biao_ids: [目标编号], tong_guo: true } },
  { 路径: '/api/guan-li/gong-gao-fa-bu', 正文: { mu_biao_id: 目标编号, dong_zuo: 'fa_bu' } },
];

function 建应用(角色: GuanLiJiaoSe | null) {
  const 旗标 = 角色 === null ? { 管理员: false, 运营: false, 审核员: false } : 角色旗标[角色];
  const 自备 = 创建模拟池((文本) => {
    if (文本.includes('SELECT "管理员"')) return [{ ...旗标 }];
    return 默认行(文本);
  });
  const 建 = 创建测试应用({ 池: 自备.池, 写上限: 300 });
  return { ...建, 头: 授权头(签发管理令牌()) };
}

describe('FP-17 ① 运营扩权面：封禁/解封/统计 2xx，超管专属写 403', () => {
  it('运营调封禁与解封 2xx', async () => {
    const { 应用, 头 } = 建应用('yun_ying');
    const 封 = await request(应用)
      .post('/api/guan-li/feng-jin')
      .set(头)
      .send({ yong_hu_id: 目标编号, yuan_yin: 'fp17-运营封禁取证' });
    expect(封.status, '运营持 feng_jin 应过封禁写门禁').toBe(201);
    const 解 = await request(应用).post('/api/guan-li/zhang-hao-feng-jin/jie-feng').set(头).send({ yong_hu_id: 目标编号 });
    expect(解.status).toBe(200);
  });

  it('运营调统计族（含读审计写侧）全部 2xx', async () => {
    const { 应用, 头, 查询记录 } = 建应用('yun_ying');
    for (const 路径 of 统计路由清单) {
      const 响应 = await request(应用).get(路径).set(头);
      expect(`${路径}:${响应.status}`, `运营读 ${路径}`).toBe(`${路径}:200`);
    }
    expect(查询记录.some((项) => 项.文本.includes('INSERT INTO "审计日志"') && 项.参数.includes('guan_li_cha_kan_tong_ji'))).toBe(true);
  });

  it('运营调封禁审核 403：feng_jin 不含审核位，扩权不互相溢出', async () => {
    const { 应用, 头 } = 建应用('yun_ying');
    const 响应 = await request(应用)
      .post('/api/guan-li/shen-su/shen-he')
      .set(头)
      .send({ yong_hu_id: 目标编号, tong_guo: false });
    expect(响应.status).toBe(403);
    expect(响应.body.cuo_wu_ma).toBe('WU_GUAN_LI_QUAN_XIAN');
  });

  it('运营调授回收/夺舍/归还/审核评审发布 403 WU_GUAN_LI_QUAN_XIAN', async () => {
    const { 应用, 头, 查询记录 } = 建应用('yun_ying');
    for (const 项 of 超管专属写) {
      const 响应 = await request(应用).post(项.路径).set(头).send(项.正文);
      expect(`${项.路径}:${响应.status}`, `运营写 ${项.路径}`).toBe(`${项.路径}:403`);
      expect(响应.body.cuo_wu_ma).toBe('WU_GUAN_LI_QUAN_XIAN');
    }
    expect(查询记录.some((项) => 项.文本.startsWith('UPDATE "用户" SET'))).toBe(false);
  });
});

describe('FP-17 ② 审核员扩权面：封禁审核 2xx，统计与封禁写与高危写 403', () => {
  it('审核员调封禁申诉审核（通过/驳回）2xx', async () => {
    const { 应用, 头 } = 建应用('shen_he_yuan');
    const 驳 = await request(应用)
      .post('/api/guan-li/shen-su/shen-he')
      .set(头)
      .send({ yong_hu_id: 目标编号, tong_guo: false });
    expect(驳.status, '审核员持 feng_jin_shen_he 应过申诉审核门禁').toBe(200);
    const 通 = await request(应用)
      .post('/api/guan-li/shen-su/shen-he')
      .set(头)
      .send({ yong_hu_id: 目标编号, tong_guo: true });
    expect(通.status).toBe(200);
  });

  it('审核员调统计族全部 403：契约第8行统计只归运营', async () => {
    const { 应用, 头 } = 建应用('shen_he_yuan');
    for (const 路径 of 统计路由清单) {
      const 响应 = await request(应用).get(路径).set(头);
      expect(`${路径}:${响应.status}`, `审核员读 ${路径}`).toBe(`${路径}:403`);
      expect(响应.body.cuo_wu_ma).toBe('WU_GUAN_LI_QUAN_XIAN');
    }
  });

  it('审核员调封禁/解封与超管专属写全部 403，业务只读域不受影响', async () => {
    const { 应用, 头 } = 建应用('shen_he_yuan');
    const 封 = await request(应用).post('/api/guan-li/feng-jin').set(头).send({ yong_hu_id: 目标编号, yuan_yin: 'fp17' });
    expect(封.status).toBe(403);
    const 解 = await request(应用).post('/api/guan-li/zhang-hao-feng-jin/jie-feng').set(头).send({ yong_hu_id: 目标编号 });
    expect(解.status).toBe(403);
    for (const 项 of 超管专属写) {
      const 响应 = await request(应用).post(项.路径).set(头).send(项.正文);
      expect(`${项.路径}:${响应.status}`, `审核员写 ${项.路径}`).toBe(`${项.路径}:403`);
    }
    for (const 路径 of ['/api/guan-li/zhang-hao-lie-biao', '/api/guan-li/feng-jin-ji-lu', '/api/guan-li/zhang-hao-feng-jin', '/api/guan-li/ju-bao-lie-biao', '/api/guan-li/liu-hen', '/api/guan-li/shen-ji-ri-zhi']) {
      const 响应 = await request(应用).get(路径).set(头);
      expect(`${路径}:${响应.status}`, `审核员只读 ${路径}`).toBe(`${路径}:200`);
    }
  });
});

describe('FP-17 ③ 申报与伪造不提权', () => {
  it('运营请求体申报更高 jiao_se 调授回收仍 403 且零 UPDATE', async () => {
    const { 应用, 头, 查询记录 } = 建应用('yun_ying');
    const 响应 = await request(应用)
      .post('/api/guan-li/shou-quan')
      .set(头)
      .send({ yong_hu_id: 目标编号, jiao_se: 'chao_guan', que_ren: true });
    expect(响应.status).toBe(403);
    expect(查询记录.some((项) => 项.文本.startsWith('UPDATE "用户" SET'))).toBe(false);
  });

  it('令牌载荷伪造 jiaoSe=chao_guan 但库中是运营：身份按查库，高危写 403，封禁写按矩阵放行', async () => {
    const { 应用 } = 建应用('yun_ying');
    const 伪造 = jwt.sign(
      { yongHuId: 测试用户编号, jiaoSe: 'chao_guan', gao_we: true, qianFaHaoMiao: Date.now() },
      String(process.env.JWT_SECRET),
      { expiresIn: '1h', jwtid: '88888888-8888-4888-8888-888888888888' },
    );
    const 头 = 授权头(伪造);
    const 身份 = await request(应用).get('/api/guan-li/wo-de-jiao-se').set(头);
    expect(身份.body.shu_ju.jiao_se).toBe('yun_ying');
    expect([...身份.body.shu_ju.neng_li as string[]].sort()).toEqual(['cha_kan', 'feng_jin', 'tong_ji_xie']);
    const 夺 = await request(应用).post('/api/guan-li/duo-she').set(头).send({ jiao_se_id: 目标编号 });
    expect(夺.status).toBe(403);
    const 封 = await request(应用).post('/api/guan-li/feng-jin').set(头).send({ yong_hu_id: 目标编号, yuan_yin: 'fp17' });
    expect(封.status).toBe(201);
  });

  it('审核员请求体申报封禁权限调封禁仍 403：矩阵外能力不因申报出现', async () => {
    const { 应用, 头 } = 建应用('shen_he_yuan');
    const 响应 = await request(应用)
      .post('/api/guan-li/feng-jin')
      .set(头)
      .send({ yong_hu_id: 目标编号, yuan_yin: 'fp17', jiao_se: 'yun_ying' });
    expect(响应.status).toBe(403);
  });
});

describe('FP-17 ④ 无旗标账号：登录403不落令牌，扩权路由同样403', () => {
  function 登录池(旗标: 旗标组, 密码 = 'mi-ma-123') {
    const 哈希 = bcrypt.hashSync(密码, 4);
    return 创建模拟池((文本) => {
      if (文本.includes('FROM "用户" WHERE "手机号"')) {
        return [{ ID: 测试用户编号, 手机号: '13800000000', 用户名: 'fp17-wu-qibiao', 密码哈希: 哈希, ...旗标 }];
      }
      if (文本.includes('SELECT "管理员"')) {
        return [{ ...旗标 }];
      }
      return 默认行(文本);
    });
  }

  it('三旗标全伪登录403且零 Set-Cookie', async () => {
    const 自备 = 登录池({ 管理员: false, 运营: false, 审核员: false });
    const { 应用 } = 创建测试应用({ 池: 自备.池 });
    const 响应 = await request(应用).post('/api/guan-li/deng-lu').send({ shou_ji_hao: '13800000000', mi_ma: 'mi-ma-123' });
    expect(响应.status).toBe(403);
    expect(响应.body.cuo_wu_ma).toBe('WU_GUAN_LI_QUAN_XIAN');
    expect(响应.headers['set-cookie']).toBeUndefined();
  });

  it('无旗标存量令牌调封禁/封禁审核/统计一律403（管理员门禁先于能力门禁拦截）', async () => {
    const 自备 = 登录池({ 管理员: false, 运营: false, 审核员: false });
    const 建 = 创建测试应用({ 池: 自备.池, 写上限: 300 });
    const 头 = 授权头(签发管理令牌());
    const 封 = await request(建.应用).post('/api/guan-li/feng-jin').set(头).send({ yong_hu_id: 目标编号, yuan_yin: 'fp17' });
    expect(封.status).toBe(403);
    const 审 = await request(建.应用).post('/api/guan-li/shen-su/shen-he').set(头).send({ yong_hu_id: 目标编号, tong_guo: false });
    expect(审.status).toBe(403);
    const 计 = await request(建.应用).get('/api/guan-li/tong-ji/zhu-ce').set(头);
    expect(计.status).toBe(403);
    expect(计.body.cuo_wu_ma).toBe('WU_GUAN_LI_QUAN_XIAN');
  });
});

describe('FP-17 超管全量不回退', () => {
  it('超管对三条扩权写与统计族仍全部可达', async () => {
    const { 应用, 头 } = 建应用('chao_guan');
    const 封 = await request(应用).post('/api/guan-li/feng-jin').set(头).send({ yong_hu_id: 目标编号, yuan_yin: 'fp17-超管' });
    expect(封.status).toBe(201);
    const 审 = await request(应用).post('/api/guan-li/shen-su/shen-he').set(头).send({ yong_hu_id: 目标编号, tong_guo: true });
    expect(审.status).toBe(200);
    for (const 路径 of 统计路由清单) {
      const 响应 = await request(应用).get(路径).set(头);
      expect(`${路径}:${响应.status}`, `超管读 ${路径}`).toBe(`${路径}:200`);
    }
  });
});
