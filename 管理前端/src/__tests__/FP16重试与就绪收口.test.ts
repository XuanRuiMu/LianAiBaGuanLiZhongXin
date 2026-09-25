import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import { flushPromises, mount, type DOMWrapper, type VueWrapper } from '@vue/test-utils';
import App from '../App.vue';
import XiaoXiTiao from '../components/XiaoXiTiao.vue';
import { 路由表 } from '../router';
import { 使用登录仓库 } from '../stores/登录';
import { 创建请求错误状态, 取错误展示 } from '../api/错误展示';
import { 业务错误, 创建前端错误, 前端错误码 } from '../api/请求';
import { 就绪检查 } from '../api/探针';
import { 我的身份, 刷新管理令牌 } from '../api/会话';

const 身份结果 = { yong_hu_id: 'fp16-yong-hu', jiao_se: 'chao_guan', neng_li: ['cha_kan'] };
const 登录结果 = { ...身份结果, yong_hu_ming: null };

vi.mock('../api/探针', () => ({
  就绪检查: vi.fn(),
}));

vi.mock('../api/会话', () => ({
  我的身份: vi.fn(),
  刷新管理令牌: vi.fn(),
  管理登录: vi.fn(),
  管理登出: vi.fn(),
}));

function 建状态(错误: unknown, 重试: () => Promise<void>): ReturnType<typeof 创建请求错误状态> {
  const 状态 = 创建请求错误状态();
  const 批次 = 状态.错误闸门.开始();
  状态.显示(错误, 批次, 重试);
  return 状态;
}

async function 等待错误条(包装: VueWrapper): Promise<DOMWrapper<Element>> {
  const 选择器 = '[data-testid="ji-dui-jian-kong"]';
  await vi.waitFor(() => {
    expect(包装.find(选择器).exists()).toBe(true);
  });
  return 包装.find(选择器);
}

