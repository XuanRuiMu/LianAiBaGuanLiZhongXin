import { vi } from 'vitest';

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
