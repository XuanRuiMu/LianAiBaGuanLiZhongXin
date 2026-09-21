import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { nextTick } from 'vue';
import QueRenCeng from '../components/QueRenCeng.vue';
import { 通用文案 } from '../文案/通用';
import { 账号文案 } from '../文案/账号';
import { 使用登录仓库 } from '../stores/登录';
import { 路由表 } from '../router';

vi.mock('../api/管理', () => ({
  账号列表: vi.fn(),
  授予角色: vi.fn(),
  回收角色: vi.fn(),
  接管角色: vi.fn(),
  结束接管: vi.fn(),
}));

const 接口 = await import('../api/管理');

function 挂确认层(属性: Record<string, unknown> = {}): ReturnType<typeof mount> {
  return mount(QueRenCeng, {
    props: {
      xianShi: true,
      biaoTi: 通用文案.二次确认,
      zhengWen: 账号文案.高危二次确认,
      ...属性,
    },
    attachTo: document.body,
  });
}

async function 建路由(路径: string): Promise<Router> {
  const 路由器: Router = createRouter({ history: createMemoryHistory(), routes: 路由表 });
  await 路由器.push(路径);
  return 路由器;
}

async function 等离场(): Promise<void> {
  await flushPromises();
  const 截止 = Date.now() + 1000;
  while (document.querySelector('[data-testid="que-ren-ceng"]') !== null && Date.now() < 截止) {
    await new Promise((resolve) => setTimeout(resolve, 10));
    await nextTick();
  }
  await flushPromises();
}

async function 挂账号列表(): Promise<VueWrapper> {
  vi.mocked(接口.账号列表).mockResolvedValue({
    行: [{ ID: 'yi', 昵称: '甲', 手机号: '13800000000', 角色: null, 封禁级别: null, 创建时间: '2026-09-20 10:00:00' }],
    分页: undefined,
  });
  const { default: 页 } = await import('../views/账号列表.vue');
  const 包装 = mount(页, { global: { plugins: [await 建路由('/zhang-hao')] }, attachTo: document.body });
  await flushPromises();
  return 包装;
}

let 在挂包装: VueWrapper | null = null;

afterEach(() => {
  在挂包装?.unmount();
  在挂包装 = null;
  document.body.innerHTML = '';
});

beforeEach(() => {
  setActivePinia(createPinia());
  window.sessionStorage.clear();
  vi.clearAllMocks();
  使用登录仓库().设置身份('chao_guan', ['cha_kan', 'gao_we']);
});

