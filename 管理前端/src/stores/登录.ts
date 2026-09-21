import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import {
  令牌长度上限,
  登录选项存储键,
  记住账号存储键,
  账号长度上限,
  会话续期间隔毫秒,
  会话检查间隔毫秒,
} from '../配置';
import { 刷新管理令牌, 管理登出 } from '../api/管理';
import { 是凭证失效错误 } from '../api/请求';

/** YH-108 三角色口径：角色与能力一律由服务端身份接口回传，前端只做入口隐藏，不作可信输入 */
export type 管理角色名 = 'chao_guan' | 'yun_ying' | 'shen_he_yuan';
/** FP-17 能力位与 管理后端/src/中间件/管理员.ts::GuanLiNengLi 同源（RBAC矩阵.test.ts 直读把守） */
export type 管理能力名 = 'cha_kan' | 'feng_jin' | 'feng_jin_shen_he' | 'tong_ji_xie' | 'gao_we';

/** FP-03 登录三选项：记住密码决定会话凭证是否跨浏览器重开，自动登录决定重开后是否需要一次点击 */
export type 登录选项 = {
  记住账号: boolean;
  记住密码: boolean;
  自动登录: boolean;
};

export const 默认登录选项: 登录选项 = { 记住账号: false, 记住密码: false, 自动登录: false };

const 会话键 = 'guan_li_hui_hua';
const 角色键 = 'guan_li_jiao_se';
const 能力键 = 'guan_li_neng_li';
const 会话标识值 = 'yi_deng_lu';
const 角色白名单: readonly string[] = ['chao_guan', 'yun_ying', 'shen_he_yuan'];
const 能力白名单: readonly string[] = ['cha_kan', 'feng_jin', 'feng_jin_shen_he', 'tong_ji_xie', 'gao_we'];

/**
 * FP-03 三选项的唯一归一点：记住密码=false ⇒ 自动登录=false 在初始化、勾选、取消、
 * 持久化回读四条路径上都只能经过这里，旁路任何一条都会让自动登录脱离记住密码。
 */
export function 归一登录选项(原始: unknown): 登录选项 {
  const 项 = (原始 ?? {}) as Record<string, unknown>;
  const 记住密码 = 项['记住密码'] === true;
  return {
    记住账号: 项['记住账号'] === true,
    记住密码,
    自动登录: 记住密码 && 项['自动登录'] === true,
  };
}

export function 勾选登录选项(当前: 登录选项, 改动: Partial<登录选项>): 登录选项 {
  return 归一登录选项({ ...当前, ...改动 });
}

function 取存储(持久: boolean): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return 持久 ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

function 读原始(键: string): string | null {
  const 存储 = 取存储(false);
  try {
    return 存储 === null ? null : 存储.getItem(键);
  } catch {
    return null;
  }
}

function 写原始(键: string, 值: string | null): void {
  写持久原始(键, 值, false);
}

