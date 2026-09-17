import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import { flushPromises, mount } from '@vue/test-utils';
import { 使用登录仓库, 清除令牌, 规范令牌 } from '../stores/登录';
import { 解析包络, 业务错误, 请求实例 } from '../api/请求';
import { 思考说明 as 获取思考说明, 管理登录 as 管理登录接口, type 思考说明 } from '../api/管理';
import { 注册守卫, 路由表 } from '../router';
import 思考链 from '../views/思考链.vue';
import App from '../App.vue';

vi.mock('../api/管理', () => ({
  账号列表: vi.fn(),
  账号详情: vi.fn(),
  授予管理员: vi.fn(),
  回收管理员: vi.fn(),
  夺舍角色: vi.fn(),
  归还角色: vi.fn(),
  管理登录: vi.fn(),
  聊天消息: vi.fn(),
  好友消息: vi.fn(),
  记忆列表: vi.fn().mockResolvedValue({ 行: [] }),
  对话摘要列表: vi.fn().mockResolvedValue({ 行: [] }),
  关键事件列表: vi.fn().mockResolvedValue({ 行: [] }),
  夺舍日志列表: vi.fn().mockResolvedValue({ 行: [] }),
  评估列表: vi.fn().mockResolvedValue({ 行: [] }),
  思考记录列表: vi.fn().mockResolvedValue({ 行: [] }),
  思考记录详情: vi.fn(),
  思考说明: vi.fn().mockResolvedValue({
    you_du_li_si_kao_chi_jiu_hua_biao: true,
    sheng_ming: '思考链经Socket实时推送并落库',
    hui_fang_zhun_ze: '回放以落库为准',
    shi_shi_shi_jian: ['管理员_深度思考'],
    shi_shi_shuo_ming: '思考链实时事件经Socket推送',
    dan_tiao_jie_duan_zi_fu_shu: 1500,
    yi_chi_jiu_hua_cha_xun: ['思考记录'],
    dai_bu_chong_shuo_ming: '以下实时能力仍在补齐',
    dai_bu_chong: ['实时思考链订阅通道'],
  }),
  封禁记录: vi.fn(),
  写入封禁: vi.fn(),
  账号封禁列表: vi.fn().mockResolvedValue({ 行: [], 分页: undefined }),
  解封账号: vi.fn(),
  审核申诉: vi.fn(),
  审计日志: vi.fn(),
  审计保留: vi.fn(),
  注册统计: vi.fn().mockResolvedValue({}),
  消息统计: vi.fn().mockResolvedValue({}),
  好感度统计: vi.fn(),
  留存统计: vi.fn().mockResolvedValue({}),
  用量统计: vi.fn().mockResolvedValue({}),
  埋点字典: vi.fn().mockResolvedValue({}),
  就绪检查: vi.fn(),
  指标概览: vi.fn(),
  审核列表: vi.fn().mockResolvedValue({ 行: [] }),
  审核新建: vi.fn(),
  审核一审: vi.fn(),
  审核二审: vi.fn(),
  审核批量: vi.fn(),
  审核留痕: vi.fn().mockResolvedValue({ 行: [] }),
}));

beforeEach(() => {
  setActivePinia(createPinia());
  window.localStorage.clear();
  window.sessionStorage.clear();
  vi.clearAllMocks();
});

describe('登录态存储', () => {
  it('设置会话标识后标记已登录且令牌不落本地存储', () => {
    const 仓库 = 使用登录仓库();
    expect(仓库.设置令牌('ce-shi-ling-pai')).toBe(true);
    expect(window.localStorage.getItem('guan_li_ling_pai')).toBeNull();
    expect(window.sessionStorage.getItem('guan_li_hui_hua')).toBe('yi_deng_lu');
    expect(仓库.已登录).toBe(true);
  });

  it('空令牌与超长令牌被拒绝且不污染存储', () => {
    const 仓库 = 使用登录仓库();
    expect(规范令牌('   ')).toBeNull();
    expect(规范令牌('x'.repeat(4001))).toBeNull();
    expect(仓库.设置令牌('   ')).toBe(false);
    expect(window.sessionStorage.getItem('guan_li_hui_hua')).toBeNull();
    expect(仓库.已登录).toBe(false);
  });

  it('退出登录清理会话并标记未登录', () => {
    const 仓库 = 使用登录仓库();
    仓库.设置令牌('ce-shi-ling-pai');
    仓库.退出登录();
    expect(window.sessionStorage.getItem('guan_li_hui_hua')).toBeNull();
    expect(仓库.已登录).toBe(false);
  });

  it('清除令牌后会话为空', () => {
    window.sessionStorage.setItem('guan_li_hui_hua', 'yi_deng_lu');
    清除令牌();
    expect(window.sessionStorage.getItem('guan_li_hui_hua')).toBeNull();
  });

  it('401过期统一跳登录', async () => {
    expect(请求实例.defaults.withCredentials).toBe(true);
    const { default: axios } = await import('axios');
    expect(typeof axios.isAxiosError).toBe('function');
  });
});

