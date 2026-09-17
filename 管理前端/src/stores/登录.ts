import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { 令牌长度上限 } from '../配置';

function 读会话令牌(): string | null {
  if (typeof window === 'undefined' || typeof window.sessionStorage === 'undefined') {
    return null;
  }
  try {
    return window.sessionStorage.getItem('guan_li_hui_hua');
  } catch {
    return null;
  }
}

export function 读令牌(): string | null {
  return 读会话令牌();
}

function 存会话令牌(标识: string): void {
  if (typeof window === 'undefined' || typeof window.sessionStorage === 'undefined') {
    return;
  }
  try {
    window.sessionStorage.setItem('guan_li_hui_hua', 标识);
  } catch {
    return;
  }
}

export function 存令牌(_令牌: string): void {
  void _令牌;
}

export function 清除令牌(): void {
  if (typeof window === 'undefined' || typeof window.sessionStorage === 'undefined') {
    return;
  }
  try {
    window.sessionStorage.removeItem('guan_li_hui_hua');
  } catch {
    return;
  }
}

export function 规范令牌(原始: string): string | null {
  const 修剪 = 原始.trim();
  if (修剪.length === 0 || 修剪.length > 令牌长度上限) {
    return null;
  }
  return 修剪;
}

export const 使用登录仓库 = defineStore('登录', () => {
  const 会话标识 = ref<string | null>(读令牌());
  const 令牌 = computed(() => 会话标识.value);
  const 已登录 = computed(() => 会话标识.value !== null && 会话标识.value.length > 0);
  // YH-108 前端按权限渲染：管理角色三档，默认无权限，高危按钮仅超管可见
  const 管理角色 = ref<string | null>(null);
  const 是否超管 = computed(() => 管理角色.value === 'chao_guan');

  function 设置令牌(原始: string): boolean {
    const 规范 = 规范令牌(原始);
    if (规范 === null) {
      return false;
    }
    存会话令牌('yi_deng_lu');
    会话标识.value = 'yi_deng_lu';
    return true;
  }

  function 同步存储(): void {
    会话标识.value = 读令牌();
  }

  function 退出登录(): void {
    清除令牌();
    会话标识.value = null;
    管理角色.value = null;
  }

  function 设置角色(角色: string | null): void {
    管理角色.value = 角色;
  }

  return { 令牌, 会话标识, 已登录, 设置令牌, 同步存储, 退出登录, 管理角色, 是否超管, 设置角色 };
});
