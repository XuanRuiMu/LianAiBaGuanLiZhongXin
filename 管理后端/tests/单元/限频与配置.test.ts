import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { 创建测试应用, 签发管理令牌, 授权头 } from './测试辅助';
import { 当前配置 } from '../../src/配置';

const 列表路径 = '/api/guan-li/zhang-hao-lie-biao';
const 写入路径 = '/api/guan-li/feng-jin';

describe('限频与热重载', () => {
  it('读接口超限返回429与限流码', async () => {
    const { 应用 } = 创建测试应用({ 读上限: 2 });
    const 头 = 授权头(签发管理令牌());
    expect((await request(应用).get(列表路径).set(头)).status).toBe(200);
    expect((await request(应用).get(列表路径).set(头)).status).toBe(200);
    const 超限 = await request(应用).get(列表路径).set(头);
    expect(超限.status).toBe(429);
    expect(超限.body.cuo_wu_ma).toBe('XIAN_LIU');
    expect(超限.body.ti_shi).toMatch(/[\u4e00-\u9fa5]/);
  });

  it('写接口超限返回429', async () => {
    const { 应用 } = 创建测试应用({ 写上限: 1 });
    const 头 = 授权头(签发管理令牌());
    const 正文 = { ip: '1.2.3.4', yuan_yin: '测试' };
    expect((await request(应用).post(写入路径).set(头).send(正文)).status).toBe(201);
    expect((await request(应用).post(写入路径).set(头).send(正文)).status).toBe(429);
  });

  it('分页上限热重载无重启生效', async () => {
    const 旧值 = process.env.FENYE_SHANG_XIAN;
    process.env.FENYE_SHANG_XIAN = '5';
    try {
      expect(当前配置().每页上限).toBe(5);
      const { 应用 } = 创建测试应用();
      const 响应 = await request(应用)
        .get('/api/guan-li/shen-ji-ri-zhi?mei_ye_tiao_shu=9999')
        .set(授权头(签发管理令牌()));
      expect(响应.body.fen_ye.mei_ye_tiao_shu).toBe(5);
    } finally {
      if (旧值 === undefined) delete process.env.FENYE_SHANG_XIAN;
      else process.env.FENYE_SHANG_XIAN = 旧值;
    }
    expect(当前配置().每页上限).toBe(100);
  });

  it('密钥不在热重载键内生产绝不热重载', async () => {
    const { 启动环境监听 } = await import('../../src/配置');
    expect(typeof 启动环境监听).toBe('function');
    const 旧密钥 = String(process.env.JWT_SECRET);
    const 令牌 = 签发管理令牌();
    process.env.JWT_SECRET = 'lun-huan-hou-de-32-zi-jie-xin-mi-yao-abcdef';
    try {
      const { 应用 } = 创建测试应用();
      const 响应 = await request(应用).get(列表路径).set(授权头(令牌));
      expect(响应.status).toBe(401);
    } finally {
      process.env.JWT_SECRET = 旧密钥;
    }
  });

  it('代理目标缺失启动校验拦截', async () => {
    const { 校验启动配置, 当前配置 } = await import('../../src/配置');
    const 旧值 = process.env.VITE_API_PROXY_TARGET;
    const 旧兼容 = process.env.DAI_LI_MU_BIAO;
    delete process.env.VITE_API_PROXY_TARGET;
    delete process.env.DAI_LI_MU_BIAO;
    try {
      expect(校验启动配置(当前配置())).toContain('VITE_API_PROXY_TARGET(代理目标须显式配置)');
    } finally {
      if (旧值 !== undefined) process.env.VITE_API_PROXY_TARGET = 旧值;
      if (旧兼容 !== undefined) process.env.DAI_LI_MU_BIAO = 旧兼容;
    }
  });
});