describe('FP-05b 站内确认层组件', () => {
  it('打开时是模态对话框：role/aria-modal/aria-labelledby 与 aria-describedby 指向标题与正文', () => {
    const 包装 = 挂确认层();
    在挂包装 = 包装;
    const 框 = 包装.find('[role="dialog"]');
    expect(框.exists()).toBe(true);
    expect(框.attributes('aria-modal')).toBe('true');
    const 标题锚 = 框.attributes('aria-labelledby') ?? '';
    const 正文锚 = 框.attributes('aria-describedby') ?? '';
    expect(标题锚.length).toBeGreaterThan(0);
    expect(正文锚.length).toBeGreaterThan(0);
    expect(document.getElementById(标题锚)?.textContent?.trim()).toBe(通用文案.二次确认);
    expect(document.getElementById(正文锚)?.textContent?.trim()).toBe(账号文案.高危二次确认);
  });

  it('关闭态不渲染任何层节点，打开态渲染确认框与两个动作按钮', async () => {
    const 包装 = 挂确认层({ xianShi: false });
    在挂包装 = 包装;
    expect(包装.find('[role="dialog"]').exists()).toBe(false);
    await 包装.setProps({ xianShi: true });
    await nextTick();
    expect(包装.find('[role="dialog"]').exists()).toBe(true);
    expect(包装.find('[data-testid="que-ren-que-ren"]').exists()).toBe(true);
    expect(包装.find('[data-testid="que-ren-qu-xiao"]').exists()).toBe(true);
  });

  it('确认按钮只发 queRen，取消按钮只发 quXiao，未确认前不放行', async () => {
    const 包装 = 挂确认层();
    在挂包装 = 包装;
    await 包装.find('[data-testid="que-ren-qu-xiao"]').trigger('click');
    expect(包装.emitted('queRen')).toBeUndefined();
    expect(包装.emitted('quXiao')).toHaveLength(1);
    const 另一 = 挂确认层();
    在挂包装 = 另一;
    await 另一.find('[data-testid="que-ren-que-ren"]').trigger('click');
    expect(另一.emitted('quXiao')).toBeUndefined();
    expect(另一.emitted('queRen')).toHaveLength(1);
  });

  it('Esc 等同取消：keydown Escape 触发 quXiao 且不放行 queRen', async () => {
    const 包装 = 挂确认层();
    在挂包装 = 包装;
    await 包装.find('[role="dialog"]').trigger('keydown', { key: 'Escape' });
    expect(包装.emitted('quXiao')).toHaveLength(1);
    expect(包装.emitted('queRen')).toBeUndefined();
  });

  it('遮罩点击：非高危等于取消；高危点遮罩与点对话框内部都不触发任何事件', async () => {
    const 稳 = 挂确认层({ weiXian: false });
    在挂包装 = 稳;
    await 稳.find('.确认遮罩').trigger('click');
    expect(稳.emitted('quXiao')).toHaveLength(1);
    const 危 = 挂确认层({ weiXian: true });
    在挂包装 = 危;
    await 危.find('.确认遮罩').trigger('click');
    await 危.find('[role="dialog"]').trigger('click');
    expect(危.emitted('quXiao')).toBeUndefined();
    expect(危.emitted('queRen')).toBeUndefined();
  });

  it('打开即聚焦默认动作（确认按钮），关闭后焦点归还触发按钮', async () => {
    const 触发: HTMLElement = document.createElement('button');
    document.body.appendChild(触发);
    触发.focus();
    expect(document.activeElement).toBe(触发);
    const 包装 = 挂确认层();
    await nextTick();
    await flushPromises();
    expect(document.activeElement).toBe(包装.find('[data-testid="que-ren-que-ren"]').element);
    await 包装.setProps({ xianShi: false });
    await nextTick();
    await flushPromises();
    expect(document.activeElement).toBe(触发);
  });

  it('FP-10 DEF-3 高危层初始焦点落在取消按钮，确认钮不得是开窗落点', async () => {
    const 包装 = 挂确认层({ weiXian: true });
    在挂包装 = 包装;
    await nextTick();
    await flushPromises();
    expect(document.activeElement).toBe(包装.find('[data-testid="que-ren-qu-xiao"]').element);
    expect(document.activeElement).not.toBe(包装.find('[data-testid="que-ren-que-ren"]').element);
  });

  it('FP-10 DEF-3 非高危层初始焦点不变，仍是默认动作（确认按钮）', async () => {
    const 包装 = 挂确认层({ weiXian: false });
    在挂包装 = 包装;
    await nextTick();
    await flushPromises();
    expect(document.activeElement).toBe(包装.find('[data-testid="que-ren-que-ren"]').element);
  });

  it('FP-10 DEF-7 两个实例并存时 aria 锚点各自唯一，标题与正文互不串指', async () => {
    const 甲 = 挂确认层();
    在挂包装 = 甲;
    const 乙 = 挂确认层({ biaoTi: 通用文案.详情, zhengWen: 通用文案.操作列 });
    await nextTick();
    await flushPromises();
    const 框甲 = 甲.find('[role="dialog"]');
    const 框乙 = 乙.find('[role="dialog"]');
    const 锚甲 = [框甲.attributes('aria-labelledby') ?? '', 框甲.attributes('aria-describedby') ?? ''];
    const 锚乙 = [框乙.attributes('aria-labelledby') ?? '', 框乙.attributes('aria-describedby') ?? ''];
    for (const 锚 of 锚甲) {
      expect(锚.length).toBeGreaterThan(0);
      expect(锚乙).not.toContain(锚);
      expect(document.querySelectorAll(`[id="${锚}"]`)).toHaveLength(1);
    }
    expect(document.getElementById(锚甲[0])?.textContent?.trim()).toBe(通用文案.二次确认);
    expect(document.getElementById(锚甲[1])?.textContent?.trim()).toBe(账号文案.高危二次确认);
    expect(document.getElementById(锚乙[0])?.textContent?.trim()).toBe(通用文案.详情);
    expect(document.getElementById(锚乙[1])?.textContent?.trim()).toBe(通用文案.操作列);
    乙.unmount();
  });

  it('焦点圈定：Tab 从末位按钮回到首位，Shift+Tab 从首位绕到末位，始终留在层内', async () => {
    const 包装 = 挂确认层();
    await nextTick();
    await flushPromises();
    const 取消 = 包装.find('[data-testid="que-ren-qu-xiao"]').element as HTMLElement;
    const 确认 = 包装.find('[data-testid="que-ren-que-ren"]').element as HTMLElement;
    确认.focus();
    await 包装.find('[role="dialog"]').trigger('keydown', { key: 'Tab' });
    expect(document.activeElement).toBe(取消);
    await 包装.find('[role="dialog"]').trigger('keydown', { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(确认);
  });
});

describe('FP-05b 账号列表高危二次确认改走站内层', () => {
  it('点击授予只开窗不发包：确认层出现且授予角色零调用', async () => {
    const 包装 = await 挂账号列表();
    在挂包装 = 包装;
    await 包装.find('[data-testid="shou-yu-an-niu"]').trigger('click');
    await flushPromises();
    expect(包装.find('[data-testid="que-ren-ceng"]').exists()).toBe(true);
    expect(包装.text()).toContain(账号文案.高危二次确认);
    expect(接口.授予角色).not.toHaveBeenCalled();
    expect(接口.回收角色).not.toHaveBeenCalled();
  });

  it('层内确认：授予请求恰好一次且带 que_ren: true，层随即关闭', async () => {
    const 包装 = await 挂账号列表();
    在挂包装 = 包装;
    vi.mocked(接口.授予角色).mockResolvedValue(undefined as never);
    await 包装.find('[data-testid="shou-yu-an-niu"]').trigger('click');
    await flushPromises();
    await 包装.find('[data-testid="que-ren-que-ren"]').trigger('click');
    await flushPromises();
    expect(接口.授予角色).toHaveBeenCalledTimes(1);
    expect(vi.mocked(接口.授予角色).mock.calls[0][0]).toEqual({ yong_hu_id: 'yi', jiao_se: 'chao_guan', que_ren: true });
    await 等离场();
    expect(包装.find('[data-testid="que-ren-ceng"]').exists()).toBe(false);
  });

  it('取消与 Esc 都不发包且关层：回收路径与授予路径共用同一实现', async () => {
    const 包装 = await 挂账号列表();
    在挂包装 = 包装;
    await 包装.find('[data-testid="hui-shou-an-niu"]').trigger('click');
    await flushPromises();
    await 包装.find('[data-testid="que-ren-qu-xiao"]').trigger('click');
    await 等离场();
    expect(接口.回收角色).not.toHaveBeenCalled();
    expect(包装.find('[data-testid="que-ren-ceng"]').exists()).toBe(false);
    await 包装.find('[data-testid="hui-shou-an-niu"]').trigger('click');
    await flushPromises();
    await 包装.find('[role="dialog"]').trigger('keydown', { key: 'Escape' });
    await 等离场();
    expect(接口.回收角色).not.toHaveBeenCalled();
    expect(包装.find('[data-testid="que-ren-ceng"]').exists()).toBe(false);
    await 包装.find('[data-testid="hui-shou-an-niu"]').trigger('click');
    await flushPromises();
    vi.mocked(接口.回收角色).mockResolvedValue(undefined as never);
    await 包装.find('[data-testid="que-ren-que-ren"]').trigger('click');
    await flushPromises();
    expect(接口.回收角色).toHaveBeenCalledTimes(1);
    expect(vi.mocked(接口.回收角色).mock.calls[0][0]).toEqual({ yong_hu_id: 'yi', jiao_se: 'chao_guan', que_ren: true });
  });

  it('高危入口确认后焦点归还触发行按钮，与可高危隐藏门控不冲突', async () => {
    const 包装 = await 挂账号列表();
    在挂包装 = 包装;
    const 按钮 = 包装.find('[data-testid="shou-yu-an-niu"]').element as HTMLElement;
    按钮.focus();
    await 包装.find('[data-testid="shou-yu-an-niu"]').trigger('click');
    await flushPromises();
    vi.mocked(接口.授予角色).mockResolvedValue(undefined as never);
    await 包装.find('[data-testid="que-ren-qu-xiao"]').trigger('click');
    await flushPromises();
    await nextTick();
    expect(document.activeElement).toBe(按钮);
  });
});

describe('FP-05b 原生开窗死代码归零', () => {
  it('src 非测试代码里 confirm/alert/prompt 开窗调用为零（守卫防复发）', () => {
    const 命中: string[] = [];
    function 走(目录: string): void {
      for (const 名 of fs.readdirSync(目录)) {
        const 全 = `${目录}/${名}`;
        if (fs.statSync(全).isDirectory()) {
          if (名 !== '__tests__') {
            走(全);
          }
          continue;
        }
        if (!/\.(vue|ts)$/.test(名)) {
          continue;
        }
        const 源 = fs.readFileSync(全, 'utf8');
        for (const 匹配 of 源.matchAll(/\b(?:globalThis\.|window\.)?(?:confirm|alert|prompt)\s*\(/g)) {
          命中.push(`${全} → ${匹配[0]}`);
        }
      }
    }
    走('src');
    expect(命中).toEqual([]);
  });
});