beforeEach(() => {
  setActivePinia(createPinia());
  vi.clearAllMocks();
  vi.mocked(我的身份).mockResolvedValue(身份结果);
  vi.mocked(刷新管理令牌).mockResolvedValue(登录结果);
  vi.mocked(就绪检查).mockResolvedValue({ zhuang_tai: 'jiu_xu', jiu_xu: true, kui: [] });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('FP-16 重试等待与错误诊断', () => {
  it('retryAfterMs 显示倒计时、等待期间禁用且重复点击只发一次请求', async () => {
    vi.useFakeTimers();
    const 重试 = vi.fn().mockResolvedValue(undefined);
    const 状态 = 建状态(new 业务错误({
      code: 'XIAN_LIU',
      message: '请求过于频繁，请稍后再试',
      traceId: 'fp16-retry',
      retryable: true,
      retryAfterMs: 3000,
    }), 重试);
    const 包装 = mount(XiaoXiTiao, { props: { xingTai: 'cuo-wu', 错误状态: 状态 } });
    const 按钮 = 包装.get('[data-testid="cuo-wu-chong-shi"]');

    expect(按钮.attributes('disabled')).toBeDefined();
    expect(按钮.text()).toContain('3');
    await vi.advanceTimersByTimeAsync(2999);
    expect(按钮.attributes('disabled')).toBeDefined();
    await vi.advanceTimersByTimeAsync(1);
    expect(按钮.attributes('disabled')).toBeUndefined();

    let 放行: () => void = () => undefined;
    重试.mockImplementation(() => new Promise<void>((解决) => {
      放行 = 解决;
    }));
    await 按钮.trigger('click');
    await 按钮.trigger('click');
    expect(重试).toHaveBeenCalledTimes(1);
    expect(按钮.attributes('disabled')).toBeDefined();
    放行();
    await vi.advanceTimersByTimeAsync(1);
    expect(按钮.attributes('disabled')).toBeUndefined();
  });

  it('冲突与依赖错误无服务端等待值时仍可立即重试且不重复', async () => {
    for (const code of ['SHEN_HE_DUI_XIANG_YI_BIAN', 'YI_LAI_QUE_SHI']) {
      let 放行: () => void = () => undefined;
      const 重试 = vi.fn().mockImplementation(() => new Promise<void>((解决) => {
        放行 = 解决;
      }));
      const 状态 = 建状态(new 业务错误({
        code,
        message: '服务暂时不可用，请稍后重试',
        traceId: `fp16-${code}`,
        retryable: true,
      }), 重试);
      const 包装 = mount(XiaoXiTiao, { props: { xingTai: 'cuo-wu', 错误状态: 状态 } });
      const 按钮 = 包装.get('[data-testid="cuo-wu-chong-shi"]');
      expect(按钮.attributes('disabled')).toBeUndefined();
      await 按钮.trigger('click');
      await 按钮.trigger('click');
      expect(重试).toHaveBeenCalledTimes(1);
      放行();
    }
  });

  it('摘要只给中文影响与下一步，诊断码仅在可折叠详情区', () => {
    const 展示 = 取错误展示(创建前端错误('服务暂时不可用', 前端错误码.未归类, true));
    const 包装 = mount(XiaoXiTiao, { props: { xingTai: 'cuo-wu', 错误展示: 展示, cuoWuMa: 'WEI_ZHI_CUOWU' } });
    const 摘要 = 包装.get('[data-testid="cuo-wu-zhan-yao"]').text();
    const 诊断 = 包装.find('details');
    expect(摘要).not.toContain('WEI_ZHI_CUOWU');
    expect(摘要).toContain(展示.影响);
    expect(摘要).toContain(展示.下一步);
    expect(诊断.exists()).toBe(true);
    expect(诊断.attributes('open')).toBeUndefined();
    expect(诊断.text()).toContain('WEI_ZHI_CUOWU');
  });
});

describe('FP-16 就绪检查接入现有外壳错误条', () => {
  it('首屏源码不静态引入探针与错误状态机，只在首帧后动态装载', () => {
    const 外壳源 = fs.readFileSync('src/App.vue', 'utf8');
    const 静态引入 = [...外壳源.matchAll(/^import .*from '(\.[^']+)';$/gm)].map((匹配) => 匹配[1]);
    expect(静态引入).not.toContain('./api/探针');
    expect(静态引入).not.toContain('./api/错误展示');
    expect(静态引入.some((指向) => 指向.includes('XiaoXiTiao'))).toBe(false);
    expect(外壳源).toContain("import('./components/就绪错误条.vue')");
    expect(外壳源).toContain('await nextTick()');
  });

  it('构建产物里首屏分块不含探针路径与错误状态机，探针只落在懒加载分块', () => {
    const 统计 = JSON.parse(fs.readFileSync('dist/build-stats.json', 'utf8')) as {
      清单: Array<{ 名称: string }>;
    };
    const 首屏 = 统计.清单.find((项) => 项.名称.startsWith('assets/index-') && 项.名称.endsWith('.js'));
    expect(首屏).toBeDefined();
    const 首屏源 = fs.readFileSync(`dist/${首屏?.名称 ?? ''}`, 'utf8');
    for (const 指纹 of ['/api/ready', 'ji-dui-jian-kong', 'cuo-wu-zhen-dui', 'error-retry', '949447950']) {
      expect(首屏源, `首屏分块不得含 ${指纹}`).not.toContain(指纹);
    }
    const 命中 = 统计.清单.filter((项) => {
      if (!项.名称.endsWith('.js') || 项.名称 === 首屏?.名称) {
        return false;
      }
      return fs.readFileSync(`dist/${项.名称}`, 'utf8').includes('/api/ready');
    });
    expect(命中.map((项) => 项.名称)).toHaveLength(1);
  });

  it('就绪失败显示可恢复错误，重试成功后清除', async () => {
    const 就绪错误 = new 业务错误({
      code: 'YI_LAI_QUE_SHI',
      message: '系统尚未准备就绪，请稍后重试或联系运维',
      traceId: 'fp16-ready',
      retryable: true,
    });
    vi.mocked(就绪检查).mockRejectedValueOnce(就绪错误).mockResolvedValueOnce({ zhuang_tai: 'jiu_xu', jiu_xu: true, kui: [] });
    const 仓 = createPinia();
    setActivePinia(仓);
    const 仓库 = 使用登录仓库();
    仓库.设置令牌('yi_deng_lu', false);
    const 路由器 = createRouter({ history: createMemoryHistory(), routes: 路由表 });
    await 路由器.push('/zhang-hao');
    await 路由器.isReady();
    const 包装 = mount(App, { global: { plugins: [仓, 路由器], stubs: { RouterView: true } } });
    const 错误条 = await 等待错误条(包装);

    expect(错误条.text()).toContain('系统尚未准备就绪');
    expect(错误条.get('[data-testid="cuo-wu-zhan-yao"]').text()).not.toContain('YI_LAI_QUE_SHI');
    expect(错误条.get('details').text()).toContain('YI_LAI_QUE_SHI');
    const 重试按钮 = 错误条.get('[data-testid="cuo-wu-chong-shi"]');
    await 重试按钮.trigger('click');
    await flushPromises();
    expect(就绪检查).toHaveBeenCalledTimes(2);
    await vi.waitFor(() => {
      expect(包装.find('[data-testid="ji-dui-jian-kong"]').exists()).toBe(false);
    });
  });
});
