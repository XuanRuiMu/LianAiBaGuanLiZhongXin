import { 解析包络, 请求实例, type 响应包装 } from './请求';

export type 管理登录请求 = {
  shou_ji_hao: string;
  mi_ma: string;
  chi_jiu_hui_hua: boolean;
};

export type 注销结果 = {
  yi_tui_chu: boolean;
};

export type 管理登录结果 = {
  ling_pai?: string;
  shua_xin_ling_pai?: string;
  yong_hu_id: string;
  yong_hu_ming: string | null;
  jiao_se: string | null;
  neng_li: string[];
};

export type 当前身份 = {
  yong_hu_id: string;
  jiao_se: string | null;
  neng_li: string[];
};

export async function 管理登录(正文: 管理登录请求): Promise<管理登录结果> {
  const 响应: 响应包装 = await 请求实例.post('/api/guan-li/deng-lu', 正文);
  return 解析包络<管理登录结果>(响应.data).数据;
}

export async function 我的身份(): Promise<当前身份> {
  const 响应: 响应包装 = await 请求实例.get('/api/guan-li/wo-de-jiao-se');
  return 解析包络<当前身份>(响应.data).数据;
}

export async function 刷新管理令牌(刷新令牌?: string): Promise<管理登录结果> {
  const 响应: 响应包装 = await 请求实例.post(
    '/api/guan-li/shua-xin',
    刷新令牌 === undefined ? {} : { shua_xin_ling_pai: 刷新令牌 },
    { buTuiDengLu: true },
  );
  return 解析包络<管理登录结果>(响应.data).数据;
}

export async function 管理登出(): Promise<注销结果> {
  const 响应: 响应包装 = await 请求实例.post('/api/guan-li/tui-chu', {}, { buTuiDengLu: true });
  return 解析包络<注销结果>(响应.data).数据;
}
