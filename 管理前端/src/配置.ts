export const 接口基地址: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:3100';

export const 令牌存储键 = 'guan_li_ling_pai';

export const 默认页码 = 1;

export const 默认每页条数 = 20;

export const 令牌长度上限 = 4000;

/** FP-03 登录三选项与记住账号的本地存储键；密码一律不落任何存储 */
export const 登录选项存储键 = 'guan_li_deng_lu_xuan_xiang';

export const 记住账号存储键 = 'guan_li_ji_zhu_zhang_hao';

export const 账号长度上限 = 32;

/** 续期节奏与本地轮询粒度独立于服务端 JWT 有效期，取保守档避免访问令牌先过期 */
export const 会话续期间隔毫秒 = 5 * 60 * 1000;

export const 会话检查间隔毫秒 = 60 * 1000;

export const 统计默认天数 = 30;

export const 时间展示格式 = 'YYYY-MM-DD HH:mm:ss' as const;

export const 消息条类名 = {
  'cuo-wu': '错误条',
  'cheng-gong': '成功条',
  kong: '空态',
  'jia-zai': '加载条',
} as const;

export const 气泡方位码 = {
  左: '左',
  右: '右',
  中: '中',
} as const;
