import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import {
  创建测试应用,
  签发管理令牌,
  授权头,
  创建模拟池,
  创建模拟缓存,
  默认行,
  测试用户编号,
} from './测试辅助';
import {
  按用户编号取角色,
  取角色能力,
  管理角色清单,
  角色能力矩阵,
  能力中文口径,
  清空管理员缓存,
  订阅失效广播,
  广播管理员失效,
  type GuanLiJiaoSe,
  type GuanLiNengLi,
} from '../../src/中间件/管理员';

/**
 * YH-108 三角色权限矩阵（登录→签票→门禁→高危）端到端断言。
 * 根因：门禁已按三角色分流，但登录与签票只认 管理员 单列，运营/审核员「能查不能登」。
 */

type 旗标组 = { 管理员: boolean; 运营: boolean; 审核员: boolean };

const 角色旗标: Record<GuanLiJiaoSe, 旗标组> = {
  chao_guan: { 管理员: true, 运营: false, 审核员: false },
  yun_ying: { 管理员: false, 运营: true, 审核员: false },
  shen_he_yuan: { 管理员: false, 运营: false, 审核员: true },
};

const 只读路由 = [
  '/api/guan-li/wo-de-jiao-se',
  '/api/guan-li/zhang-hao-lie-biao',
  `/api/guan-li/zhang-hao-xiang-qing/${测试用户编号}`,
  `/api/guan-li/zhang-hao-jie-mi/${测试用户编号}`,
  '/api/guan-li/xiao-xi',
  '/api/guan-li/si-kao-shuo-ming',
  '/api/guan-li/feng-jin-ji-lu',
  '/api/guan-li/zhang-hao-feng-jin',
  '/api/guan-li/shen-ji-ri-zhi',
  '/api/guan-li/ju-bao-lie-biao',
  '/api/guan-li/liu-hen',
];

// FP-17 扩权后口径：授回收/夺舍/归还与审核评审发布仍超管专属（gao_we）
const 超管专属写路由: Array<{ 路径: string; 正文: Record<string, unknown> }> = [
  { 路径: '/api/guan-li/shou-quan', 正文: {} },
  { 路径: '/api/guan-li/hui-shou', 正文: {} },
  { 路径: '/api/guan-li/duo-she', 正文: {} },
  { 路径: '/api/guan-li/gui-huan', 正文: {} },
  { 路径: '/api/guan-li/ju-bao-xin-jian', 正文: {} },
  { 路径: '/api/guan-li/ju-bao-yi-shen', 正文: {} },
  { 路径: '/api/guan-li/ju-bao-er-shen', 正文: {} },
  { 路径: '/api/guan-li/ju-bao-pi-liang', 正文: {} },
  { 路径: '/api/guan-li/gong-gao-fa-bu', 正文: {} },
  { 路径: '/api/guan-li/huo-dong-fa-bu', 正文: {} },
  { 路径: '/api/guan-li/shi-yan-fa-bu', 正文: {} },
];

const 写路由全集 = [
  { 路径: '/api/guan-li/feng-jin', 正文: {} },
  { 路径: '/api/guan-li/zhang-hao-feng-jin/jie-feng', 正文: {} },
  { 路径: '/api/guan-li/shen-su/shen-he', 正文: {} },
  ...超管专属写路由,
];

function 建应用(角色: GuanLiJiaoSe | null) {
  const 旗标 = 角色 === null ? { 管理员: false, 运营: false, 审核员: false } : 角色旗标[角色];
  const 自备 = 创建模拟池((文本) => {
    if (文本.includes('SELECT "管理员"')) return [{ ...旗标 }];
    return 默认行(文本);
  });
  const 建 = 创建测试应用({ 池: 自备.池, 写上限: 200 });
  return { ...建, 头: 授权头(签发管理令牌()) };
}