function 写持久原始(键: string, 值: string | null, 持久: boolean): void {
  const 存储 = 取存储(持久);
  if (存储 === null) {
    return;
  }
  try {
    if (值 === null) {
      存储.removeItem(键);
      return;
    }
    存储.setItem(键, 值);
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

function 读持久原始(键: string): string | null {
  const 存储 = 取存储(true);
  try {
    return 存储 === null ? null : 存储.getItem(键);
  } catch {
    return null;
  }
}

export function 读令牌(): string | null {
  return 读会话令牌() ?? 读持久原始(会话键);
}

/**
 * FP-03 会话标记能否放行路由：本次浏览器已经过登录流程（sessionStorage 有标记）即放行；
 * 只剩跨重开的持久标记时，勾了自动登录才免登录进入。
 */
export function 可免登录进入(): boolean {
  if (读会话令牌() !== null) {
    return true;
  }
  return 读持久原始(会话键) !== null && 读登录选项().自动登录;
}

export function 持久令牌冷启动(): boolean {
  return 读会话令牌() === null && 读持久原始(会话键) !== null;
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
  for (const 键 of [会话键, 角色键, 能力键]) {
    写原始(键, null);
  }
  写持久原始(会话键, null, true);
}

export function 规范令牌(原始: string): string | null {
  const 修剪 = 原始.trim();
  if (修剪.length === 0 || 修剪.length > 令牌长度上限) {
    return null;
  }
  return 修剪;
}

export function 读登录选项(): 登录选项 {
  const 存 = 读持久原始(登录选项存储键);
  if (存 === null) {
    return { ...默认登录选项 };
  }
  try {
    return 归一登录选项(JSON.parse(存) as unknown);
  } catch {
    return { ...默认登录选项 };
  }
}

export function 写登录选项(选项: 登录选项): 登录选项 {
  const 规范 = 归一登录选项(选项);
  写持久原始(登录选项存储键, JSON.stringify(规范), true);
  return 规范;
}

export function 读记住账号(): string {
  const 存 = 读持久原始(记住账号存储键);
  if (存 === null || 存.length === 0 || 存.length > 账号长度上限) {
    return '';
  }
  return 存;
}

export function 写记住账号(手机号: string): void {
  const 修剪 = 手机号.trim().slice(0, 账号长度上限);
  写持久原始(记住账号存储键, 修剪.length > 0 ? 修剪 : null, true);
}

export const 使用登录仓库 = defineStore('deng-lu', () => {
  const 会话标识 = ref<string | null>(读令牌());
  const 令牌 = computed(() => 会话标识.value);
  const 已登录 = computed(() => 会话标识.value !== null && 会话标识.value.length > 0);
  const 管理角色 = ref<管理角色名 | null>(读角色());
  const 能力列表 = ref<管理能力名[]>(读能力());
  const 上次签发毫秒 = ref(Date.now());
  // FP-17 入口可见性一律由服务端能力位派生，与服务端门禁同读一张角色能力矩阵；服务端仍是唯一授权边界
  const 可高危 = computed(() => 能力列表.value.includes('gao_we'));
  const 可封禁 = computed(() => 能力列表.value.includes('feng_jin'));
  const 可封禁审核 = computed(() => 能力列表.value.includes('feng_jin_shen_he'));
  const 可统计 = computed(() => 能力列表.value.includes('tong_ji_xie'));
  const 可管理 = computed(() => 管理角色.value !== null);
  let 续期在途: Promise<boolean> | null = null;
  let 冷启动已续期 = false;

  function 冷启动会话(): Promise<boolean> {
    if (冷启动已续期) {
      return Promise.resolve(已登录.value);
    }
    冷启动已续期 = true;
    return 续期会话();
  }

  function 设置令牌(原始: string, 持久会话 = false): boolean {
    const 规范 = 规范令牌(原始);
    if (规范 === null) {
      return false;
    }
    写原始(会话键, 会话标识值);
    写持久原始(会话键, 持久会话 ? 会话标识值 : null, true);
    会话标识.value = 会话标识值;
    上次签发毫秒.value = Date.now();
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

  function 需要续期(现在毫秒: number): boolean {
    return 现在毫秒 - 上次签发毫秒.value >= 会话续期间隔毫秒;
  }

  /**
   * FP-03 续期单飞：/shua-xin 是一次性轮换，同一浏览器并发两次第二次必 401，
   * 所以冷启动、定时器、路由三个触发点都只能复用这一个在途 Promise。
   */
  function 续期会话(): Promise<boolean> {
    if (续期在途 !== null) {
      return 续期在途;
    }
    if (读令牌() === null) {
      return Promise.resolve(false);
    }
    const 一次 = 轮换会话();
    续期在途 = 一次;
    return 一次;
  }

  async function 轮换会话(): Promise<boolean> {
    try {
      const 结果 = await 刷新管理令牌();
      上次签发毫秒.value = Date.now();
      设置身份(结果.jiao_se, 结果.neng_li);
      return true;
    } catch (错误) {
      // 429 与网络抖动不清会话：服务端没有否定本次凭证，清掉反而把管理员踢回登录页
      if (是凭证失效错误(错误)) {
        退出登录();
      }
      return false;
    } finally {
      续期在途 = null;
    }
  }

  function 退出登录(): void {
    清除令牌();
    会话标识.value = null;
    管理角色.value = null;
    能力列表.value = [];
  }

  /** 服务端吊销先做，但任何失败都必须让调用方继续清本地标记，不能让管理员卡在已登录态 */
  async function 注销会话(): Promise<boolean> {
    try {
      await 管理登出();
      return true;
    } catch {
      return false;
    }
  }

  let 巡查定时器: ReturnType<typeof setInterval> | undefined;

  function 巡查会话(): void {
    if (已登录.value && 需要续期(Date.now())) {
      void 续期会话();
    }
  }

  /** 长驻标签页也要在访问令牌到点前续上，巡查只走单飞入口 */
  function 启动续期巡查(): void {
    if (巡查定时器 !== undefined) {
      return;
    }
    巡查定时器 = setInterval(巡查会话, 会话检查间隔毫秒);
  }

  function 停止续期巡查(): void {
    if (巡查定时器 !== undefined) {
      clearInterval(巡查定时器);
      巡查定时器 = undefined;
    }
  }

  return {
    令牌,
    会话标识,
    已登录,
    设置令牌,
    同步存储,
    退出登录,
    注销会话,
    续期会话,
    冷启动会话,
    需要续期,
    启动续期巡查,
    停止续期巡查,
    上次签发毫秒,
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
