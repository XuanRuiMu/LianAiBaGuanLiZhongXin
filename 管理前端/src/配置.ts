export const 接口基地址: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:3100';

export const 令牌存储键 = 'guan_li_ling_pai';

export const 默认页码 = 1;

export const 默认每页条数 = 20;

export const 令牌长度上限 = 4000;

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
