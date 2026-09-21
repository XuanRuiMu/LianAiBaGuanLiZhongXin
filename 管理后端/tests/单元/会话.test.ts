import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { 创建测试应用, 创建模拟池, 测试用户编号, 签发管理令牌, 授权头 } from './测试辅助';
import { 当前配置, 折算时长秒, 默认访问令牌秒 } from '../../src/配置';
import {
  访问令牌Cookie名,
  刷新令牌Cookie名,
  令牌黑名单前缀,
  按用户吊销前缀,
  持久会话缓存前缀,
  刷新令牌缓存前缀,
} from '../../src/会话';

const 登录路径 = '/api/guan-li/deng-lu';
const 刷新路径 = '/api/guan-li/shua-xin';
const 登出路径 = '/api/guan-li/tui-chu';
const 受保护路径 = '/api/guan-li/zhang-hao-lie-biao';
const 口令 = 'mi-ma-123';

function 超管池() {
  const 哈希 = bcrypt.hashSync(口令, 4);
  return 创建模拟池((文本) => {
    if (文本.includes('SELECT "管理员"')) return [{ 管理员: true, 运营: false, 审核员: false }];
    if (文本.includes('FROM "用户" WHERE "手机号"')) {
      return [{ ID: 测试用户编号, 手机号: '13800000000', 用户名: 'ce-shi', 密码哈希: 哈希, 管理员: true }];
    }
    return [{ ID: 测试用户编号 }];
  });
}

function 曲奇段(响应: request.Response, 名: string): string | undefined {
  const 条目 = (响应.headers['set-cookie'] as unknown as string[] | undefined) ?? [];
  return 条目.find((项) => 项.startsWith(`${名}=`));
}

function 曲奇头(响应: request.Response): string {
  return ((响应.headers['set-cookie'] as unknown as string[]) ?? []).map((项) => 项.split(';')[0]).join('; ');
}

async function 登录(正文: Record<string, unknown> = {}) {
  const 自备 = 超管池();
  const 建 = 创建测试应用({ 池: 自备.池 });
  const 响应 = await request(建.应用).post(登录路径).send({ shou_ji_hao: '13800000000', mi_ma: 口令, ...正文 });
  return { ...建, 响应 };
}

function 刷新编号(响应: request.Response): string {
  const 项 = 曲奇段(响应, 'guan_li_shua_xin');
  return decodeURIComponent(String(项).split(';')[0].split('=')[1] ?? '');
}

describe('FP-03 访问令牌有效期折算', () => {
  it('JWT_EXPIRES_IN 各种写法折算为秒，非法值回落默认档', () => {
    expect(折算时长秒('15m', 默认访问令牌秒)).toBe(900);
    expect(折算时长秒('3600', 默认访问令牌秒)).toBe(3600);
    expect(折算时长秒('1h', 默认访问令牌秒)).toBe(3600);
    expect(折算时长秒('7d', 默认访问令牌秒)).toBe(604800);
    expect(折算时长秒('0', 默认访问令牌秒)).toBe(默认访问令牌秒);
    expect(折算时长秒('十五分钟', 默认访问令牌秒)).toBe(默认访问令牌秒);
    expect(折算时长秒('', 默认访问令牌秒)).toBe(默认访问令牌秒);
  });

  it('Cookie Max-Age 与 JWT_EXPIRES_IN 同源，不再写死 15 分钟', async () => {
    const 旧值 = process.env.JWT_EXPIRES_IN;
    process.env.JWT_EXPIRES_IN = '1h';
    try {
      expect(当前配置().访问令牌有效秒).toBe(3600);
      const { 响应 } = await 登录();
      expect(Number.parseInt(/Max-Age=(\d+)/.exec(String(曲奇段(响应, 'guan_li_ling_pai')))?.[1] ?? '0', 10)).toBe(3600);
    } finally {
      if (旧值 === undefined) delete process.env.JWT_EXPIRES_IN;
      else process.env.JWT_EXPIRES_IN = 旧值;
    }
  });
});

