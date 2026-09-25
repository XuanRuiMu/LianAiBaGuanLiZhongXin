import { vi } from 'vitest';
import { config } from '@vue/test-utils';
import { defineComponent, h, type ComponentPublicInstance } from 'vue';

const 路由链接桩 = defineComponent({
  name: 'RouterLink',
  props: { to: { type: String, required: true } },
  setup(属性, { slots }) {
    return () => h('a', { href: 属性.to }, slots.default?.());
  },
});

export const 路由链接桩组件名 = 'RouterLink';

export const 路由链接桩混入 = {
  beforeCreate(this: ComponentPublicInstance): void {
    const 应用 = this.$.appContext.app;
    if (!应用.component(路由链接桩组件名)) {
      应用.component(路由链接桩组件名, 路由链接桩);
    }
  },
};

export function 注册路由链接桩混入(混入列表: typeof config.global.mixins): typeof config.global.mixins {
  return [...混入列表.filter((混入) => 混入 !== 路由链接桩混入), 路由链接桩混入];
}

config.global.mixins = 注册路由链接桩混入(config.global.mixins);
config.global.stubs = { ...config.global.stubs, transition: false, 'transition-group': false };

class NeiCunCunChu implements Storage {
  private 数据 = new Map<string, string>();

  get length(): number {
    return this.数据.size;
  }

  clear(): void {
    this.数据.clear();
  }

  getItem(键: string): string | null {
    return this.数据.get(键) ?? null;
  }

  key(序号: number): string | null {
    return Array.from(this.数据.keys())[序号] ?? null;
  }

  removeItem(键: string): void {
    this.数据.delete(键);
  }

  setItem(键: string, 值: string): void {
    this.数据.set(键, 值);
  }
}

const 内存存储 = new NeiCunCunChu();

Object.defineProperty(globalThis, 'localStorage', {
  value: 内存存储,
  writable: true,
  configurable: true,
});

vi.stubGlobal('localStorage', 内存存储);

vi.stubGlobal(
  'matchMedia',
  (查询: string): MediaQueryList =>
    ({
      matches: false,
      media: 查询,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList,
);
