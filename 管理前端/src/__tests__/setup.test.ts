import { afterEach, describe, expect, it, vi } from 'vitest';
import { config, mount } from '@vue/test-utils';
import { defineComponent } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import { 注册路由链接桩混入, 路由链接桩混入 } from './setup';

const 宿主 = defineComponent({ template: '<RouterLink to="/" />' });

afterEach(() => {
  vi.restoreAllMocks();
});

describe('测试初始化 RouterLink 桩组件', () => {
  it('真实路由覆盖桩时不重复注册全局组件', () => {
    const 警告 = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const 路由器 = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: 宿主 }],
    });
    const 包装 = mount(宿主, { global: { plugins: [路由器] } });

    expect(包装.get('a').attributes('href')).toBe('/');
    expect(警告).not.toHaveBeenCalled();
  });

  it('重复初始化仅保留一个桩混入且不影响真实路由', () => {
    const 初始 = config.global.mixins;
    const 一次 = 注册路由链接桩混入(初始);
    const 二次 = 注册路由链接桩混入(一次);
    const 三次 = 注册路由链接桩混入(二次);
    const 桩混入数 = (混入列表: typeof config.global.mixins): number =>
      混入列表.filter((混入) => 混入 === 路由链接桩混入).length;

    expect(桩混入数(初始)).toBe(1);
    expect(桩混入数(一次)).toBe(1);
    expect(桩混入数(二次)).toBe(1);
    expect(桩混入数(三次)).toBe(1);
    expect(mount(宿主).get('a').attributes('href')).toBe('/');
  });
});
