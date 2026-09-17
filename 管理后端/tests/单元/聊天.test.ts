import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { 创建测试应用, 签发管理令牌, 授权头 } from './测试辅助';

const 消息路径 = '/api/guan-li/xiao-xi';
const 好友路径 = '/api/guan-li/hao-you-xiao-xi';

describe('聊天接口', () => {
  it('消息列表返回分页结构', async () => {
    const { 应用 } = 创建测试应用();
    const 响应 = await request(应用).get(消息路径).set(授权头(签发管理令牌()));
    expect(响应.status).toBe(200);
    expect(响应.body.cheng_gong).toBe(true);
    expect(响应.body.fen_ye.ye_ma).toBe(1);
  });

  it('发送方白名单逐项通过', async () => {
    const { 应用 } = 创建测试应用();
    for (const 发送方 of ['yonghu', 'jiaose', 'xitong']) {
      const 响应 = await request(应用).get(`${消息路径}?fa_song_fang=${发送方}`).set(授权头(签发管理令牌()));
      expect(响应.status).toBe(200);
    }
  });

  it('发送方非法返回400', async () => {
    const { 应用 } = 创建测试应用();
    const 响应 = await request(应用).get(`${消息路径}?fa_song_fang=hei-ke`).set(授权头(签发管理令牌()));
    expect(响应.status).toBe(400);
  });

  it('用户ID格式非法返回400', async () => {
    const { 应用 } = 创建测试应用();
    const 响应 = await request(应用).get(`${消息路径}?yong_hu_id=123`).set(授权头(签发管理令牌()));
    expect(响应.status).toBe(400);
  });

  it('时间格式非法与倒挂返回400', async () => {
    const { 应用 } = 创建测试应用();
    const 头 = 授权头(签发管理令牌());
    const 非法 = await request(应用).get(`${消息路径}?kai_shi_shi_jian=bu-shi-shi-jian`).set(头);
    expect(非法.status).toBe(400);
    const 倒挂 = await request(应用)
      .get(`${消息路径}?kai_shi_shi_jian=2026-09-02T00:00:00Z&jie_shu_shi_jian=2026-09-01T00:00:00Z`)
      .set(头);
    expect(倒挂.status).toBe(400);
  });

  it('排序字段非法返回400', async () => {
    const { 应用 } = 创建测试应用();
    const 响应 = await request(应用).get(`${消息路径}?pai_xu=mi-ma-ha-xi`).set(授权头(签发管理令牌()));
    expect(响应.status).toBe(400);
  });

  it('时间筛选参数化下发', async () => {
    const { 应用, 查询记录 } = 创建测试应用();
    const 响应 = await request(应用)
      .get(`${消息路径}?kai_shi_shi_jian=2026-09-01T00:00:00Z`)
      .set(授权头(签发管理令牌()));
    expect(响应.status).toBe(200);
    const 消息查询 = 查询记录.filter((记录) => 记录.文本.includes('FROM "消息"'));
    expect(消息查询.length).toBeGreaterThan(0);
    for (const 记录 of 消息查询) {
      expect(记录.文本).not.toContain('2026-09-01');
    }
  });

  it('好友消息列表与ID校验', async () => {
    const { 应用 } = 创建测试应用();
    const 头 = 授权头(签发管理令牌());
    const 正常 = await request(应用).get(好友路径).set(头);
    expect(正常.status).toBe(200);
    const 非法 = await request(应用).get(`${好友路径}?fa_song_zhe_id=xxx`).set(头);
    expect(非法.status).toBe(400);
  });
});
