import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { 创建测试应用, 签发管理令牌, 授权头 } from './测试辅助';

const 列表路径 = '/api/guan-li/feng-jin-ji-lu';
const 写入路径 = '/api/guan-li/feng-jin';

describe('封禁接口', () => {
  it('封禁记录列表返回200', async () => {
    const { 应用 } = 创建测试应用();
    const 响应 = await request(应用).get(列表路径).set(授权头(签发管理令牌()));
    expect(响应.status).toBe(200);
    expect(响应.body.cheng_gong).toBe(true);
  });

  it('封禁写入缺原因返回400', async () => {
    const { 应用 } = 创建测试应用();
    const 响应 = await request(应用)
      .post(写入路径)
      .set(授权头(签发管理令牌()))
      .send({ yong_hu_id: '22222222-2222-4222-8222-222222222222' });
    expect(响应.status).toBe(400);
  });

  it('封禁写入无目标返回400', async () => {
    const { 应用 } = 创建测试应用();
    const 响应 = await request(应用)
      .post(写入路径)
      .set(授权头(签发管理令牌()))
      .send({ yuan_yin: '测试违规' });
    expect(响应.status).toBe(400);
  });

  it('封禁写入非法级别与严重程度返回400', async () => {
    const { 应用 } = 创建测试应用();
    const 头 = 授权头(签发管理令牌());
    const 非法级别 = await request(应用)
      .post(写入路径)
      .set(头)
      .send({ yong_hu_id: '22222222-2222-4222-8222-222222222222', yuan_yin: '测试', ji_bie: 'chao-ji-feng' });
    expect(非法级别.status).toBe(400);
    const 非法程度 = await request(应用)
      .post(写入路径)
      .set(头)
      .send({ ip: '1.2.3.4', yuan_yin: '测试', yan_zhong_cheng_du: '毁灭' });
    expect(非法程度.status).toBe(400);
  });

  it('用户维度封禁写入账号封禁并全部参数化', async () => {
    const { 应用, 查询记录 } = 创建测试应用();
    const 响应 = await request(应用)
      .post(写入路径)
      .set(授权头(签发管理令牌()))
      .send({ yong_hu_id: '22222222-2222-4222-8222-222222222222', yuan_yin: 'ce-shi-wei-gui', ji_bie: 'feng_jin_1_tian' });
    expect(响应.status).toBe(201);
    expect(查询记录.some((记录) => 记录.文本.includes('INSERT INTO "审计日志"'))).toBe(true);
    expect(查询记录.some((记录) => 记录.文本.includes('INSERT INTO "账号封禁"'))).toBe(true);
    for (const 记录 of 查询记录) {
      expect(记录.文本).not.toContain('ce-shi-wei-gui');
    }
  });

  it('IP封禁写入封禁记录表', async () => {
    const { 应用, 查询记录 } = 创建测试应用();
    const 响应 = await request(应用)
      .post(写入路径)
      .set(授权头(签发管理令牌()))
      .send({ ip: '1.2.3.4', yuan_yin: '测试违规', yan_zhong_cheng_du: '严重' });
    expect(响应.status).toBe(201);
    expect(查询记录.some((记录) => 记录.文本.includes('INSERT INTO "封禁记录"'))).toBe(true);
  });
});
