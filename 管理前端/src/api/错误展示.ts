import { ref } from 'vue';
import { 业务错误, 创建前端错误, 前端错误码 } from './请求';
import { 通用文案 } from '../文案/通用';

export type 错误展示 = {
  消息: string;
  错误码: string;
  影响: string;
  下一步: string;
  详情: string;
  可重试: boolean;
  可重试延迟毫秒?: number;
  追踪编号: string;
  字段错误: Readonly<Record<string, string>>;
};

const 前端错误码集合 = new Set<string>(Object.values(前端错误码));
const 已知服务端错误码 = new Set([
  'WEI_SHOU_QUAN',
  'LING_PAI_WU_XIAO',
  'WU_GUAN_LI_QUAN_XIAN',
  'YUAN_DI_ZHI_JU_JUE',
  'XU_JIA_MI_TONG_DAO',
  'CAN_SHU_CUO_WU',
  'XU_YAO_QUE_REN',
  'XU_SHEN_PI_DAN',
  'WEI_ZHAO_DAO',
  'WU_DAI_SHEN_SHEN_SU',
  'SHEN_HE_DUI_XIANG_YI_BIAN',
  'XIAN_LIU',
  'BIAO_QUE_SHI_JIANG_JI',
  'MO_SHI_QUE_SHI',
  'SHU_JU_KU_CUO_WU',
  'YI_LAI_QUE_SHI',
  'HUAN_CUN_BU_KE_YONG',
  'NEI_BU_CUO_WU',
]);
const 前端消息: Record<string, string> = {
  [前端错误码.传输中断]: 通用文案.网络中断,
  [前端错误码.请求超时]: 通用文案.请求超时,
  [前端错误码.非包络响应]: 通用文案.响应格式异常,
};

export function 是已知服务端错误码(码: string): boolean {
  return 已知服务端错误码.has(码);
}

function 取指引类别(错误码: string): string | undefined {
  if (错误码.startsWith('WEI_SHOU') || 错误码.startsWith('LING_PAI')) {
    return 通用文案.重新登录后重试;
  }
  if (错误码.startsWith('WU_GUAN') || 错误码.startsWith('YUAN_DI') || 错误码.startsWith('XU_JIA')) {
    return 通用文案.切换权限账号;
  }
  // XU_YAO（需再次确认）可重试：必须先确认再重试当前操作，不能落到「按提示修正后重新提交」的字段口径
  if (错误码.startsWith('XU_YAO')) {
    return 通用文案.确认后重试;
  }
  if (错误码.startsWith('CAN_SHU') || 错误码.startsWith('XU_SHEN')) {
    return 通用文案.修正后重试;
  }
  if (错误码.startsWith('WEI_ZHAO') || 错误码.startsWith('WU_DAI') || 错误码.startsWith('SHEN_HE')) {
    return 通用文案.刷新后重试;
  }
  return undefined;
}

function 是安全中文消息(文本: string): boolean {
  const 剩余 = 文本.replace(/IP|AI/gi, '');
  return /[㐀-鿿]/u.test(剩余) && !/[A-Za-z]/.test(剩余);
}

function 取指引(错误码: string, 可重试: boolean, 可重试延迟毫秒: number | undefined): [string, string] {
  if (!是已知服务端错误码(错误码) && !前端错误码集合.has(错误码)) {
    return [通用文案.数据未更新, 通用文案.稍后重试];
  }
  const 指引 = 取指引类别(错误码);
  if (指引 !== undefined) {
    return [通用文案.操作未执行, 指引];
  }
  if (可重试) {
    return [
      通用文案.数据未更新,
      可重试延迟毫秒 === undefined
        ? 通用文案.稍后重试
        : 通用文案.等待后重试.replace(/\{[^}]+\}/, String(Math.max(0, Math.round((可重试延迟毫秒 / 1000) * 10) / 10))),
    ];
  }
  return [通用文案.操作未执行, 通用文案.修正后重试];
}

function 取字段错误(值: Record<string, string> | undefined): Record<string, string> {
  const 结果: Record<string, string> = {};
  if (值 !== undefined) {
    for (const [键, 文本] of Object.entries(值)) {
      结果[键] = typeof 文本 === 'string' && 是安全中文消息(文本) ? 文本 : 通用文案.请求失败;
    }
  }
  return 结果;
}

