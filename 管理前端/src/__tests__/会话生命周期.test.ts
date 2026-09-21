import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import { flushPromises, mount } from '@vue/test-utils';
import {
  使用登录仓库,
  归一登录选项,
  勾选登录选项,
  清除令牌,
  可免登录进入,
  持久令牌冷启动,
  读令牌,
  读登录选项,
  读记住账号,
  写登录选项,
  默认登录选项,
  type 登录选项,
} from '../stores/登录';
import { 守卫判定, 注册守卫, 路由表 } from '../router';
import { 业务错误 } from '../api/请求';
import { 管理登录, 管理登出, 刷新管理令牌, type 管理登录结果 } from '../api/管理';
import { 登录选项存储键, 记住账号存储键, 会话续期间隔毫秒 } from '../配置';
import { 取文案 } from '../文案/聚合';

vi.mock('../api/管理', () => ({
  管理登录: vi.fn(),
  管理登出: vi.fn().mockResolvedValue({ yi_tui_chu: true }),
  刷新管理令牌: vi.fn(),
  我的身份: vi.fn().mockResolvedValue({ yong_hu_id: 'yi', jiao_se: 'chao_guan', neng_li: ['cha_kan', 'gao_we'] }),
}));

const 选项键清单: (keyof 登录选项)[] = ['记住账号', '记住密码', '自动登录'];

function 组合布尔(序号: number): 登录选项 {
  return {
    记住账号: (序号 & 1) !== 0,
    记住密码: (序号 & 2) !== 0,
    自动登录: (序号 & 4) !== 0,
  };
}

const 全部组合 = [0, 1, 2, 3, 4, 5, 6, 7].map(组合布尔);

function 断言不变量(选项: 登录选项, 场景: string): void {
  if (选项.记住密码 === false) {
    expect(选项.自动登录, `${场景}：记住密码=false 时自动登录必须为 false`).toBe(false);
  }
}

beforeEach(() => {
  setActivePinia(createPinia());
  window.localStorage.clear();
  window.sessionStorage.clear();
  vi.clearAllMocks();
});

describe('FP-03 三选项状态机穷尽八种布尔组合', () => {
  it('八种组合齐备，少一组合即守卫失效', () => {
    expect(全部组合).toHaveLength(8);
    expect(new Set(全部组合.map((项) => JSON.stringify(项))).size).toBe(8);
  });

  it('初始化路径：任意原始组合归一后都满足「记住密码=false ⇒ 自动登录=false」', () => {
    for (const 组合 of 全部组合) {
      断言不变量(归一登录选项(组合), `初始化 ${JSON.stringify(组合)}`);
    }
  });

  it('初始化路径：非布尔与畸形原始值一律归 false，不抛错', () => {
    for (const 脏值 of [null, undefined, 'x', 1, [], { 记住密码: 'true', 自动登录: 1 }]) {
      const 规范 = 归一登录选项(脏值);
      expect(规范).toEqual(默认登录选项);
      断言不变量(规范, `脏值 ${JSON.stringify(脏值)}`);
    }
  });

  it('勾选路径：逐项勾上任一组合都满足不变量，勾自动登录永远带出记住密码', () => {
    for (const 起点 of 全部组合) {
      for (const 项 of 选项键清单) {
        for (const 目标 of [true, false]) {
          const 结果 = 勾选登录选项(起点, { [项]: 目标 });
          断言不变量(结果, `勾选 ${项}=${目标} 自 ${JSON.stringify(起点)}`);
          if (结果.自动登录) {
            expect(结果.记住密码, `自动登录为真时记住密码必须为真：${项}=${目标} 自 ${JSON.stringify(起点)}`).toBe(true);
          }
          if (项 === '自动登录' && 目标 && !起点.记住密码) {
            expect(结果.自动登录, '未勾记住密码时自动登录不可达').toBe(false);
          }
        }
      }
    }
  });

  it('取消路径：取消记住密码即联动取消自动登录', () => {
    for (const 组合 of 全部组合) {
      const 结果 = 勾选登录选项(组合, { 记住密码: false });
      expect(结果.记住密码).toBe(false);
      expect(结果.自动登录, `取消记住密码后自动登录仍勾选：${JSON.stringify(组合)}`).toBe(false);
    }
  });

  it('持久化回读路径：写进去的组合读回来仍满足不变量', () => {
    for (const 组合 of 全部组合) {
      写登录选项(组合);
      const 回读 = 读登录选项();
      断言不变量(回读, `回读 ${JSON.stringify(组合)}`);
      expect(回读).toEqual(归一登录选项(组合));
    }
  });

  it('持久化回读路径：被篡改成「无记住密码却有自动登录」的存储也必须被归一掉', () => {
    window.localStorage.setItem(登录选项存储键, JSON.stringify({ 记住密码: false, 自动登录: true }));
    const 回读 = 读登录选项();
    expect(回读.自动登录).toBe(false);
    断言不变量(回读, '篡改回读');
  });

  it('持久化落盘只有三个布尔开关，不带任何口令字段', () => {
    写登录选项({ 记住账号: true, 记住密码: true, 自动登录: true });
    const 存 = String(window.localStorage.getItem(登录选项存储键));
    const 解析 = JSON.parse(存) as Record<string, unknown>;
    expect(解析).toEqual({ 记住账号: true, 记住密码: true, 自动登录: true });
    expect(Object.keys(解析).sort()).toEqual(['自动登录', '记住密码', '记住账号']);
    for (const 值 of Object.values(解析)) {
      expect(typeof 值).toBe('boolean');
    }
    expect(存.toLowerCase()).not.toMatch(/mi_ma|mima|password|passwd|口令/);
  });
});