describe('FP-03 记住密码决定刷新 Cookie 的持久性', () => {
  it('持久会话（chi_jiu_hui_hua=true）刷新 Cookie 带 Max-Age，并登记持久标记', async () => {
    const { 响应, 缓存表 } = await 登录({ chi_jiu_hui_hua: true });
    expect(响应.status).toBe(200);
    const 刷新 = 曲奇段(响应, 'guan_li_shua_xin');
    expect(String(刷新)).toContain(`Max-Age=${当前配置().刷新有效秒}`);
    expect(缓存表.get(`${持久会话缓存前缀}${刷新编号(响应)}`)).toBe('1');
  });

  it('会话级（缺省）刷新 Cookie 不带 Max-Age，也不登记持久标记', async () => {
    const { 响应, 缓存表 } = await 登录();
    const 刷新 = 曲奇段(响应, 'guan_li_shua_xin');
    expect(刷新).toBeDefined();
    expect(String(刷新)).not.toMatch(/Max-Age=/);
    expect(缓存表.has(`${持久会话缓存前缀}${刷新编号(响应)}`)).toBe(false);
  });

  const 非法持久值 = ['true', '1', 1, 0, null, undefined, {}, [], false, 'chi_jiu'];
  it.each(非法持久值)('非法持久入参 %p 一律按会话级处理且不报 400', async (值) => {
    const { 响应 } = await 登录({ chi_jiu_hui_hua: 值 });
    expect(响应.status).toBe(200);
    expect(String(曲奇段(响应, 'guan_li_shua_xin'))).not.toMatch(/Max-Age=/);
  });

  it('持久位线路键唯一真源：只认 chi_jiu_hui_hua，驼峰/字符串/数字等其它形态一律会话级', async () => {
    for (const 变体 of [
      { chiJiuHuiHua: true },
      { chi_jiu_hui_hua: 'true' },
      { chi_jiu_hui_hua: 1 },
      { chiJiuHuiHua: true, chi_jiu_hui_hua: 'true' },
    ]) {
      const { 响应, 缓存表 } = await 登录(变体);
      expect(响应.status).toBe(200);
      expect(String(曲奇段(响应, 'guan_li_shua_xin'))).not.toMatch(/Max-Age=/);
      expect(缓存表.has(`${持久会话缓存前缀}${刷新编号(响应)}`)).toBe(false);
    }
  });

  it('双 Cookie 的 HttpOnly/Secure/SameSite/Path 口径不因持久化而漂移', async () => {
    const { 响应 } = await 登录({ chi_jiu_hui_hua: true });
    const 访问 = String(曲奇段(响应, 'guan_li_ling_pai'));
    const 刷新 = String(曲奇段(响应, 'guan_li_shua_xin'));
    for (const 项 of [访问, 刷新]) {
      expect(项).toContain('HttpOnly');
      expect(项).toContain('Secure');
      expect(项).toContain('SameSite=Strict');
    }
    expect(访问).toContain('Path=/api/guan-li;');
    expect(刷新).toContain('Path=/api/guan-li/shua-xin;');
  });
});

describe('FP-03 续期保持登录时定下的持久档', () => {
  it('持久登录续期后仍是持久 Cookie，旧号的持久标记随旧号一并删除', async () => {
    const 入 = await 登录({ chi_jiu_hui_hua: true });
    const 旧号 = 刷新编号(入.响应);
    const 轮换 = await request(入.应用)
      .post(刷新路径)
      .set('Cookie', 曲奇头(入.响应))
      .send({});
    expect(轮换.status).toBe(200);
    expect(String(曲奇段(轮换, 'guan_li_shua_xin'))).toContain(`Max-Age=${当前配置().刷新有效秒}`);
    expect(入.缓存表.has(`${持久会话缓存前缀}${旧号}`)).toBe(false);
    expect(入.缓存表.get(`${持久会话缓存前缀}${刷新编号(轮换)}`)).toBe('1');
  });

  it('会话级登录续期后仍是会话级 Cookie', async () => {
    const 入 = await 登录();
    const 轮换 = await request(入.应用).post(刷新路径).set('Cookie', 曲奇头(入.响应)).send({});
    expect(轮换.status).toBe(200);
    expect(String(曲奇段(轮换, 'guan_li_shua_xin'))).not.toMatch(/Max-Age=/);
  });

  it('并发续期第二次必失败，说明单飞必须在调用方成立', async () => {
    const 入 = await 登录({ chi_jiu_hui_hua: true });
    const 头 = 曲奇头(入.响应);
    const 两发 = await Promise.all([
      request(入.应用).post(刷新路径).set('Cookie', 头).send({}),
      request(入.应用).post(刷新路径).set('Cookie', 头).send({}),
    ]);
    const 状态 = 两发.map((项) => 项.status).sort();
    expect(状态).toEqual([200, 401]);
  });
});

