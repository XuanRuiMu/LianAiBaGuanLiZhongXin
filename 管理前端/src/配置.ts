export const 接口基地址: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:3100';

export const 令牌存储键 = 'guan_li_ling_pai';

export const 默认页码 = 1;

export const 默认每页条数 = 20;

export const 令牌长度上限 = 4000;

export const 统计默认天数 = 30;