describe('FP-03 会话标记的持久档', () => {
  it('勾记住密码登录：会话级与持久级各留一份标记', () => {
    const 仓库 = 使用登录仓库();
    expect(仓库.设置令牌('yi_deng_lu', true)).toBe(true);
    expect(window.sessionStorage.getItem('guan_li_hui_hua')).toBe('yi_deng_lu');
    expect(window.localStorage.getItem('guan_li_hui_hua')).toBe('yi_deng_lu');
  });

  it('不勾记住密码登录：只留会话级标记，localStorage 不留任何东西', () => {
    const 仓库 = 使用登录仓库();
    仓库.设置令牌('yi_deng_lu');
    expect(window.sessionStorage.getItem('guan_li_hui_hua')).toBe('yi_deng_lu');
    expect(window.localStorage.getItem('guan_li_hui_hua')).toBeNull();
  });

  it('改判持久档会把上一档残留的标记清掉，不出现两份并存', () => {
    const 仓库 = 使用登录仓库();
    仓库.设置令牌('yi_deng_lu', true);
    仓库.设置令牌('yi_deng_lu', false);
    expect(window.localStorage.getItem('guan_li_hui_hua')).toBeNull();
    expect(读令牌()).toBe('yi_deng_lu');
    仓库.设置令牌('yi_deng_lu', true);
    expect(window.sessionStorage.getItem('guan_li_hui_hua')).toBe('yi_deng_lu');
  });

  it('清除令牌与会话标识重置都同时清两个存储', () => {
    const 仓库 = 使用登录仓库();
    仓库.设置令牌('yi_deng_lu', true);
    清除令牌();
    expect(window.sessionStorage.getItem('guan_li_hui_hua')).toBeNull();
    expect(window.localStorage.getItem('guan_li_hui_hua')).toBeNull();
    仓库.设置令牌('yi_deng_lu', true);
    仓库.退出登录();
    expect(读令牌()).toBeNull();
    expect(仓库.已登录).toBe(false);
  });

  it('空标记与超长标记仍被拒绝且不落盘', () => {
    const 仓库 = 使用登录仓库();
    expect(仓库.设置令牌('   ', true)).toBe(false);
    expect(仓库.设置令牌('x'.repeat(4001))).toBe(false);
    expect(window.localStorage.getItem('guan_li_hui_hua')).toBeNull();
    expect(window.sessionStorage.getItem('guan_li_hui_hua')).toBeNull();
  });
});