describe('YH-108 角色能力矩阵单源', () => {
  it('FP-17 扩权后矩阵：超管五位全量，运营=读+封禁+统计，审核员=读+封禁审核，无角色无能力', () => {
    expect([...取角色能力('chao_guan')]).toEqual(['cha_kan', 'feng_jin', 'feng_jin_shen_he', 'tong_ji_xie', 'gao_we']);
    expect([...取角色能力('yun_ying')]).toEqual(['cha_kan', 'feng_jin', 'tong_ji_xie']);
    expect([...取角色能力('shen_he_yuan')]).toEqual(['cha_kan', 'feng_jin_shen_he']);
    expect(取角色能力(null)).toEqual([]);
    expect(Object.keys(角色能力矩阵)).toEqual(['chao_guan', 'yun_ying', 'shen_he_yuan']);
  });

  it('写路由清单非空且全部落在管理前缀内，防矩阵静默失去覆盖面', () => {
    expect(写路由全集.length).toBeGreaterThanOrEqual(14);
    for (const 项 of 写路由全集) {
      expect(项.路径.startsWith('/api/guan-li/')).toBe(true);
    }
  });

  // 结构守卫：写路由只要注册就必须挂能力门禁（FP-17 起含 封禁门禁/封禁审核门禁），
  // 超管专属写（授回收/夺舍/归还/审核评审发布）必须仍挂高危门禁，扩权不得顺带放开它们
  it('src/路由 下每个写路由注册处都挂能力门禁，超管专属写仍挂高危门禁，公开入口除登录/刷新外为零', () => {
    const 免门禁入口 = ['deng-lu', 'shua-xin'];
    const 合法门禁 = ['高危门禁', '封禁门禁', '封禁审核门禁'];
    const 超管专属段 = ['shou-quan', 'hui-shou', 'duo-she', 'gui-huan', 'xin-jian', 'yi-shen', 'er-shen', 'pi-liang', 'fa-bu'];
    const 目录 = path.resolve(__dirname, '../../src/路由');
    const 注册点: string[] = [];
    let 高危门禁数 = 0;
    for (const 文件 of fs.readdirSync(目录).filter((名) => 名.endsWith('.ts'))) {
      const 源 = fs.readFileSync(path.join(目录, 文件), 'utf8');
      for (const 块 of 源.split('路由.post(').slice(1)) {
        const 头部 = 块.slice(0, 200);
        const 路径段 = /^\s*['`]\/?([^'`\s$]*)/.exec(头部)?.[1] ?? '';
        if (免门禁入口.includes(路径段)) {
          continue;
        }
        注册点.push(`${文件}/${路径段}`);
        const 挂门禁名 = 合法门禁.find((名) => 头部.includes(名));
        expect(挂门禁名, `写路由未挂能力门禁: ${文件} /${路径段}`).toBeDefined();
        if (超管专属段.some((段) => 头部.includes(`/${段}`) || 头部.includes(`-${段}`))) {
          expect(挂门禁名, `超管专属写不得改挂扩权门禁: ${文件} /${路径段}`).toBe('高危门禁');
        }
        if (挂门禁名 === '高危门禁') {
          高危门禁数 += 1;
        }
      }
    }
    expect(注册点.length).toBeGreaterThanOrEqual(14);
    expect(高危门禁数).toBeGreaterThanOrEqual(11);
  });

  // FP-03 注销是会话终结而非业务写：与只读路由同层（认证＋管理员门禁之后），
  // 既不得挂业务能力门禁，也绝不允许落到登录/刷新那组免门禁公开入口里
  it('登出端点挂在认证＋管理员门禁之后，且不在 src/路由 的免门禁写入口内', () => {
    const 应用源 = fs.readFileSync(path.resolve(__dirname, '../../src/应用.ts'), 'utf8');
    const 挂载点 = 应用源.indexOf('管理路由.use(创建登出路由');
    expect(挂载点, 'src/应用.ts 未挂载登出路由').toBeGreaterThan(-1);
    const 之前 = 应用源.slice(0, 挂载点);
    expect(之前, '登出早于认证中间件挂载').toContain('管理路由.use(认证中间件)');
    expect(之前, '登出早于管理员门禁挂载').toContain('管理路由.use(管理员门禁)');
    const 目录 = path.resolve(__dirname, '../../src/路由');
    for (const 文件 of fs.readdirSync(目录).filter((名) => 名.endsWith('.ts'))) {
      expect(
        fs.readFileSync(path.join(目录, 文件), 'utf8'),
        `登出被写进免门禁的 src/路由/${文件}`,
      ).not.toContain('tui-chu');
    }
  });

  // FP-17 统计族守卫：/tong-ji/* 每条 GET 必须挂统计门禁（tong_ji_xie），漏挂即扩权口径失守
  it('src/路由/统计.ts 每条统计 GET 都挂统计门禁', () => {
    const 源 = fs.readFileSync(path.resolve(__dirname, '../../src/路由/统计.ts'), 'utf8');
    const 清单 = [...源.matchAll(/路由\.get\('(\/tong-ji[^']*)',\s*([^,]+),/g)].map((匹配) => [匹配[1], 匹配[2].trim()]);
    expect(清单.map((项) => 项[0])).toEqual([
      '/tong-ji/zhu-ce',
      '/tong-ji/xiao-xi',
      '/tong-ji/hao-gan-du',
      '/tong-ji/liu-cun',
      '/tong-ji/ai-yong-liang',
      '/tong-ji/mai-dian-zi-dian',
    ]);
    for (const [路径, 门禁名] of 清单) {
      expect(门禁名, `统计路由未挂统计门禁: ${路径}`).toBe('统计门禁');
    }
  });

  // FP-17（L-27 裁决「按文档扩权」）：矩阵派生口径与 docs/契约.md 第8行逐字一致，改任一侧必须两同改
  it('矩阵按能力中文口径派生的角色行与 契约.md 第8行逐字一致', () => {
    const 契约源 = fs.readFileSync(path.resolve(__dirname, '../../../docs/契约.md'), 'utf8');
    const 行 = (n: number) => 契约源.split(/\r?\n/)[n - 1];
    const 拼角色行 = (角色: GuanLiJiaoSe) =>
      取角色能力(角色)
        .map((位) => 能力中文口径[位])
        .join('加');
    const 期望行 =
      `RBAC三角色：审核员（${拼角色行('shen_he_yuan')}）/运营（${拼角色行('yun_ying')}）/` +
      `超级管理员（全量加${能力中文口径.gao_we}）；高危操作双人复核（${能力中文口径.gao_we}需二次确认码）。`;
    expect(行(8)).toBe(期望行);
    expect(能力中文口径.cha_kan).toBe('读');
    const 全集 = [...new Set(管理角色清单.flatMap((角色) => [...角色能力矩阵[角色]]))];
    expect([...角色能力矩阵.chao_guan].slice().sort()).toEqual(全集.slice().sort());
    for (const 角色 of ['yun_ying', 'shen_he_yuan'] as GuanLiJiaoSe[]) {
      expect(取角色能力(角色).includes('gao_we'), `${角色} 不得持有 gao_we`).toBe(false);
    }
  });
});

describe('YH-108 三角色只读可达集合', () => {
  for (const 角色 of ['chao_guan', 'yun_ying', 'shen_he_yuan'] as GuanLiJiaoSe[]) {
    it(`${角色}可访问全部只读路由`, async () => {
      const { 应用, 头 } = 建应用(角色);
      const 可达: string[] = [];
      for (const 路径 of 只读路由) {
        const 响应 = await request(应用).get(路径).set(头);
        expect(`${路径}:${响应.status}`, `${角色} 读 ${路径}`).toBe(`${路径}:200`);
        可达.push(路径);
      }
      expect(可达).toEqual(只读路由);
    });
  }

  it('身份接口回传服务端查库角色与能力，非客户端申报', async () => {
    for (const 角色 of ['chao_guan', 'yun_ying', 'shen_he_yuan'] as GuanLiJiaoSe[]) {
      const { 应用, 头 } = 建应用(角色);
      const 响应 = await request(应用).get('/api/guan-li/wo-de-jiao-se').set(头);
      expect(响应.status).toBe(200);
      expect(响应.body.shu_ju.jiao_se).toBe(角色);
      expect(响应.body.shu_ju.neng_li).toEqual([...取角色能力(角色)]);
    }
  });

  it('无角色令牌访问只读路由403且走 WU_GUAN_LI_QUAN_XIAN 口径', async () => {
    const { 应用, 头 } = 建应用(null);
    const 响应 = await request(应用).get('/api/guan-li/zhang-hao-lie-biao').set(头);
    expect(响应.status).toBe(403);
    expect(响应.body.cuo_wu_ma).toBe('WU_GUAN_LI_QUAN_XIAN');
  });
});

describe('FP-17 扩权后越权面：超管专属写仍仅超管', () => {
  for (const 角色 of ['yun_ying', 'shen_he_yuan'] as GuanLiJiaoSe[]) {
    it(`${角色}对超管专属写全部403且错误码走分流口径`, async () => {
      const { 应用, 头 } = 建应用(角色);
      for (const 项 of 超管专属写路由) {
        const 响应 = await request(应用).post(项.路径).set(头).send(项.正文);
        expect(`${项.路径}:${响应.status}`, `${角色} 写 ${项.路径}`).toBe(`${项.路径}:403`);
        expect(响应.body.cuo_wu_ma).toBe('WU_GUAN_LI_QUAN_XIAN');
      }
    });
  }

  it('超管对写路由全集过门禁（不再403，缺参由校验层400/404）', async () => {
    const { 应用, 头 } = 建应用('chao_guan');
    for (const 项 of 写路由全集) {
      const 响应 = await request(应用).post(项.路径).set(头).send(项.正文);
      expect(`${项.路径}:${响应.status}`, `超管写 ${项.路径}`).not.toBe(`${项.路径}:403`);
      expect([400, 404, 200, 201]).toContain(响应.status);
    }
  });
});

describe('YH-108 令牌载荷不可信：伪造角色不能提权', () => {
  function 伪造令牌(覆盖: Record<string, unknown>): string {
    return jwt.sign(
      { yongHuId: 测试用户编号, jiaoSe: 'chao_guan', gao_we: true, qianFaHaoMiao: Date.now(), ...覆盖 },
      String(process.env.JWT_SECRET),
      { expiresIn: '1h', jwtid: '44444444-4444-4444-8444-444444444444' },
    );
  }

  it('载荷写 chao_guan 但库中是审核员：只读200、高危403', async () => {
    const { 应用 } = 建应用('shen_he_yuan');
    const 头 = 授权头(伪造令牌({}));
    const 读 = await request(应用).get('/api/guan-li/zhang-hao-lie-biao').set(头);
    expect(读.status).toBe(200);
    const 身份 = await request(应用).get('/api/guan-li/wo-de-jiao-se').set(头);
    expect(身份.body.shu_ju.jiao_se).toBe('shen_he_yuan');
    expect(身份.body.shu_ju.neng_li).toEqual(['cha_kan', 'feng_jin_shen_he']);
    const 写 = await request(应用).post('/api/guan-li/feng-jin').set(头).send({});
    expect(写.status).toBe(403);
    expect(写.body.cuo_wu_ma).toBe('WU_GUAN_LI_QUAN_XIAN');
  });

  it('载荷自称超管但库中无任何角色：只读也403', async () => {
    const { 应用 } = 建应用(null);
    const 响应 = await request(应用).get('/api/guan-li/zhang-hao-lie-biao').set(授权头(伪造令牌({})));
    expect(响应.status).toBe(403);
  });

  it('载荷缺角色字段仍按查库角色放行（角色不来自载荷）', async () => {
    const { 应用 } = 建应用('yun_ying');
    const 响应 = await request(应用).get('/api/guan-li/wo-de-jiao-se').set(授权头(签发管理令牌()));
    expect(响应.status).toBe(200);
    expect(响应.body.shu_ju.jiao_se).toBe('yun_ying');
  });

  it('HS256之外的算法与伪造签名一律401', async () => {
    const { 应用 } = 建应用('chao_guan');
    const 假签 = jwt.sign({ yongHuId: 测试用户编号, jiaoSe: 'chao_guan' }, 'qi-ta-mi-yao-qi-ta-mi-yao-0123456789');
    expect((await request(应用).get('/api/guan-li/zhang-hao-lie-biao').set(授权头(假签))).status).toBe(401);
  });
});

describe('YH-108 角色缓存失效通道', () => {
  function 角色查询计数(记录: Array<{ 文本: string; 参数: unknown[] }>, 用户编号: string): number {
    return 记录.filter((项) => 项.文本.includes('SELECT "管理员", "运营", "审核员"') && String(项.参数[0] ?? '') === 用户编号).length;
  }

  it('同用户二次判定命中缓存不再查库，失效后重新查库', async () => {
    const 自备 = 创建模拟池((文本) => {
      if (文本.includes('SELECT "管理员"')) return [角色旗标.yun_ying];
      return 默认行(文本);
    });
    清空管理员缓存();
    expect(await 按用户编号取角色(测试用户编号, 自备.池)).toBe('yun_ying');
    expect(await 按用户编号取角色(测试用户编号, 自备.池)).toBe('yun_ying');
    expect(角色查询计数(自备.查询记录, 测试用户编号)).toBe(1);
    await 广播管理员失效(undefined, 测试用户编号);
    expect(await 按用户编号取角色(测试用户编号, 自备.池)).toBe('yun_ying');
    expect(角色查询计数(自备.查询记录, 测试用户编号)).toBe(2);
  });

  it('跨实例失效广播清角色缓存，下一条判定回查库', async () => {
    const 模拟缓存 = 创建模拟缓存();
    清空管理员缓存();
    await 订阅失效广播(模拟缓存.缓存 as never);
    const 自备 = 创建模拟池((文本) => {
      if (文本.includes('SELECT "管理员"')) return [角色旗标.shen_he_yuan];
      return 默认行(文本);
    });
    expect(await 按用户编号取角色(测试用户编号, 自备.池)).toBe('shen_he_yuan');
    expect(角色查询计数(自备.查询记录, 测试用户编号)).toBe(1);
    await 模拟缓存.缓存.publish('guan_li_shi_xiao', JSON.stringify({ 用户编号: 测试用户编号 }));
    await 按用户编号取角色(测试用户编号, 自备.池);
    expect(角色查询计数(自备.查询记录, 测试用户编号)).toBe(2);
    await 按用户编号取角色(测试用户编号, 自备.池);
    expect(角色查询计数(自备.查询记录, 测试用户编号)).toBe(2);
    await 模拟缓存.缓存.publish('guan_li_shi_xiao', 'fei-JSON');
    await 按用户编号取角色(测试用户编号, 自备.池);
    expect(角色查询计数(自备.查询记录, 测试用户编号)).toBe(3);
  });

  it('授予/回收角色写操作后目标角色缓存立即失效，不等过期', async () => {
    const 自备 = 创建模拟池((文本) => {
      if (文本.includes('SELECT "管理员"')) return [角色旗标.chao_guan];
      return 默认行(文本);
    });
    const 模拟缓存 = 创建模拟缓存();
    清空管理员缓存();
    const 建 = 创建测试应用({ 池: 自备.池, 缓存: 模拟缓存.缓存, 写上限: 200 });
    const 头 = 授权头(签发管理令牌({ yongHuId: '55555555-5555-4555-8555-555555555555' }));
    expect(await 按用户编号取角色(测试用户编号, 自备.池)).toBe('chao_guan');
    expect(角色查询计数(自备.查询记录, 测试用户编号)).toBe(1);
    const 授 = await request(建.应用)
      .post('/api/guan-li/shou-quan')
      .set(头)
      .send({ yong_hu_id: 测试用户编号, jiao_se: 'yun_ying', que_ren: true });
    expect(授.status).toBe(200);
    const 授后 = 角色查询计数(自备.查询记录, 测试用户编号);
    expect(await 按用户编号取角色(测试用户编号, 自备.池)).toBe('chao_guan');
    expect(角色查询计数(自备.查询记录, 测试用户编号)).toBe(授后 + 1);
    const 收 = await request(建.应用)
      .post('/api/guan-li/hui-shou')
      .set(头)
      .send({ yong_hu_id: 测试用户编号, jiao_se: 'yun_ying', que_ren: true });
    expect(收.status).toBe(200);
    const 收后 = 角色查询计数(自备.查询记录, 测试用户编号);
    await 按用户编号取角色(测试用户编号, 自备.池);
    expect(角色查询计数(自备.查询记录, 测试用户编号)).toBe(收后 + 1);
    expect(模拟缓存.表.has(`jwt_yong_hu_cheXiao:${测试用户编号}`)).toBe(true);
    清空管理员缓存();
  });

  it('账号封禁只失效被处置账号，IP 封禁不得清空全量角色缓存', async () => {
    const 被处置编号 = '66666666-6666-4666-8666-666666666666';
    const 自备 = 创建模拟池((文本) => {
      if (文本.includes('SELECT "管理员"')) return [角色旗标.chao_guan];
      return 默认行(文本);
    });
    清空管理员缓存();
    const { 应用 } = 创建测试应用({ 池: 自备.池, 写上限: 200 });
    const 查询记录 = 自备.查询记录;
    const 头 = 授权头(签发管理令牌());
    expect(await 按用户编号取角色(测试用户编号, 自备.池)).toBe('chao_guan');
    expect(await 按用户编号取角色(被处置编号, 自备.池)).toBe('chao_guan');
    expect(角色查询计数(查询记录, 测试用户编号)).toBe(1);
    expect(角色查询计数(查询记录, 被处置编号)).toBe(1);
    const ip封 = await request(应用).post('/api/guan-li/feng-jin').set(头).send({ ip: '10.1.2.3', yuan_yin: 'fan-zuo-bi' });
    expect(ip封.status).toBe(201);
    expect(await 按用户编号取角色(测试用户编号, 自备.池)).toBe('chao_guan');
    expect(await 按用户编号取角色(被处置编号, 自备.池)).toBe('chao_guan');
    expect(角色查询计数(查询记录, 测试用户编号), 'IP 封禁不改任何人的角色旗标，不得触发全量失效').toBe(1);
    expect(角色查询计数(查询记录, 被处置编号)).toBe(1);
    const 号封 = await request(应用).post('/api/guan-li/feng-jin').set(头).send({ yong_hu_id: 被处置编号, yuan_yin: 'fan-zuo-bi' });
    expect(号封.status).toBe(201);
    await 按用户编号取角色(被处置编号, 自备.池);
    expect(角色查询计数(查询记录, 被处置编号), '被处置账号须立即回查库').toBe(2);
    expect(角色查询计数(查询记录, 测试用户编号), '无关账号的缓存不得被连带清掉').toBe(1);
    清空管理员缓存();
  });

  it('广播发布失败不抛错且本地失效仍然生效', async () => {
    const 自备 = 创建模拟池((文本) => {
      if (文本.includes('SELECT "管理员"')) return [角色旗标.chao_guan];
      return 默认行(文本);
    });
    const 坏缓存 = 创建模拟缓存().缓存;
    坏缓存.publish = async (): Promise<unknown> => {
      throw new Error('redis_unreachable');
    };
    清空管理员缓存();
    expect(await 按用户编号取角色(测试用户编号, 自备.池)).toBe('chao_guan');
    await expect(广播管理员失效(坏缓存 as never, 测试用户编号)).resolves.toBeUndefined();
    expect(await 按用户编号取角色(测试用户编号, 自备.池)).toBe('chao_guan');
    expect(角色查询计数(自备.查询记录, 测试用户编号)).toBe(2);
    清空管理员缓存();
  });

  it('角色缓存有规模上限，异常编号刷不出无界内存', async () => {
    const 自备 = 创建模拟池((文本) => {
      if (文本.includes('SELECT "管理员"')) return [角色旗标.yun_ying];
      return 默认行(文本);
    });
    清空管理员缓存();
    for (let 序号 = 0; 序号 < 5001; 序号 += 1) {
      expect(await 按用户编号取角色(`bian-hao-${序号}`, 自备.池)).toBe('yun_ying');
    }
    const 全量查询数 = 角色查询计数(自备.查询记录, 'bian-hao-0');
    expect(await 按用户编号取角色('bian-hao-0', 自备.池)).toBe('yun_ying');
    expect(角色查询计数(自备.查询记录, 'bian-hao-0'), '触顶后早期条目应被挤出，而非无界堆积').toBe(全量查询数 + 1);
    清空管理员缓存();
  });
});

describe('YH-108 授予回收角色列口径', () => {
  function 超管应用() {
    const 自备 = 创建模拟池((文本) => {
      if (文本.includes('SELECT "管理员"')) return [角色旗标.chao_guan];
      return 默认行(文本);
    });
    const 建 = 创建测试应用({ 池: 自备.池, 写上限: 200 });
    return { ...建, 头: 授权头(签发管理令牌({ yongHuId: '55555555-5555-4555-8555-555555555555' })) };
  }

  it('jiao_se 三值分别命中对应旗标列，缺省仍按超管列', async () => {
    const 期望列: Record<GuanLiJiaoSe, string> = { chao_guan: '"管理员"', yun_ying: '"运营"', shen_he_yuan: '"审核员"' };
    for (const 角色 of ['chao_guan', 'yun_ying', 'shen_he_yuan'] as GuanLiJiaoSe[]) {
      const { 应用, 头, 查询记录 } = 超管应用();
      const 授 = await request(应用).post('/api/guan-li/shou-quan').set(头).send({ yong_hu_id: 测试用户编号, jiao_se: 角色, que_ren: true });
      expect(授.status).toBe(200);
      expect(查询记录.some((项) => 项.文本.startsWith('UPDATE "用户" SET ') && 项.文本.includes(`SET ${期望列[角色]} = TRUE`))).toBe(true);
      const 收 = await request(应用).post('/api/guan-li/hui-shou').set(头).send({ yong_hu_id: 测试用户编号, jiao_se: 角色, que_ren: true });
      expect(收.status).toBe(200);
      expect(查询记录.some((项) => 项.文本.startsWith('UPDATE "用户" SET ') && 项.文本.includes(`SET ${期望列[角色]} = FALSE`))).toBe(true);
      查询记录.length = 0;
      const 缺省 = await request(应用).post('/api/guan-li/shou-quan').set(头).send({ yong_hu_id: 测试用户编号, que_ren: true });
      expect(缺省.status).toBe(200);
      expect(查询记录.some((项) => 项.文本.includes('SET "管理员" = TRUE'))).toBe(true);
    }
  });

  it('非法角色值400且不落任何UPDATE', async () => {
    const { 应用, 头, 查询记录 } = 超管应用();
    const 响应 = await request(应用).post('/api/guan-li/shou-quan').set(头).send({ yong_hu_id: 测试用户编号, jiao_se: 'zhi_dai_wei', que_ren: true });
    expect(响应.status).toBe(400);
    expect(响应.body.cuo_wu_ma).toBe('CAN_SHU_CUO_WU');
    expect(查询记录.some((项) => 项.文本.startsWith('UPDATE "用户"'))).toBe(false);
  });

  it('SQL注入型角色值被白名单拒绝', async () => {
    const { 应用, 头, 查询记录 } = 超管应用();
    const 响应 = await request(应用)
      .post('/api/guan-li/shou-quan')
      .set(头)
      .send({ yong_hu_id: 测试用户编号, jiao_se: '管理员"; DROP TABLE "用户" --', que_ren: true });
    expect(响应.status).toBe(400);
    expect(查询记录.some((项) => 项.文本.startsWith('UPDATE "用户"'))).toBe(false);
  });

  it('回收角色后吊销既有会话，运营身份也不能绕过', async () => {
    const 自备 = 创建模拟池((文本) => {
      if (文本.includes('SELECT "管理员"')) return [角色旗标.yun_ying];
      return 默认行(文本);
    });
    const { 应用, 缓存表 } = 创建测试应用({ 池: 自备.池, 写上限: 200 });
    const 头 = 授权头(签发管理令牌());
    const 收 = await request(应用).post('/api/guan-li/hui-shou').set(头).send({ yong_hu_id: 测试用户编号, jiao_se: 'yun_ying', que_ren: true });
    expect(收.status).toBe(403);
    expect(缓存表.has(`jwt_yong_hu_cheXiao:${测试用户编号}`)).toBe(false);
  });
});

describe('YH-108 前端消费点与角色能力矩阵同源', () => {
  // 两个构建产物无法共享源码，前端白名单与后端矩阵的同源只能靠直读对端源文件断言把守
  // （与 和我恋爱吧 frontend/src/__tests__/性别口径.test.ts 同一手法）。改任一侧必须两侧同改。
  const 前端根 = path.resolve(__dirname, '../../../管理前端/src');
  function 读前端(相对路径: string): string {
    const 完整 = path.join(前端根, 相对路径);
    if (!fs.existsSync(完整)) {
      throw new Error(`管理前端源文件缺失，同源断言无法执行: ${完整}`);
    }
    return fs.readFileSync(完整, 'utf8');
  }
  function 取字符串清单(源: string, 声明: string): string[] {
    const 命中 = new RegExp(String.raw`const ${声明}[^=]*= \[([^\]]*)\]`).exec(源);
    if (!命中) {
      throw new Error(`管理前端源里找不到 ${声明} 的清单`);
    }
    return [...命中[1].matchAll(/'([^']*)'/g)].map((项) => 项[1]);
  }

  const 存储源 = 读前端('stores/登录.ts');
  const 前端角色清单 = 取字符串清单(存储源, '角色白名单');
  const 前端能力清单 = 取字符串清单(存储源, '能力白名单');
  const 矩阵能力全集 = [...new Set(管理角色清单.flatMap((角色) => [...角色能力矩阵[角色]]))];

  it('前端角色白名单逐项等于后端矩阵角色键，能力白名单等于矩阵能力全集', () => {
    expect(前端角色清单).toEqual([...管理角色清单]);
    expect(前端能力清单.slice().sort()).toEqual(矩阵能力全集.slice().sort());
    expect(矩阵能力全集.slice().sort()).toEqual(['cha_kan', 'feng_jin', 'feng_jin_shen_he', 'gao_we', 'tong_ji_xie']);
  });

  // FP-17：菜单条目的条目→能力映射与矩阵同源（统计图表已改挂 tong_ji_xie，审核员不再见统计入口）
  it('菜单条目与后端矩阵逐条同源：账号/聊天/思考/封禁/审计/审核=cha_kan，统计=tong_ji_xie', () => {
    const 外壳源 = 读前端('App.vue');
    const 条目 = [...外壳源.matchAll(/路径: '([^']+)'[^}]*?需能力: '([^']+)'/g)].map((匹配) => ({ 路径: 匹配[1], 能力: 匹配[2] }));
    expect(条目.length).toBeGreaterThanOrEqual(7);
    const 期望映射: Record<string, string> = {
      '/zhang-hao': 'cha_kan',
      '/liao-tian': 'cha_kan',
      '/si-kao-lian': 'cha_kan',
      '/feng-jin': 'cha_kan',
      '/shen-ji': 'cha_kan',
      '/tong-ji': 'tong_ji_xie',
      '/shen-he': 'cha_kan',
    };
    for (const 项 of 条目) {
      expect(期望映射[项.路径], `菜单条目 ${项.路径} 未在守卫映射表内`).toBe(项.能力);
      expect(角色能力矩阵.chao_guan.includes(项.能力 as GuanLiNengLi), `菜单能力位 ${项.能力} 超管未持有`).toBe(true);
    }
    for (const 角色 of ['yun_ying', 'shen_he_yuan'] as GuanLiJiaoSe[]) {
      const 可见 = 条目.filter((项) => 取角色能力(角色).includes(项.能力 as GuanLiNengLi)).map((项) => 项.路径);
      const 统计可见 = 可见.includes('/tong-ji');
      expect(统计可见, `${角色} 的统计菜单可见性必须等于其持有 tong_ji_xie`).toBe(取角色能力(角色).includes('tong_ji_xie'));
    }
  });

  it('菜单条目按矩阵能力位声明，不存在矩阵里没有的能力位也没有全员不可见的死条目', () => {
    const 外壳源 = 读前端('App.vue');
    const 条目 = [...外壳源.matchAll(/需能力: '([^']+)'/g)].map((匹配) => 匹配[1]);
    expect(条目.length).toBeGreaterThanOrEqual(7);
    for (const 能力 of 条目) {
      expect(矩阵能力全集, `菜单条目的能力位 ${能力} 不在后端矩阵里`).toContain(能力);
      expect(管理角色清单.some((角色) => 取角色能力(角色).includes(能力 as GuanLiNengLi)), `能力位 ${能力} 无人可得`).toBe(true);
    }
  });

  it('前端高危入口全部按可高危隐藏，缺该能力的角色拿不到按钮', () => {
    const 列表源 = 读前端('views/账号列表.vue');
    const 高危入口 = ['shou-yu-an-niu', 'hui-shou-an-niu', 'jie-guan-an-niu', 'jie-shu-jie-guan-an-niu'];
    expect(高危入口).toContain('jie-shu-jie-guan-an-niu');
    for (const 标识 of 高危入口) {
      const 位置 = 列表源.indexOf(`data-testid="${标识}"`);
      expect(位置, `账号列表缺少高危入口 ${标识}`).toBeGreaterThan(-1);
      expect(列表源.slice(Math.max(0, 位置 - 260), 位置), `${标识} 未挂可高危隐藏`).toContain('v-if="登录仓库.可高危"');
    }
    expect(取角色能力('yun_ying').includes('gao_we')).toBe(false);
    expect(取角色能力('shen_he_yuan').includes('gao_we')).toBe(false);
  });
});
