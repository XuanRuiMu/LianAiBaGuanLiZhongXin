import { beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import { flushPromises, mount } from '@vue/test-utils';
import { 使用登录仓库, 清除令牌, 规范令牌, 规范角色, 规范能力 } from '../stores/登录';
import {
  解析包络,
  业务错误,
  请求实例,
  归一请求错误,
  取错误展示,
  传输错误,
} from '../api/请求';
import {
  思考说明 as 获取思考说明,
  封禁记录 as 封禁记录接口,
  账号封禁列表 as 账号封禁列表接口,
  管理登录 as 管理登录接口,
  账号列表 as 账号列表接口,
  我的身份 as 我的身份接口,
  type 思考说明,
} from '../api/管理';
import { 取管理角色文案, 管理角色选项 } from '../枚举映射';
import { 文案 } from '../文案/聚合';
import { 注册守卫, 路由表 } from '../router';
import 思考链 from '../views/思考链.vue';
import App from '../App.vue';

vi.mock('../api/管理', () => ({
  账号列表: vi.fn(),
  账号详情: vi.fn(),
  授予角色: vi.fn(),
  回收角色: vi.fn(),
  我的身份: vi.fn().mockResolvedValue({ yong_hu_id: 'yi', jiao_se: 'chao_guan', neng_li: ['cha_kan', 'feng_jin', 'feng_jin_shen_he', 'tong_ji_xie', 'gao_we'] }),
  接管角色: vi.fn(),
  结束接管: vi.fn(),
  管理登录: vi.fn(),
  刷新管理令牌: vi.fn().mockRejectedValue(new Error('wei-deng-lu')),
  管理登出: vi.fn().mockResolvedValue({ yi_tui_chu: true }),
  聊天消息: vi.fn(),
  好友消息: vi.fn(),
  记忆列表: vi.fn().mockResolvedValue({ 行: [] }),
  对话摘要列表: vi.fn().mockResolvedValue({ 行: [] }),
  关键事件列表: vi.fn().mockResolvedValue({ 行: [] }),
  接管记录列表: vi.fn().mockResolvedValue({ 行: [] }),
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
  审核初审: vi.fn(),
  审核复审: vi.fn(),
  审核多项处理: vi.fn(),
  处理记录列表: vi.fn().mockResolvedValue({ 行: [] }),
}));

const 线路说明符 = /from\s*['"]axios['"]|import\(['"]axios['"]\)/;

function axios引用清单(目录 = 'src', 命中: string[] = []): string[] {
  for (const 名 of fs.readdirSync(目录)) {
    const 全 = `${目录}/${名}`;
    if (fs.statSync(全).isDirectory()) {
      axios引用清单(全, 命中);
    } else if (/\.(ts|vue)$/.test(名) && 线路说明符.test(fs.readFileSync(全, 'utf8'))) {
      命中.push(全);
    }
  }
  return 命中;
}

/** 依赖回流的两条来路都在扫描面内：装依赖声明的 package.json 与锁死解析结果的 package-lock.json */
function 依赖回流清单(): string[] {
  const 命中: string[] = [];
  const 清单 = JSON.parse(fs.readFileSync('package.json', 'utf8')) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  for (const 表 of [清单.dependencies ?? {}, 清单.devDependencies ?? {}]) {
    命中.push(...Object.keys(表).filter((名) => /axios/i.test(名)).map((名) => `package.json:${名}`));
  }
  const 锁 = fs.readFileSync('package-lock.json', 'utf8');
  if (/axios/i.test(锁)) {
    命中.push('package-lock.json:存在 axios 条目');
  }
  return 命中;
}

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

  it('请求层零第三方 HTTP 依赖，错误归一三分流各按语义落地', () => {
    expect(axios引用清单()).toEqual([]);
    expect(依赖回流清单()).toEqual([]);
    const 未达 = 归一请求错误(new 传输错误('Failed to fetch', null, undefined, false));
    expect(取错误展示(未达)).toEqual({ 提示: 文案.通用.请求失败, 错误码: '' });
    const 过期 = 归一请求错误(new 传输错误('Request failed with status code 401', 401, '', false));
    expect(取错误展示(过期)).toEqual({ 提示: 文案.通用.登录过期, 错误码: '' });
    const 带包络 = 归一请求错误(
      new 传输错误(
        'Request failed with status code 403',
        403,
        { cheng_gong: false, shu_ju: null, ti_shi: '无管理身份，请联系超级管理员授予角色', cuo_wu_ma: 'WU_GUAN_LI_QUAN_XIAN' },
        false,
      ),
    );
    expect(取错误展示(带包络)).toEqual({ 提示: '无管理身份，请联系超级管理员授予角色', 错误码: 'WU_GUAN_LI_QUAN_XIAN' });
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
    const 记录: { 地址: string; 选项: RequestInit }[] = [];
    const 原请求函数 = globalThis.fetch;
    globalThis.fetch = (async (地址: string, 选项: RequestInit): Promise<Response> => {
      记录.push({ 地址, 选项 });
      return { ok: true, status: 200, text: async () => '{"cheng_gong":true,"shu_ju":null}' } as unknown as Response;
    }) as unknown as typeof fetch;
    try {
      await 请求实例.get('/api/jian-kang');
    } finally {
      globalThis.fetch = 原请求函数;
    }
    expect(记录).toHaveLength(1);
    expect(记录[0].选项.credentials).toBe('include');
    expect(记录[0].选项.headers).not.toHaveProperty('Authorization');
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
    const 七个模块标签 = [
      文案.导航.账号管理,
      文案.导航.聊天记录,
      文案.导航.思考链,
      文案.导航.封禁管理,
      文案.导航.审计日志,
      文案.导航.统计图表,
      文案.导航.审核运营,
    ];
    expect(七个模块标签.filter((标签) => 标签.length === 0)).toEqual([]);
    for (const 标签 of 七个模块标签) {
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
    expect(包装.text()).toContain(文案.通用.待补充);
    expect(包装.find('[data-testid="dai-bu-chong"]').exists()).toBe(true);
    expect(包装.find('.待补题').text()).toBe(文案.思考.待补充项标签);
    expect(包装.find('[data-testid="dai-bu-chong"] .徽标').text()).toBe(文案.通用.待补充);
    expect(包装.find('[data-testid="dai-bu-chong"]').text()).toContain('实时思考链订阅通道');
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
    expect(包装.find('[data-testid="kong-tai-dai-bu-chong"]').text()).toBe(文案.通用.待补充);
    expect(包装.text()).toContain(文案.通用.暂无数据);
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
    expect(包装.text()).toContain(文案.登录.账号或密码为空);
  });
});

describe('YH-108 身份与能力存储', () => {
  it('设置身份后角色与能力落会话存储，可高危随能力派生', () => {
    const 仓库 = 使用登录仓库();
    expect(仓库.可高危).toBe(false);
    仓库.设置身份('chao_guan', ['cha_kan', 'gao_we']);
    expect(仓库.管理角色).toBe('chao_guan');
    expect(仓库.可高危).toBe(true);
    expect(window.sessionStorage.getItem('guan_li_jiao_se')).toBe('chao_guan');
    expect(JSON.parse(String(window.sessionStorage.getItem('guan_li_neng_li')))).toEqual(['cha_kan', 'gao_we']);
  });

  it('FP-17 扩权后运营拿封禁与统计位、审核员拿封禁审核位，可高危仍只归超管', () => {
    const 仓库 = 使用登录仓库();
    仓库.设置身份('yun_ying', ['cha_kan', 'feng_jin', 'tong_ji_xie']);
    expect(仓库.可管理).toBe(true);
    expect(仓库.可高危).toBe(false);
    expect(仓库.可封禁).toBe(true);
    expect(仓库.可统计).toBe(true);
    expect(仓库.可封禁审核).toBe(false);
    仓库.设置身份('shen_he_yuan', ['cha_kan', 'feng_jin_shen_he']);
    expect(仓库.可高危).toBe(false);
    expect(仓库.可封禁).toBe(false);
    expect(仓库.可统计).toBe(false);
    expect(仓库.可封禁审核).toBe(true);
  });

  it('刷新后从会话存储重建角色，未知角色与未知能力被白名单剔除', () => {
    window.sessionStorage.setItem('guan_li_hui_hua', 'yi_deng_lu');
    window.sessionStorage.setItem('guan_li_jiao_se', 'shen_he_yuan');
    window.sessionStorage.setItem('guan_li_neng_li', JSON.stringify(['cha_kan', 'wei_zhi']));
    const 仓库 = 使用登录仓库();
    expect(仓库.管理角色).toBe('shen_he_yuan');
    expect(仓库.能力列表).toEqual(['cha_kan']);
    expect(仓库.可高危).toBe(false);
    expect(规范角色('zhi_dai_wei')).toBeNull();
    expect(规范角色(null)).toBeNull();
    expect(规范能力('fei-zu-ju')).toEqual([]);
    expect(规范能力(['gao_we', 1, null])).toEqual(['gao_we']);
  });

  it('退出登录与401清令牌同时清角色与能力', () => {
    const 仓库 = 使用登录仓库();
    仓库.设置令牌('ce-shi');
    仓库.设置身份('chao_guan', ['cha_kan', 'gao_we']);
    仓库.退出登录();
    expect(window.sessionStorage.getItem('guan_li_jiao_se')).toBeNull();
    expect(window.sessionStorage.getItem('guan_li_neng_li')).toBeNull();
    expect(仓库.可高危).toBe(false);
    仓库.设置身份('chao_guan', ['cha_kan', 'gao_we']);
    清除令牌();
    仓库.同步存储();
    expect(仓库.管理角色).toBeNull();
    expect(仓库.能力列表).toEqual([]);
    expect(规范令牌('   ')).toBeNull();
  });

  it('角色文案映射三角色，空值标无管理身份，域外值标未收录', () => {
    expect(取管理角色文案('chao_guan')).toBe(文案.账号.角色超级管理员);
    expect(取管理角色文案('yun_ying')).toBe(文案.账号.角色运营);
    expect(取管理角色文案('shen_he_yuan')).toBe(文案.账号.角色审核员);
    expect(取管理角色文案(null)).toBe(文案.账号.角色无);
    expect(取管理角色文案('zhi_dai_wei')).toBe(`${文案.通用.未收录}（zhi_dai_wei）`);
    expect(管理角色选项.map((项) => 项.值)).toEqual(['chao_guan', 'yun_ying', 'shen_he_yuan']);
    expect(管理角色选项.map((项) => 项.文案)).toEqual([
      文案.账号.角色超级管理员,
      文案.账号.角色运营,
      文案.账号.角色审核员,
    ]);
  });
});

describe('YH-108 前端按角色隐藏入口', () => {
  function 预置身份(角色: string | null, 能力: string[]): void {
    使用登录仓库().设置身份(角色, 能力);
  }

  it('账号列表按服务端角色列渲染，超管见授予/回收/接管与角色选择', async () => {
    vi.mocked(账号列表接口).mockResolvedValue({
      行: [
        { ID: 'yi', 昵称: '甲', 手机号: '138****0000', 角色: 'yun_ying' },
        { ID: 'er', 昵称: '乙', 手机号: '139****0001', 角色: null },
      ],
      分页: undefined,
    });
    预置身份('chao_guan', ['cha_kan', 'gao_we']);
    const { default: 账号列表页 } = await import('../views/账号列表.vue');
    const 包装 = mount(账号列表页);
    await flushPromises();
    expect(包装.text()).toContain(文案.账号.角色运营);
    expect(包装.text()).toContain(文案.账号.角色无);
    expect(包装.findAll('[data-testid="jiao-se-hui"]').map((项) => 项.text())).toEqual([
      文案.账号.角色运营,
      文案.账号.角色无,
    ]);
    expect(包装.find('[data-testid="shou-yu-an-niu"]').exists()).toBe(true);
    expect(包装.find('[data-testid="hui-shou-an-niu"]').exists()).toBe(true);
    expect(包装.find('[data-testid="jie-guan-an-niu"]').exists()).toBe(true);
    expect(包装.find('[data-testid="jie-shu-jie-guan-an-niu"]').exists()).toBe(true);
    expect(包装.find('[data-testid="shou-yu-jiao-se-xuan-ze"]').exists()).toBe(true);
    expect(
      包装
        .find('[data-testid="shou-yu-jiao-se-xuan-ze"]')
        .findAll('option')
        .map((项) => 项.text()),
    ).toEqual([文案.账号.角色超级管理员, 文案.账号.角色运营, 文案.账号.角色审核员]);
  });

  it('审核员登录不渲染任何高危入口，只读入口仍在', async () => {
    vi.mocked(账号列表接口).mockResolvedValue({
      行: [{ ID: 'yi', 昵称: '甲', 手机号: '138****0000', 角色: 'chao_guan' }],
      分页: undefined,
    });
    预置身份('shen_he_yuan', ['cha_kan']);
    const { default: 账号列表页 } = await import('../views/账号列表.vue');
    const 包装 = mount(账号列表页);
    await flushPromises();
    expect(包装.find('[data-testid="shou-yu-an-niu"]').exists()).toBe(false);
    expect(包装.find('[data-testid="hui-shou-an-niu"]').exists()).toBe(false);
    expect(包装.find('[data-testid="jie-guan-an-niu"]').exists()).toBe(false);
    expect(包装.find('[data-testid="jie-shu-jie-guan-an-niu"]').exists()).toBe(false);
    expect(包装.find('[data-testid="shou-yu-jiao-se-xuan-ze"]').exists()).toBe(false);
    expect(包装.text()).toContain(文案.账号.角色超级管理员);
  });

  it('运营在审核运营页看到无权限提示而非写表单', async () => {
    预置身份('yun_ying', ['cha_kan']);
    const { default: 审核运营页 } = await import('../views/审核运营.vue');
    const 包装 = mount(审核运营页);
    await flushPromises();
    expect(包装.find('[data-testid="wu-gao-wei-qi-yong"]').exists()).toBe(true);
    expect(包装.find('[data-testid="wu-gao-wei-qi-yong"]').text()).toBe(文案.账号.无权限提示);
    expect(包装.text()).toContain(文案.账号.无权限提示);
    expect(包装.text()).not.toContain(文案.审核.处理多项按钮);
  });

  it('超管在审核运营页看到写表单而非无权限提示', async () => {
    预置身份('chao_guan', ['cha_kan', 'gao_we']);
    const { default: 审核运营页 } = await import('../views/审核运营.vue');
    const 包装 = mount(审核运营页);
    await flushPromises();
    expect(包装.find('[data-testid="wu-gao-wei-qi-yong"]').exists()).toBe(false);
    expect(包装.text()).toContain(文案.审核.处理多项按钮);
  });

  it('应用外壳挂载后拉取服务端身份并展示当前角色', async () => {
    window.sessionStorage.setItem('guan_li_hui_hua', 'yi_deng_lu');
    vi.mocked(我的身份接口).mockResolvedValue({ yong_hu_id: 'yi', jiao_se: 'yun_ying', neng_li: ['cha_kan'] });
    const 路由器 = createRouter({ history: createMemoryHistory(), routes: 路由表 });
    注册守卫(路由器);
    await 路由器.push('/zhang-hao');
    await 路由器.isReady();
    const 包装 = mount(App, { global: { plugins: [路由器], stubs: { RouterView: true } } });
    await flushPromises();
    expect(我的身份接口).toHaveBeenCalled();
    expect(包装.find('[data-testid="dang-qian-jiao-se"]').text()).toBe(文案.账号.角色运营);
    expect(使用登录仓库().可高危).toBe(false);
  });

  it('本地存储被伪造成高危也会被装载时的服务端复核覆盖', async () => {
    window.sessionStorage.setItem('guan_li_hui_hua', 'yi_deng_lu');
    window.sessionStorage.setItem('guan_li_jiao_se', 'chao_guan');
    window.sessionStorage.setItem('guan_li_neng_li', JSON.stringify(['cha_kan', 'gao_we']));
    vi.mocked(我的身份接口).mockResolvedValue({ yong_hu_id: 'yi', jiao_se: 'shen_he_yuan', neng_li: ['cha_kan'] });
    const 路由器 = createRouter({ history: createMemoryHistory(), routes: 路由表 });
    注册守卫(路由器);
    await 路由器.push('/zhang-hao');
    await 路由器.isReady();
    mount(App, { global: { plugins: [路由器], stubs: { RouterView: true } } });
    expect(使用登录仓库().可高危).toBe(true);
    await flushPromises();
    expect(使用登录仓库().管理角色).toBe('shen_he_yuan');
    expect(使用登录仓库().可高危).toBe(false);
    expect(window.sessionStorage.getItem('guan_li_jiao_se')).toBe('shen_he_yuan');
  });
});

describe('YH-108 菜单条目从服务端能力位派生', () => {
  function 挂外壳(): ReturnType<typeof mount> {
    const 路由器 = createRouter({ history: createMemoryHistory(), routes: 路由表 });
    注册守卫(路由器);
    return mount(App, { global: { plugins: [路由器], stubs: { RouterView: true } } });
  }

  it('FP-17 运营按矩阵能力看到全部七个模块（含统计），审核员看不到统计图表', async () => {
    window.sessionStorage.setItem('guan_li_hui_hua', 'yi_deng_lu');
    使用登录仓库().设置身份('yun_ying', ['cha_kan', 'feng_jin', 'tong_ji_xie']);
    vi.mocked(我的身份接口).mockResolvedValue({
      yong_hu_id: 'yi',
      jiao_se: 'yun_ying',
      neng_li: ['cha_kan', 'feng_jin', 'tong_ji_xie'],
    });
    const 包装 = 挂外壳();
    await flushPromises();
    expect(包装.findAll('nav a')).toHaveLength(7);
    window.sessionStorage.setItem('guan_li_hui_hua', 'yi_deng_lu');
    setActivePinia(createPinia());
    使用登录仓库().设置身份('shen_he_yuan', ['cha_kan', 'feng_jin_shen_he']);
    vi.mocked(我的身份接口).mockResolvedValue({
      yong_hu_id: 'yi',
      jiao_se: 'shen_he_yuan',
      neng_li: ['cha_kan', 'feng_jin_shen_he'],
    });
    const 审核包装 = 挂外壳();
    await flushPromises();
    const 导航文本 = 审核包装.find('nav').text();
    expect(审核包装.findAll('nav a')).toHaveLength(6);
    expect(导航文本).not.toContain(文案.导航.统计图表);
    expect(导航文本).toContain(文案.导航.封禁管理);
  });

  it('身份接口未落地前能力为空则不渲染任何入口，不靠前端猜角色', async () => {
    window.sessionStorage.setItem('guan_li_hui_hua', 'yi_deng_lu');
    vi.mocked(我的身份接口).mockRejectedValue(new Error('shen_fen_jie_kou_bu_ke_da'));
    const 包装 = 挂外壳();
    await flushPromises();
    expect(包装.findAll('nav a')).toHaveLength(0);
  });
});

describe('YH-108 登录响应即建权限视图', () => {
  it('登录成功后按响应角色与能力落身份，高危入口随能力出现', async () => {
    vi.mocked(管理登录接口).mockResolvedValue({
      yong_hu_id: 'yi',
      yong_hu_ming: 'jia',
      jiao_se: 'chao_guan',
      neng_li: ['cha_kan', 'gao_we'],
    });
    const { default: 登录页 } = await import('../views/登录页.vue');
    const 包装 = mount(登录页, {
      global: { plugins: [createPinia(), createRouter({ history: createMemoryHistory(), routes: 路由表 })] },
    });
    await 包装.find('[data-testid="shou-ji-hao-shu-ru"]').setValue('13800000000');
    await 包装.find('[data-testid="mi-ma-shu-ru"]').setValue('mi-ma-123');
    await 包装.find('[data-testid="deng-lu-an-niu"]').trigger('click');
    await flushPromises();
    expect(使用登录仓库().管理角色).toBe('chao_guan');
    expect(使用登录仓库().能力列表).toEqual(['cha_kan', 'gao_we']);
    expect(使用登录仓库().可高危).toBe(true);
    expect(window.sessionStorage.getItem('guan_li_neng_li')).toBe(JSON.stringify(['cha_kan', 'gao_we']));
  });

  it('登录响应只给查看能力时前端不得自造高危身份', async () => {
    vi.mocked(管理登录接口).mockResolvedValue({
      yong_hu_id: 'yi',
      yong_hu_ming: 'jia',
      jiao_se: 'yun_ying',
      neng_li: ['cha_kan'],
    });
    const { default: 登录页 } = await import('../views/登录页.vue');
    const 包装 = mount(登录页, {
      global: { plugins: [createPinia(), createRouter({ history: createMemoryHistory(), routes: 路由表 })] },
    });
    await 包装.find('[data-testid="shou-ji-hao-shu-ru"]').setValue('13800000000');
    await 包装.find('[data-testid="mi-ma-shu-ru"]').setValue('mi-ma-123');
    await 包装.find('[data-testid="deng-lu-an-niu"]').trigger('click');
    await flushPromises();
    expect(使用登录仓库().可高危).toBe(false);
    expect(使用登录仓库().能力列表).toEqual(['cha_kan']);
  });
});

describe('FP-17 封禁管理页入口按能力位派生', () => {
  async function 挂封禁页(角色: 'chao_guan' | 'yun_ying' | 'shen_he_yuan', 能力: string[]) {
    vi.mocked(封禁记录接口).mockResolvedValue({ 行: [], 分页: undefined });
    vi.mocked(账号封禁列表接口).mockResolvedValue({
      行: [{ 用户ID: 'yi', 级别: 'feng_jin_1_tian', 申诉状态: 'shen_su_zhong', 最后原因: 'ce' }],
      分页: undefined,
    });
    使用登录仓库().设置身份(角色, 能力);
    const { default: 封禁管理页 } = await import('../views/封禁管理.vue');
    const 包装 = mount(封禁管理页);
    await flushPromises();
    return 包装;
  }

  it('运营见封禁写入卡与解封按钮，不见申诉通过/驳回（feng_jin 不含审核位）', async () => {
    const 包装 = await 挂封禁页('yun_ying', ['cha_kan', 'feng_jin', 'tong_ji_xie']);
    expect(包装.find('.封禁卡').exists()).toBe(true);
    expect(包装.find('[data-testid="jie-feng-an-niu"]').exists()).toBe(true);
    expect(包装.find('[data-testid="tong-guo-shen-su-an-niu"]').exists()).toBe(false);
    expect(包装.find('[data-testid="bo-hui-shen-su-an-niu"]').exists()).toBe(false);
  });

  it('审核员见申诉通过/驳回，不见封禁写入卡与解封（feng_jin_shen_he 不含封禁位）', async () => {
    const 包装 = await 挂封禁页('shen_he_yuan', ['cha_kan', 'feng_jin_shen_he']);
    expect(包装.find('.封禁卡').exists()).toBe(false);
    expect(包装.find('[data-testid="jie-feng-an-niu"]').exists()).toBe(false);
    expect(包装.find('[data-testid="tong-guo-shen-su-an-niu"]').exists()).toBe(true);
    expect(包装.find('[data-testid="bo-hui-shen-su-an-niu"]').exists()).toBe(true);
  });

  it('超管五位全量，封禁写入卡/解封/申诉审核三类入口俱在', async () => {
    const 包装 = await 挂封禁页('chao_guan', ['cha_kan', 'feng_jin', 'feng_jin_shen_he', 'tong_ji_xie', 'gao_we']);
    expect(包装.find('.封禁卡').exists()).toBe(true);
    expect(包装.find('[data-testid="jie-feng-an-niu"]').exists()).toBe(true);
    expect(包装.find('[data-testid="tong-guo-shen-su-an-niu"]').exists()).toBe(true);
    expect(包装.find('[data-testid="bo-hui-shen-su-an-niu"]').exists()).toBe(true);
  });
});