describe('FP-03 免登录进入判定', () => {
  it('本次浏览器已登录过即放行', () => {
    使用登录仓库().设置令牌('yi_deng_lu', false);
    expect(可免登录进入()).toBe(true);
  });

  it('只剩持久标记时，勾了自动登录才放行', () => {
    window.localStorage.setItem('guan_li_hui_hua', 'yi_deng_lu');
    expect(可免登录进入()).toBe(false);
    写登录选项({ 记住账号: false, 记住密码: true, 自动登录: true });
    expect(可免登录进入()).toBe(true);
  });

  it('无标记一律不放行', () => {
    expect(可免登录进入()).toBe(false);
  });

  it('守卫在持久标记未勾自动登录时把受保护页送回登录页', () => {
    expect(守卫判定('/zhang-hao', 'yi_deng_lu', false)).toBe('/deng-lu');
    expect(守卫判定('/zhang-hao', 'yi_deng_lu', true)).toBeNull();
    expect(守卫判定('/deng-lu', 'yi_deng_lu', false)).toBeNull();
    expect(守卫判定('/deng-lu', 'yi_deng_lu', true)).toBe('/zhang-hao');
    expect(守卫判定('/deng-lu', null)).toBeNull();
  });
});

describe('FP-03 续期链与单飞', () => {
  function 已登录仓库() {
    const 仓库 = 使用登录仓库();
    仓库.设置令牌('yi_deng_lu', true);
    return 仓库;
  }

  it('未到续期间隔不触发请求，到点才触发', () => {
    const 仓库 = 已登录仓库();
    expect(仓库.需要续期(Date.now() + 会话续期间隔毫秒 - 1)).toBe(false);
    expect(仓库.需要续期(Date.now() + 会话续期间隔毫秒)).toBe(true);
  });

  it('并发续期只发一次请求，且轮换后按服务端回传重建身份', async () => {
    vi.mocked(刷新管理令牌).mockResolvedValue({
      yong_hu_id: 'yi',
      yong_hu_ming: null,
      jiao_se: 'yun_ying',
      neng_li: ['cha_kan', 'feng_jin'],
    });
    const 仓库 = 已登录仓库();
    const 三个 = await Promise.all([仓库.续期会话(), 仓库.续期会话(), 仓库.续期会话()]);
    expect(三个).toEqual([true, true, true]);
    expect(刷新管理令牌).toHaveBeenCalledTimes(1);
    expect(刷新管理令牌).toHaveBeenCalledWith();
    expect(仓库.管理角色).toBe('yun_ying');
    expect(仓库.能力列表).toEqual(['cha_kan', 'feng_jin']);
    expect(仓库.需要续期(Date.now())).toBe(false);
  });

  it('续期成功可再次触发，不被上一次在途 Promise 卡住', async () => {
    vi.mocked(刷新管理令牌).mockResolvedValue({
      yong_hu_id: 'yi',
      yong_hu_ming: null,
      jiao_se: 'chao_guan',
      neng_li: ['cha_kan'],
    });
    const 仓库 = 已登录仓库();
    expect(await 仓库.续期会话()).toBe(true);
    expect(await 仓库.续期会话()).toBe(true);
    expect(刷新管理令牌).toHaveBeenCalledTimes(2);
  });

  it('凭证被服务端否定时续期即本地登出', async () => {
    vi.mocked(刷新管理令牌).mockRejectedValue(new 业务错误('登录续期已过期，请重新登录', 'LING_PAI_WU_XIAO'));
    const 仓库 = 已登录仓库();
    expect(await 仓库.续期会话()).toBe(false);
    expect(仓库.已登录).toBe(false);
    expect(读令牌()).toBeNull();
  });

  it('限流与网络抖动不清会话，服务端没否定凭证就留着', async () => {
    const 仓库 = 已登录仓库();
    vi.mocked(刷新管理令牌).mockRejectedValue(new 业务错误('请求过于频繁，请稍后再试', 'XIAN_LIU'));
    expect(await 仓库.续期会话()).toBe(false);
    expect(仓库.已登录).toBe(true);
    vi.mocked(刷新管理令牌).mockRejectedValue(new Error('wang-luo'));
    expect(await 仓库.续期会话()).toBe(false);
    expect(仓库.已登录).toBe(true);
  });

  it('无本地标记时续期直接否，不打通告服务端', async () => {
    const 仓库 = 使用登录仓库();
    expect(await 仓库.续期会话()).toBe(false);
    expect(刷新管理令牌).not.toHaveBeenCalled();
  });

  it('巡查只在已登录且到点时才发请求', () => {
    const 仓库 = 使用登录仓库();
    仓库.启动续期巡查();
    仓库.停止续期巡查();
    expect(刷新管理令牌).not.toHaveBeenCalled();
  });
});