describe('FP-03 服务端注销吊销凭证', () => {
  it('注销返回成功并同时清发双 Cookie', async () => {
    const 入 = await 登录({ chi_jiu_hui_hua: true });
    const 注销 = await request(入.应用).post(登出路径).set('Cookie', 曲奇头(入.响应)).send({});
    expect(注销.status).toBe(200);
    expect(注销.body).toEqual({ cheng_gong: true, shu_ju: { yi_tui_chu: true } });
    const 访问 = String(曲奇段(注销, 'guan_li_ling_pai'));
    const 刷新 = String(曲奇段(注销, 'guan_li_shua_xin'));
    expect(访问).toContain('guan_li_ling_pai=;');
    expect(刷新).toContain('guan_li_shua_xin=;');
    expect(访问).toContain('Expires=Thu, 01 Jan 1970');
    expect(访问).toContain('Path=/api/guan-li;');
    expect(刷新).toContain('Path=/api/guan-li/shua-xin;');
  });

  it('注销后同一双 Cookie 回访受保护端点为 401 且走登录失效码', async () => {
    const 入 = await 登录({ chi_jiu_hui_hua: true });
    const 头 = 曲奇头(入.响应);
    const 注销 = await request(入.应用).post(登出路径).set('Cookie', 头).send({});
    expect(注销.status).toBe(200);
    const 回访 = await request(入.应用).get(受保护路径).set('Cookie', 头);
    expect(回访.status).toBe(401);
    expect(回访.body.cuo_wu_ma).toBe('LING_PAI_WU_XIAO');
  });

  it('注销后旧刷新号不能再签新票', async () => {
    const 入 = await 登录({ chi_jiu_hui_hua: true });
    const 旧号 = 刷新编号(入.响应);
    await request(入.应用).post(登出路径).set('Cookie', 曲奇头(入.响应)).send({});
    const 续 = await request(入.应用).post(刷新路径).send({ shua_xin_ling_pai: 旧号 });
    expect(续.status).toBe(401);
    expect(续.body.cuo_wu_ma).toBe('LING_PAI_WU_XIAO');
  });

  it('注销写入 jti 黑名单，键与认证读取侧同源', async () => {
    const 入 = await 登录();
    const 头 = 曲奇头(入.响应);
    const 注销 = await request(入.应用).post(登出路径).set('Cookie', 头).send({});
    expect(注销.status).toBe(200);
    const 命中 = [...入.缓存表.keys()].filter((键) => 键.startsWith(令牌黑名单前缀));
    expect(命中.length).toBe(1);
    expect(入.缓存表.get(命中[0])).toBe('1');
  });

  it('重复注销为 401 而不是 500，且不产生任何吊销写入', async () => {
    const 入 = await 登录({ chi_jiu_hui_hua: true });
    const 头 = 曲奇头(入.响应);
    expect((await request(入.应用).post(登出路径).set('Cookie', 头).send({})).status).toBe(200);
    const 二次 = await request(入.应用).post(登出路径).set('Cookie', 头).send({});
    expect(二次.status).toBe(401);
    expect(二次.body.cuo_wu_ma).toBe('LING_PAI_WU_XIAO');
    expect(二次.body.cheng_gong).toBe(false);
  });

  it('无凭证注销走未授权口径，不崩服务', async () => {
    const 入 = await 登录();
    const 无凭证 = await request(入.应用).post(登出路径).send({});
    expect(无凭证.status).toBe(401);
    expect(无凭证.body.cuo_wu_ma).toBe('WEI_SHOU_QUAN');
  });

  it('注销只吊销本次令牌，不动该账号的其它会话（不写按用户吊销键）', async () => {
    const 入 = await 登录({ chi_jiu_hui_hua: true });
    const 注销 = await request(入.应用).post(登出路径).set('Cookie', 曲奇头(入.响应)).send({});
    expect(注销.status).toBe(200);
    expect([...入.缓存表.keys()].some((键) => 键.startsWith('jwt_yong_hu_cheXiao:'))).toBe(false);
  });

  it('吊销写入失败时返回缓存不可用码且仍已清发 Cookie', async () => {
    const 自备 = 超管池();
    const 正常 = 创建测试应用({ 池: 自备.池 });
    const 登录响应 = await request(正常.应用).post(登录路径).send({ shou_ji_hao: '13800000000', mi_ma: 口令 });
    expect(登录响应.status).toBe(200);
    const 头 = 曲奇头(登录响应);
    const { 池 } = 超管池();
    // 只让黑名单写入失败，限流计数仍可用，才能把故障点钉在注销自身的吊销步骤上
    const 坏缓存 = {
      get: async (键: string) => 正常.缓存表.get(键) ?? null,
      set: async (键: string): Promise<unknown> => {
        if (键.startsWith(令牌黑名单前缀)) {
          throw new Error('cachedown');
        }
        return 'OK';
      },
      del: async (): Promise<unknown> => 'OK',
      publish: async (): Promise<unknown> => 1,
      subscribe: async (): Promise<() => void> => () => undefined,
    };
    const 建 = 创建测试应用({ 池, 缓存: 坏缓存 });
    const 注销 = await request(建.应用).post(登出路径).set('Cookie', 头).send({});
    expect(注销.status).toBe(500);
    expect(注销.body.cuo_wu_ma).toBe('HUAN_CUN_BU_KE_YONG');
    expect(String(曲奇段(注销, 'guan_li_ling_pai'))).toContain('guan_li_ling_pai=;');
  });

  it('注销与只读路由同层受管理员门禁：非管理员令牌 403', async () => {
    const 无角色池 = 创建模拟池((文本) => {
      if (文本.includes('SELECT "管理员"')) return [{ 管理员: false, 运营: false, 审核员: false }];
      return [{ ID: 测试用户编号 }];
    });
    const { 应用 } = 创建测试应用({ 池: 无角色池.池 });
    const 注销 = await request(应用).post(登出路径).set(授权头(签发管理令牌())).send({});
    expect(注销.status).toBe(403);
    expect(注销.body.cuo_wu_ma).toBe('WU_GUAN_LI_QUAN_XIAN');
  });
});