export function 取错误展示(错误: unknown): 错误展示 {
  const 业务 = 错误 instanceof 业务错误
    ? 错误
    : 创建前端错误(通用文案.请求失败, 前端错误码.未归类, true);
  const 已知消息 = 是已知服务端错误码(业务.code) || 前端错误码集合.has(业务.code);
  const 消息 = 已知消息 && 是安全中文消息(业务.message)
    ? 业务.message
    : 已知消息
      ? 前端消息[业务.code] ?? 通用文案.请求失败
      : 通用文案.请求失败;
  const [影响, 下一步] = 取指引(业务.code, 业务.retryable, 业务.retryAfterMs);
  return {
    消息,
    错误码: 业务.code,
    影响,
    下一步,
    详情: `${通用文案.错误影响}：${影响}；${通用文案.错误下一步}：${下一步}；${通用文案.错误可重试}：${业务.retryable ? 通用文案.可重试 : 通用文案.不可重试}；${通用文案.错误追踪编号}：${业务.traceId}`,
    可重试: 业务.retryable,
    可重试延迟毫秒: 业务.retryAfterMs,
    追踪编号: 业务.traceId,
    字段错误: 取字段错误(业务.fieldErrors as Record<string, string> | undefined),
  };
}

/** 后端 message 常自带句末标点；拼固定前缀前先削掉，摘要最多留一个分隔符 */
export function 归一句末标点(文本: string): string {
  return 文本.replace(/[。！？；，、\s]+$/u, '');
}

export function 拼错误摘要(展示: 错误展示): string {
  return `${归一句末标点(展示.消息)}；${通用文案.错误影响}：${展示.影响}；${通用文案.错误下一步}：${展示.下一步}`;
}

export function 拼错误详情(展示: 错误展示): string {
  return `${通用文案.详情}：${归一句末标点(展示.消息)}；${通用文案.错误码}${展示.错误码}；${展示.详情}`;
}

export function 创建请求展示闸门(): {
  开始: () => number;
  可更新: (批次: number) => boolean;
  作废: () => void;
} {
  let 当前批次 = 0;
  return {
    开始: () => {
      当前批次 += 1;
      return 当前批次;
    },
    可更新: (批次: number) => 批次 === 当前批次,
    作废: () => {
      当前批次 += 1;
    },
  };
}

export async function 执行请求<T>(
  状态: ReturnType<typeof 创建请求错误状态>,
  加载中: { value: boolean } | undefined,
  任务: () => Promise<T>,
  成功: (结果: T) => void | Promise<void>,
  重试: () => Promise<void>,
): Promise<void> {
  const 批次 = 状态.错误闸门.开始();
  状态.清空();
  if (加载中 !== undefined) {
    加载中.value = true;
  }
  try {
    const 结果 = await 任务();
    if (状态.错误闸门.可更新(批次)) {
      await 成功(结果);
    }
  } catch (错误) {
    状态.显示(错误, 批次, 重试);
  } finally {
    if (加载中 !== undefined && 状态.错误闸门.可更新(批次)) {
      加载中.value = false;
    }
  }
}

export function 创建请求错误状态() {
  const 当前错误 = ref<错误展示 | null>(null);
  const 重试动作 = ref<(() => Promise<void>) | null>(null);
  const 等待剩余毫秒 = ref(0);
  const 重试中 = ref(false);
  const 错误闸门 = 创建请求展示闸门();
  let 等待计时器: ReturnType<typeof setInterval> | undefined;

  function 停止等待(): void {
    if (等待计时器 !== undefined) {
      clearInterval(等待计时器);
      等待计时器 = undefined;
    }
    等待剩余毫秒.value = 0;
  }

  function 开始等待(毫秒: number | undefined): void {
    停止等待();
    if (毫秒 === undefined || 毫秒 <= 0) {
      return;
    }
    const 截止毫秒 = Date.now() + 毫秒;
    等待剩余毫秒.value = 毫秒;
    等待计时器 = setInterval(() => {
      const 剩余 = Math.max(0, 截止毫秒 - Date.now());
      等待剩余毫秒.value = 剩余;
      if (剩余 === 0) {
        停止等待();
      }
    }, 100);
  }

  function 清空(错误?: unknown): void {
    停止等待();
    当前错误.value = 错误 === undefined ? null : 取错误展示(错误);
    重试动作.value = null;
  }

  function 显示(错误: unknown, 批次: number, 重试动作值: () => Promise<void>): void {
    if (!错误闸门.可更新(批次)) {
      return;
    }
    const 展示 = 取错误展示(错误);
    当前错误.value = 展示;
    重试动作.value = 展示.可重试 ? 重试动作值 : null;
    开始等待(展示.可重试延迟毫秒);
  }

  function 重试当前(): void {
    const 动作 = 重试动作.value;
    if (动作 === null || 重试中.value || 等待剩余毫秒.value > 0) {
      return;
    }
    重试中.value = true;
    void (async () => {
      try {
        await 动作();
      } finally {
        重试中.value = false;
      }
    })();
  }

  return {
    当前错误,
    错误闸门,
    等待剩余毫秒,
    重试中,
    清空,
    显示,
    重试: 重试当前,
    作废: () => {
      停止等待();
      错误闸门.作废();
    },
  };
}

export type 请求错误状态 = ReturnType<typeof 创建请求错误状态>;