describe('FP-03 服务端注销接线', () => {
  it('注销会话调用登出端点', async () => {
    expect(await 使用登录仓库().注销会话()).toBe(true);
    expect(管理登出).toHaveBeenCalledTimes(1);
  });

  it('登出端点失败也必须清本地标记，不把管理员卡在已登录态', async () => {
    vi.mocked(管理登出).mockRejectedValue(new 业务错误('操作未完成，请稍后重试或联系运维', 'NEI_BU_CUO_WU'));
    const 仓库 = 使用登录仓库();
    仓库.设置令牌('yi_deng_lu', true);
    expect(await 仓库.注销会话()).toBe(false);
    仓库.退出登录();
    expect(仓库.已登录).toBe(false);
    expect(读令牌()).toBeNull();
  });
});

describe('FP-03 登录页三选项接线', () => {
  async function 挂登录页() {
    const 路由器 = createRouter({ history: createMemoryHistory(), routes: 路由表 });
    const { default: 登录页 } = await import('../views/登录页.vue');
    return mount(登录页, { global: { plugins: [createPinia(), 路由器] } });
  }

  it('三选项都在，且初始全未勾选', async () => {
    const 包装 = await 挂登录页();
    for (const 标识 of ['ji-zhu-zhang-hao-gou', 'ji-zhu-mi-ma-gou', 'zi-dong-deng-lu-gou']) {
      const 项 = 包装.find<HTMLInputElement>(`[data-testid="${标识}"]`);
      expect(项.exists(), `缺测试钩子 ${标识}`).toBe(true);
      expect(项.element.checked).toBe(false);
    }
    expect(包装.text()).toContain(取文案('登录', '记住账号'));
    expect(包装.text()).toContain(取文案('登录', '记住密码'));
    expect(包装.text()).toContain(取文案('登录', '自动登录'));
  });

  it('未勾记住密码时自动登录被禁用', async () => {
    const 包装 = await 挂登录页();
    expect(包装.find('[data-testid="zi-dong-deng-lu-gou"]').attributes('disabled')).toBeDefined();
    await 包装.find('[data-testid="ji-zhu-mi-ma-gou"]').setValue(true);
    expect(包装.find('[data-testid="zi-dong-deng-lu-gou"]').attributes('disabled')).toBeUndefined();
  });

  it('点自动登录在未勾记住密码时不可达，勾上记住密码后才可勾', async () => {
    const 包装 = await 挂登录页();
    await 包装.find('[data-testid="zi-dong-deng-lu-gou"]').trigger('click');
    expect(包装.find<HTMLInputElement>('[data-testid="zi-dong-deng-lu-gou"]').element.checked).toBe(false);
    expect(window.localStorage.getItem(登录选项存储键)).toBeNull();
    await 包装.find('[data-testid="ji-zhu-mi-ma-gou"]').setValue(true);
    await 包装.find('[data-testid="zi-dong-deng-lu-gou"]').setValue(true);
    expect(包装.find<HTMLInputElement>('[data-testid="zi-dong-deng-lu-gou"]').element.checked).toBe(true);
  });

  it('取消记住密码即联动取消自动登录，并把联动结果落盘', async () => {
    const 包装 = await 挂登录页();
    await 包装.find('[data-testid="ji-zhu-mi-ma-gou"]').setValue(true);
    await 包装.find('[data-testid="zi-dong-deng-lu-gou"]').setValue(true);
    await 包装.find('[data-testid="ji-zhu-mi-ma-gou"]').setValue(false);
    await flushPromises();
    expect(包装.find<HTMLInputElement>('[data-testid="zi-dong-deng-lu-gou"]').element.checked).toBe(false);
    expect(JSON.parse(String(window.localStorage.getItem(登录选项存储键)))).toEqual({
      记住账号: false,
      记住密码: false,
      自动登录: false,
    });
  });

  it('联动结果跨装载保持：重开页面后仍是取消态', async () => {
    const 第一次 = await 挂登录页();
    await 第一次.find('[data-testid="ji-zhu-mi-ma-gou"]').setValue(true);
    await 第一次.find('[data-testid="zi-dong-deng-lu-gou"]').setValue(true);
    await 第一次.find('[data-testid="ji-zhu-mi-ma-gou"]').setValue(false);
    await flushPromises();
    第一次.unmount();
    const 第二次 = await 挂登录页();
    expect(第二次.find<HTMLInputElement>('[data-testid="ji-zhu-mi-ma-gou"]').element.checked).toBe(false);
    expect(第二次.find<HTMLInputElement>('[data-testid="zi-dong-deng-lu-gou"]').element.checked).toBe(false);
  });

  it('记住账号：登录后回填手机号，取消勾选后不再回填', async () => {
    vi.mocked(管理登录).mockResolvedValue({
      yong_hu_id: 'yi',
      yong_hu_ming: null,
      jiao_se: 'chao_guan',
      neng_li: ['cha_kan'],
    });
    const 第一次 = await 挂登录页();
    await 第一次.find('[data-testid="shou-ji-hao-shu-ru"]').setValue('13800000000');
    await 第一次.find('[data-testid="mi-ma-shu-ru"]').setValue('ce-shi-mi-ma-123');
    await 第一次.find('[data-testid="ji-zhu-zhang-hao-gou"]').setValue(true);
    await 第一次.find('[data-testid="deng-lu-an-niu"]').trigger('click');
    await flushPromises();
    expect(读记住账号()).toBe('13800000000');
    第一次.unmount();
    const 第二次 = await 挂登录页();
    expect(第二次.find<HTMLInputElement>('[data-testid="shou-ji-hao-shu-ru"]').element.value).toBe('13800000000');
    await 第二次.find('[data-testid="ji-zhu-zhang-hao-gou"]').setValue(false);
    await 第二次.find('[data-testid="mi-ma-shu-ru"]').setValue('ce-shi-mi-ma-123');
    await 第二次.find('[data-testid="deng-lu-an-niu"]').trigger('click');
    await flushPromises();
    expect(读记住账号()).toBe('');
    第二次.unmount();
    expect(读记住账号()).toBe('');
  });

  it('记住密码决定登录请求的持久入参', async () => {
    vi.mocked(管理登录).mockResolvedValue({
      yong_hu_id: 'yi',
      yong_hu_ming: null,
      jiao_se: 'chao_guan',
      neng_li: ['cha_kan'],
    });
    const 包装 = await 挂登录页();
    await 包装.find('[data-testid="shou-ji-hao-shu-ru"]').setValue('13800000000');
    await 包装.find('[data-testid="mi-ma-shu-ru"]').setValue('ce-shi-mi-ma-123');
    await 包装.find('[data-testid="deng-lu-an-niu"]').trigger('click');
    await flushPromises();
    expect(管理登录).toHaveBeenLastCalledWith({
      shou_ji_hao: '13800000000',
      mi_ma: 'ce-shi-mi-ma-123',
      chi_jiu_hui_hua: false,
    });
    await 包装.find('[data-testid="ji-zhu-mi-ma-gou"]').setValue(true);
    await 包装.find('[data-testid="mi-ma-shu-ru"]').setValue('ce-shi-mi-ma-123');
    await 包装.find('[data-testid="deng-lu-an-niu"]').trigger('click');
    await flushPromises();
    expect(管理登录).toHaveBeenLastCalledWith({
      shou_ji_hao: '13800000000',
      mi_ma: 'ce-shi-mi-ma-123',
      chi_jiu_hui_hua: true,
    });
    expect(window.localStorage.getItem('guan_li_hui_hua')).toBe('yi_deng_lu');
  });

  it('三选项全勾也不把密码写进任何本地存储', async () => {
    vi.mocked(管理登录).mockResolvedValue({
      yong_hu_id: 'yi',
      yong_hu_ming: null,
      jiao_se: 'chao_guan',
      neng_li: ['cha_kan'],
    });
    const 口令 = 'ce-shi-mi-ma-Ab123456';
    const 包装 = await 挂登录页();
    await 包装.find('[data-testid="shou-ji-hao-shu-ru"]').setValue('13800000000');
    await 包装.find('[data-testid="mi-ma-shu-ru"]').setValue(口令);
    await 包装.find('[data-testid="ji-zhu-zhang-hao-gou"]').setValue(true);
    await 包装.find('[data-testid="ji-zhu-mi-ma-gou"]').setValue(true);
    await 包装.find('[data-testid="zi-dong-deng-lu-gou"]').setValue(true);
    await 包装.find('[data-testid="deng-lu-an-niu"]').trigger('click');
    await flushPromises();
    for (const 存 of [window.localStorage, window.sessionStorage]) {
      for (let 序 = 0; 序 < 存.length; 序 += 1) {
        const 键 = String(存.key(序));
        expect(键, '存储键里出现口令').not.toContain(口令);
        expect(String(存.getItem(键)), `存储值里出现口令：${键}`).not.toContain(口令);
      }
    }
    expect(包装.find<HTMLInputElement>('[data-testid="mi-ma-shu-ru"]').element.value).toBe('');
  });

  it('写入路径 spy：口令字面量与密码值绝不出现在任何 setItem 调用中', async () => {
    vi.mocked(管理登录).mockResolvedValue({
      yong_hu_id: 'yi',
      yong_hu_ming: null,
      jiao_se: 'chao_guan',
      neng_li: ['cha_kan'],
    });
    const 口令 = 'mi-ma-BuYaoXiePan-9527';
    const 记录: Array<[string, string]> = [];
    const 原局部 = window.localStorage.setItem.bind(window.localStorage);
    const 原会话 = window.sessionStorage.setItem.bind(window.sessionStorage);
    const 局监视 = vi.spyOn(window.localStorage, 'setItem').mockImplementation((键, 值) => {
      记录.push([String(键), String(值)]);
      原局部(String(键), String(值));
    });
    const 会监视 = vi.spyOn(window.sessionStorage, 'setItem').mockImplementation((键, 值) => {
      记录.push([String(键), String(值)]);
      原会话(String(键), String(值));
    });
    try {
      const 包装 = await 挂登录页();
      await 包装.find('[data-testid="shou-ji-hao-shu-ru"]').setValue('13800000000');
      await 包装.find('[data-testid="mi-ma-shu-ru"]').setValue(口令);
      await 包装.find('[data-testid="ji-zhu-zhang-hao-gou"]').setValue(true);
      await 包装.find('[data-testid="ji-zhu-mi-ma-gou"]').setValue(true);
      await 包装.find<HTMLInputElement>('[data-testid="deng-lu-an-niu"]').trigger('click');
      await flushPromises();
      expect(记录.length, '监控期间未捕获任何存储写入').toBeGreaterThan(0);
      for (const [键, 值] of 记录) {
        expect(值, `写入值含口令：${键}`).not.toContain(口令);
        expect(键.toLowerCase()).not.toMatch(/mi_ma|password|口令/);
      }
      expect(
        记录.some(([键, 值]) => 键 === 记住账号存储键 && 值 === '13800000000'),
        '记住账号键应且仅应记录手机号',
      ).toBe(true);
    } finally {
      局监视.mockRestore();
      会监视.mockRestore();
    }
  });

  it('登录页文案只走词典，标签不再与占位同句', async () => {
    const 包装 = await 挂登录页();
    for (const 项 of 包装.findAll('label')) {
      expect(项.attributes('placeholder')).toBeUndefined();
    }
  });
});