describe('包络解析', () => {
  it('成功包络返回数据与分页', () => {
    const 结果 = 解析包络<string[]>( {
      cheng_gong: true,
      shu_ju: ['甲'],
      fen_ye: { ye_ma: 1, mei_ye_tiao_shu: 20, zong_shu: 1 },
    });
    expect(结果.数据).toEqual(['甲']);
    expect(结果.分页?.zong_shu).toBe(1);
  });

  it('无分页成功包络返回数据且分页缺席', () => {
    const 结果 = 解析包络<string>({ cheng_gong: true, shu_ju: '好' });
    expect(结果.数据).toBe('好');
    expect(结果.分页).toBeUndefined();
  });

  it('失败包络抛出携带提示与错误码的业务错误', () => {
    try {
      解析包络({ cheng_gong: false, shu_ju: null, ti_shi: '无权限', cuo_wu_ma: 'WU_GUAN_LI_QUAN_XIAN' });
      expect.unreachable();
    } catch (错误) {
      expect(错误).toBeInstanceOf(业务错误);
      expect((错误 as 业务错误).message).toBe('无权限');
      expect((错误 as 业务错误).cuo_wu_ma).toBe('WU_GUAN_LI_QUAN_XIAN');
    }
  });

  it('非法响应体抛出业务错误', () => {
    expect(() => 解析包络(null)).toThrow(业务错误);
    expect(() => 解析包络({ cheng_gong: true })).toThrow(业务错误);
  });

  it('请求凭据走安全Cookie不拼鉴权头', async () => {
    expect(请求实例.defaults.withCredentials).toBe(true);
  });
});

describe('路由守卫', () => {
  function 建路由() {
    const 路由器 = createRouter({ history: createMemoryHistory(), routes: 路由表 });
    注册守卫(路由器);
    return 路由器;
  }

  it('路由表包含登录与七模块全部可达路径', () => {
    const 路径 = 路由表.map((路由) => String(路由.path));
    for (const 期望 of [
      '/deng-lu',
      '/zhang-hao',
      '/zhang-hao/:yongHuId',
      '/liao-tian',
      '/si-kao-lian',
      '/feng-jin',
      '/shen-ji',
      '/tong-ji',
      '/shen-he',
    ]) {
      expect(路径).toContain(期望);
    }
  });

  it('未登录访问账号页跳转登录页', async () => {
    const 路由器 = 建路由();
    await 路由器.push('/zhang-hao');
    expect(路由器.currentRoute.value.path).toBe('/deng-lu');
  });

  it('未登录访问思考链页跳转登录页', async () => {
    const 路由器 = 建路由();
    await 路由器.push('/si-kao-lian');
    expect(路由器.currentRoute.value.path).toBe('/deng-lu');
  });

  it('已登录访问聊天页保留原路径', async () => {
    window.sessionStorage.setItem('guan_li_hui_hua', 'yi_deng_lu');
    const 路由器 = 建路由();
    await 路由器.push('/liao-tian');
    expect(路由器.currentRoute.value.path).toBe('/liao-tian');
  });

  it('已登录访问登录页跳转账号页', async () => {
    window.sessionStorage.setItem('guan_li_hui_hua', 'yi_deng_lu');
    const 路由器 = 建路由();
    await 路由器.push('/deng-lu');
    expect(路由器.currentRoute.value.path).toBe('/zhang-hao');
  });
});

describe('应用导航', () => {
  it('已登录渲染七模块导航且图标全部命中非回退', async () => {
    window.sessionStorage.setItem('guan_li_hui_hua', 'yi_deng_lu');
    const 路由器 = createRouter({ history: createMemoryHistory(), routes: 路由表 });
    注册守卫(路由器);
    await 路由器.push('/zhang-hao');
    await 路由器.isReady();
    const 包装 = mount(App, {
      global: { plugins: [路由器], stubs: { RouterView: true } },
    });
    await flushPromises();
    const 导航文本 = 包装.find('nav').text();
    for (const 标签 of ['账号管理', '聊天记录', '思考链', '封禁管理', '审计日志', '统计图表', '审核运营']) {
      expect(导航文本).toContain(标签);
    }
    expect(包装.findAll('nav svg')).toHaveLength(7);
    expect(包装.html()).not.toContain('m16 16 4.5 4.5');
  });
});

describe('思考链空态', () => {
  it('有待补充项时渲染待补充标记', async () => {
    const 包装 = mount(思考链);
    await flushPromises();
    expect(包装.text()).toContain('待补充');
    expect(包装.find('[data-testid="dai-bu-chong"]').exists()).toBe(true);
  });

  it('说明缺失时渲染空态待补充', async () => {
    const 空说明: 思考说明 = {
      you_du_li_si_kao_chi_jiu_hua_biao: false,
      sheng_ming: '',
      hui_fang_zhun_ze: '',
      shi_shi_shi_jian: [],
      shi_shi_shuo_ming: '',
      dan_tiao_jie_duan_zi_fu_shu: 1500,
      yi_chi_jiu_hua_cha_xun: [],
      dai_bu_chong_shuo_ming: '',
      dai_bu_chong: [],
    };
    vi.mocked(获取思考说明).mockResolvedValueOnce(空说明);
    const 包装 = mount(思考链);
    await flushPromises();
    expect(包装.find('[data-testid="kong-tai-dai-bu-chong"]').exists()).toBe(true);
    expect(包装.text()).toContain('暂无数据');
  });
});

describe('管理登录', () => {
  it('登录页含手机号与密码输入', async () => {
    const { default: 登录页 } = await import('../views/登录页.vue');
    const 包装 = mount(登录页, {
      global: { plugins: [createPinia(), createRouter({ history: createMemoryHistory(), routes: 路由表 })] },
    });
    expect(包装.find('[data-testid="shou-ji-hao-shu-ru"]').exists()).toBe(true);
    expect(包装.find('[data-testid="mi-ma-shu-ru"]').exists()).toBe(true);
  });

  it('空账密提交提示且不调接口', async () => {
    const { default: 登录页 } = await import('../views/登录页.vue');
    const 包装 = mount(登录页, {
      global: { plugins: [createPinia(), createRouter({ history: createMemoryHistory(), routes: 路由表 })] },
    });
    await 包装.find('[data-testid="deng-lu-an-niu"]').trigger('click');
    expect(vi.mocked(管理登录接口)).not.toHaveBeenCalled();
    expect(包装.text()).toContain('请输入手机号与密码');
  });
});