describe('FP-03 刷新号缓存键前缀单源', () => {
  it('登录写入的刷新号键与注销删除的键同前缀', async () => {
    const { 响应, 缓存表 } = await 登录();
    const 键清单 = [...缓存表.keys()].filter((键) => 键.startsWith(刷新令牌缓存前缀));
    expect(键清单).toEqual([`${刷新令牌缓存前缀}${刷新编号(响应)}`]);
  });
});

describe('FP-07 会话线路键与缓存前缀单源', () => {
  const 单源字面量 = [
    访问令牌Cookie名,
    刷新令牌Cookie名,
    令牌黑名单前缀,
    按用户吊销前缀,
    持久会话缓存前缀,
    刷新令牌缓存前缀,
  ];
  const 真源文件 = 'src/会话.ts';

  function 判定(相对: string, 源: string): string[] {
    if (相对 === 真源文件) {
      return [];
    }
    return 单源字面量.filter((字面) => 源.includes(`'${字面}'`)).map((字面) => `${相对}:${字面}`);
  }

  function 扫描面(): string[] {
    const 根 = path.resolve(__dirname, '../..');
    const 命中: string[] = [];
    for (const 项 of fs.readdirSync(path.join(根, 'src'), { recursive: true, withFileTypes: true })) {
      if (!项.isFile() || !项.name.endsWith('.ts')) continue;
      const 全 = path.join(项.parentPath, 项.name);
      命中.push(...判定(path.relative(根, 全).replace(/\\/g, '/'), fs.readFileSync(全, 'utf8')));
    }
    return 命中;
  }

  it('六枚会话线路键/前缀的字面量只出现在 会话.ts，其它文件必须引常量', () => {
    expect(扫描面()).toEqual([]);
  });

  it('反证：别处再抄一份前缀字面量必须判红，守卫不空跑', () => {
    expect(判定('src/路由/示例.ts', `await 缓存.set(\`'${按用户吊销前缀}'\${用户编号}\`);`)).toEqual([
      `src/路由/示例.ts:${按用户吊销前缀}`,
    ]);
    expect(判定(真源文件, `export const 按用户吊销前缀 = '${按用户吊销前缀}';`)).toEqual([]);
    expect(fs.readFileSync(path.resolve(__dirname, '../../src/路由/封禁.ts'), 'utf8')).toContain(
      '按用户吊销前缀',
    );
  });

});