describe('FP-03 死代码清除结论', () => {
  it('存令牌 不再存在，刷新管理令牌 由续期链真用', async () => {
    const 存储模块 = await import('../stores/登录');
    expect('存令牌' in 存储模块).toBe(false);
    expect(typeof 存储模块.使用登录仓库).toBe('function');
    const 接口模块 = await import('../api/管理');
    expect(typeof 接口模块.刷新管理令牌).toBe('function');
    expect(typeof 接口模块.管理登出).toBe('function');
  });
});

describe('FP-08 冷启动自动登录的权限视图就绪', () => {
  function 持久标记冷启动(自动 = true): void {
    window.localStorage.setItem('guan_li_hui_hua', 'yi_deng_lu');
    写登录选项({ 记住账号: false, 记住密码: true, 自动登录: 自动 });
  }

  function 建路由() {
    const 路由器 = createRouter({ history: createMemoryHistory(), routes: 路由表 });
    注册守卫(路由器);
    return 路由器;
  }

  const 轮换回包: 管理登录结果 = {
    yong_hu_id: 'yi',
    yong_hu_ming: null,
    jiao_se: 'chao_guan',
    neng_li: ['cha_kan', 'gao_we'],
  };

  it('持久标记冷启动判定精确：只有跨重开只剩持久层才算', () => {
    expect(持久令牌冷启动()).toBe(false);
    持久标记冷启动();
    expect(持久令牌冷启动()).toBe(true);
    使用登录仓库().设置令牌('yi_deng_lu', false);
    expect(持久令牌冷启动(), '本次浏览器已有会话标记时不算冷启动').toBe(false);
  });

  it('路由放行前身份已就绪：首帧即带全部权限入口，不得中途补位', async () => {
    持久标记冷启动();
    vi.mocked(刷新管理令牌).mockResolvedValue(轮换回包);
    const 仓库 = 使用登录仓库();
    expect(仓库.可高危, '前置：冷启动那一刻能力位确实是空的').toBe(false);
    const 路由器 = 建路由();
    await 路由器.push('/zhang-hao');
    expect(刷新管理令牌).toHaveBeenCalledTimes(1);
    expect(仓库.能力列表).toEqual(['cha_kan', 'gao_we']);
    expect(仓库.可高危, '守卫放行时权限视图必须已完整').toBe(true);
    expect(路由器.currentRoute.value.path).toBe('/zhang-hao');
  });

  it('单次闸门：守卫与外壳装载共用同一次轮换，跳页不重复请求', async () => {
    持久标记冷启动();
    vi.mocked(刷新管理令牌).mockResolvedValue(轮换回包);
    const 仓库 = 使用登录仓库();
    const 路由器 = 建路由();
    await Promise.all([路由器.push('/zhang-hao'), 仓库.冷启动会话(), 仓库.冷启动会话()]);
    expect(刷新管理令牌).toHaveBeenCalledTimes(1);
    await 路由器.push('/liao-tian');
    await 路由器.push('/shen-ji');
    expect(刷新管理令牌, '同一浏览器内的后续跳页不得再等身份').toHaveBeenCalledTimes(1);
    仓库.同步存储();
    expect(仓库.可高危).toBe(true);
  });

  it('免登录页不参与等待：只勾记住密码未勾自动登录时，登录表单不被续期挡在后面', async () => {
    持久标记冷启动(false);
    const 路由器 = 建路由();
    await 路由器.push('/zhang-hao');
    expect(路由器.currentRoute.value.path).toBe('/deng-lu');
    expect(刷新管理令牌, '登录页没有权限视图要等，守卫不得在此触发一次性轮换').not.toHaveBeenCalled();
  });

  it('凭证被服务端否定：送回登录页且不卡死，仍可手动登录', async () => {
    持久标记冷启动();
    vi.mocked(刷新管理令牌).mockRejectedValue(new 业务错误('登录续期已过期，请重新登录', 'LING_PAI_WU_XIAO'));
    const 仓库 = 使用登录仓库();
    const 路由器 = 建路由();
    await 路由器.push('/zhang-hao');
    expect(路由器.currentRoute.value.path).toBe('/deng-lu');
    expect(仓库.已登录).toBe(false);
    expect(读令牌()).toBeNull();
  });

  it('限流与网络抖动不卡死：照常放行，能力位按空渲染', async () => {
    持久标记冷启动();
    vi.mocked(刷新管理令牌).mockRejectedValue(new 业务错误('请求过于频繁，请稍后再试', 'XIAN_LIU'));
    const 路由器 = 建路由();
    await 路由器.push('/zhang-hao');
    expect(路由器.currentRoute.value.path).toBe('/zhang-hao');
    expect(使用登录仓库().已登录).toBe(true);
  });

  it('本次浏览器已登录过的路径不经过等待，守卫保持同步语义', async () => {
    window.sessionStorage.setItem('guan_li_hui_hua', 'yi_deng_lu');
    const 路由器 = 建路由();
    await 路由器.push('/zhang-hao');
    expect(路由器.currentRoute.value.path).toBe('/zhang-hao');
    expect(刷新管理令牌, '非冷启动不得被守卫触发轮换').not.toHaveBeenCalled();
  });
});
