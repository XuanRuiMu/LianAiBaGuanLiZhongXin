import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { 令牌长度上限 } from '../配置';

/** YH-108 三角色口径：角色与能力一律由服务端身份接口回传，前端只做入口隐藏，不作可信输入 */
export type 管理角色名 = 'chao_guan' | 'yun_ying' | 'shen_he_yuan';
/** FP-17 能力位与 管理后端/src/中间件/管理员.ts::GuanLiNengLi 同源（RBAC矩阵.test.ts 直读把守） */
export type 管理能力名 = 'cha_kan' | 'feng_jin' | 'feng_jin_shen_he' | 'tong_ji_xie' | 'gao_we';

const 会话键 = 'guan_li_hui_hua';
const 角色键 = 'guan_li_jiao_se';
const 能力键 = 'guan_li_neng_li';
const 角色白名单: readonly string[] = ['chao_guan', 'yun_ying', 'shen_he_yuan'];
const 能力白名单: readonly string[] = ['cha_kan', 'feng_jin', 'feng_jin_shen_he', 'tong_ji_xie', 'gao_we'];

function 读原始(键: string): string | null {
  if (typeof window === 'undefined' || typeof window.sessionStorage === 'undefined') {
    return null;
  }
  try {
    return window.sessionStorage.getItem(键);
  } catch {
    return null;
  }
}

function 写原始(键: string, 值: string | null): void {
  if (typeof window === 'undefined' || typeof window.sessionStorage === 'undefined') {
    return;
  }
  try {
    if (值 === null) {
      window.sessionStorage.removeItem(键);
      return;
    }
    window.sessionStorage.setItem(键, 值);
  } catch {
    return;
  }
}

export function 规范角色(原始: unknown): 管理角色名 | null {
  return typeof 原始 === 'string' && 角色白名单.includes(原始) ? (原始 as 管理角色名) : null;
}

export function 规范能力(原始: unknown): 管理能力名[] {
  if (!Array.isArray(原始)) {
    return [];
  }
  return 原始.filter((项): 项 is 管理能力名 => typeof 项 === 'string' && 能力白名单.includes(项));
}

function 读会话令牌(): string | null {
  return 读原始(会话键);
}

export function 读令牌(): string | null {
  return 读会话令牌();
}

function 存会话令牌(标识: string): void {
  写原始(会话键, 标识);
}

export function 存令牌(_令牌: string): void {
  void _令牌;
}

function 读角色(): 管理角色名 | null {
  return 规范角色(读原始(角色键));
}

function 读能力(): 管理能力名[] {
  const 存 = 读原始(能力键);
  if (存 === null) {
    return [];
  }
  try {
    return 规范能力(JSON.parse(存) as unknown);
  } catch {
    return [];
  }
}

export function 清除令牌(): void {
  写原始(会话键, null);
  写原始(角色键, null);
  写原始(能力键, null);
}

export function 规范令牌(原始: string): string | null {
  const 修剪 = 原始.trim();
  if (修剪.length === 0 || 修剪.length > 令牌长度上限) {
    return null;
  }
  return 修剪;
}

export const 使用登录仓库 = defineStore('deng-lu', () => {
  const 会话标识 = ref<string | null>(读令牌());
  const 令牌 = computed(() => 会话标识.value);
  const 已登录 = computed(() => 会话标识.value !== null && 会话标识.value.length > 0);
  const 管理角色 = ref<管理角色名 | null>(读角色());
  const 能力列表 = ref<管理能力名[]>(读能力());
  // FP-17 入口可见性一律由服务端能力位派生，与服务端门禁同读一张角色能力矩阵；服务端仍是唯一授权边界
  const 可高危 = computed(() => 能力列表.value.includes('gao_we'));
  const 可封禁 = computed(() => 能力列表.value.includes('feng_jin'));
  const 可封禁审核 = computed(() => 能力列表.value.includes('feng_jin_shen_he'));
  const 可统计 = computed(() => 能力列表.value.includes('tong_ji_xie'));
  const 可管理 = computed(() => 管理角色.value !== null);

  function 设置令牌(原始: string): boolean {
    const 规范 = 规范令牌(原始);
    if (规范 === null) {
      return false;
    }
    存会话令牌('yi_deng_lu');
    会话标识.value = 'yi_deng_lu';
    return true;
  }

  function 设置身份(角色: unknown, 能力: unknown): void {
    管理角色.value = 规范角色(角色);
    能力列表.value = 规范能力(能力);
    写原始(角色键, 管理角色.value);
    写原始(能力键, 管理角色.value === null ? null : JSON.stringify(能力列表.value));
  }

  function 同步存储(): void {
    会话标识.value = 读令牌();
    if (会话标识.value === null) {
      管理角色.value = null;
      能力列表.value = [];
      return;
    }
    管理角色.value = 读角色();
    能力列表.value = 读能力();
  }

  function 退出登录(): void {
    清除令牌();
    会话标识.value = null;
    管理角色.value = null;
    能力列表.value = [];
  }

  return {
    令牌,
    会话标识,
    已登录,
    设置令牌,
    同步存储,
    退出登录,
    管理角色,
    能力列表,
    可高危,
    可封禁,
    可封禁审核,
    可统计,
    可管理,
    设置身份,
  };
});
