import type { AxiosResponse } from 'axios';
import { 解析包络, 请求实例, type 分页信息 } from './请求';

export type 分页查询 = {
  ye_ma?: number;
  mei_ye_tiao_shu?: number;
};

export type 列表结果<行> = {
  行: 行[];
  分页?: 分页信息;
};

export type 表格行 = Record<string, unknown>;

export type 账号查询 = 分页查询 & {
  guan_jian_ci?: string;
  shou_ji_hao?: string;
};

export type 聊天查询 = 分页查询 & {
  yong_hu_id?: string;
  jiao_se_id?: string;
  fa_song_fang?: string;
  kai_shi_shi_jian?: string;
  jie_shu_shi_jian?: string;
  pai_xu?: string;
};

export type 好友聊天查询 = 分页查询 & {
  fa_song_zhe_id?: string;
  jie_shou_zhe_id?: string;
  kai_shi_shi_jian?: string;
  jie_shu_shi_jian?: string;
};

export type 思考查询 = 分页查询 & {
  yong_hu_id?: string;
  jiao_se_id?: string;
};

export type 接管记录查询 = 分页查询 & {
  guan_li_yuan_id?: string;
  jiao_se_id?: string;
};

export type 封禁记录查询 = 分页查询 & {
  ip?: string;
};

export type 思考记录查询 = 分页查询 & {
  yong_hu_id?: string;
  jiao_se_id?: string;
  shi_jian?: string;
};

export type 思考记录行 = 表格行 & {
  摘要?: unknown;
  原文长度?: unknown;
};

export type 封禁写入 = {
  yong_hu_id?: string;
  ip?: string;
  yuan_yin: string;
  ji_bie?: string;
  yan_zhong_cheng_du?: string;
  jie_feng_shi_jian?: string;
};

export type 审计查询 = 分页查询 & {
  shi_jian_lei_xing?: string;
  yong_hu_id?: string;
  lei_xing?: string;
  kai_shi_shi_jian?: string;
  jie_shu_shi_jian?: string;
};

export type 思考说明 = {
  you_du_li_si_kao_chi_jiu_hua_biao: boolean;
  sheng_ming: string;
  hui_fang_zhun_ze: string;
  shi_shi_shi_jian: string[];
  shi_shi_shuo_ming: string;
  dan_tiao_jie_duan_zi_fu_shu: number;
  yi_chi_jiu_hua_cha_xun: string[];
  dai_bu_chong_shuo_ming: string;
  dai_bu_chong: string[];
};

export type 健康状态 = {
  zhuang_tai: string;
  shi_jian: string;
};

export type 就绪状态 = {
  zhuang_tai: string;
  jiu_xu: boolean;
  kui: string[];
};

export type 指标状态 = Record<string, unknown>;

export type 审核查询 = 分页查询 & {
  zhuang_tai?: string;
  chao_shi?: string;
};

export type 审核新建 = {
  bei_ju_bao_yong_hu_id?: string;
  bei_ju_bao_nei_rong_id?: string;
  yuan_yin?: string;
  biao_ti?: string;
  nei_rong?: string;
  ming_cheng?: string;
  miao_shu?: string;
  you_xian_ji?: string;
  zhi_pai_ren_id?: string;
  ding_shi_fa_bu?: string;
  kai_shi_shi_jian?: string;
  jie_shu_shi_jian?: string;
  hu_chi_zu?: string;
};

export type 审核评审 = {
  mu_biao_id: string;
  tong_guo: boolean;
  bei_zhu?: string;
};

export type 审核多项处理 = {
  mu_biao_ids: string[];
  lun_ci: string;
  tong_guo: boolean;
};

export type 处理记录查询 = 分页查询 & {
  mu_biao_lei_xing?: string;
  mu_biao_id?: string;
};

export type 封禁写入结果 = {
  yi_chu_li: boolean;
};

async function 取列表<行>(
  路径: string,
  查询: Record<string, string | number | boolean | undefined> = {},
): Promise<列表结果<行>> {
  const 响应: AxiosResponse = await 请求实例.get(路径, { params: 查询 });
  const 解析 = 解析包络<行[]>(响应.data);
  return { 行: 解析.数据, 分页: 解析.分页 };
}

async function 取详情<行>(路径: string, 查询: Record<string, string | number | boolean | undefined> = {}): Promise<行> {
  const 响应: AxiosResponse = await 请求实例.get(路径, { params: 查询 });
  return 解析包络<行>(响应.data).数据;
}

export function 健康检查(): Promise<健康状态> {
  return 取详情<健康状态>('/api/jian-kang');
}

export function 账号列表(查询: 账号查询 = {}): Promise<列表结果<表格行>> {
  return 取列表<表格行>('/api/guan-li/zhang-hao-lie-biao', { ...查询 });
}

export function 账号详情(用户编号: string): Promise<表格行> {
  return 取详情<表格行>(`/api/guan-li/zhang-hao-xiang-qing/${用户编号}`);
}

export function 聊天消息(查询: 聊天查询 = {}): Promise<列表结果<表格行>> {
  return 取列表<表格行>('/api/guan-li/xiao-xi', { ...查询 });
}

export function 好友消息(查询: 好友聊天查询 = {}): Promise<列表结果<表格行>> {
  return 取列表<表格行>('/api/guan-li/hao-you-xiao-xi', { ...查询 });
}

export function 记忆列表(查询: 思考查询 = {}): Promise<列表结果<表格行>> {
  return 取列表<表格行>('/api/guan-li/ji-yi', { ...查询 });
}

export function 对话摘要列表(查询: 思考查询 = {}): Promise<列表结果<表格行>> {
  return 取列表<表格行>('/api/guan-li/dui-hua-zhai-yao', { ...查询 });
}

export function 关键事件列表(查询: 思考查询 = {}): Promise<列表结果<表格行>> {
  return 取列表<表格行>('/api/guan-li/guan-jian-shi-jian', { ...查询 });
}

export function 接管记录列表(查询: 接管记录查询 = {}): Promise<列表结果<表格行>> {
  return 取列表<表格行>('/api/guan-li/duo-she-ri-zhi', { ...查询 });
}

export function 评估列表(查询: 思考查询 = {}): Promise<列表结果<表格行>> {
  return 取列表<表格行>('/api/guan-li/ping-gu', { ...查询 });
}

export function 思考记录列表(查询: 思考记录查询 = {}): Promise<列表结果<思考记录行>> {
  return 取列表<思考记录行>('/api/guan-li/si-kao-ji-lu', { ...查询 });
}

export function 思考记录详情(记录编号: string): Promise<思考记录行> {
  return 取详情<思考记录行>(`/api/guan-li/si-kao-ji-lu/${记录编号}`);
}

export function 思考说明(): Promise<思考说明> {
  return 取详情<思考说明>('/api/guan-li/si-kao-shuo-ming');
}

export function 封禁记录(查询: 封禁记录查询 = {}): Promise<列表结果<表格行>> {
  return 取列表<表格行>('/api/guan-li/feng-jin-ji-lu', { ...查询 });
}

export async function 写入封禁(正文: 封禁写入): Promise<封禁写入结果> {
  const 响应: AxiosResponse = await 请求实例.post('/api/guan-li/feng-jin', 正文);
  return 解析包络<封禁写入结果>(响应.data).数据;
}

export type 管理登录请求 = {
  shou_ji_hao: string;
  mi_ma: string;
  /** FP-03「记住密码」：true 时服务端签发持久刷新 Cookie，会话跨浏览器重开仍然有效 */
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
  // YH-108 三角色口径：登录回传角色标识与服务端能力位，而非管理员二值旗标
  jiao_se: string | null;
  neng_li: string[];
};

export type 当前身份 = {
  yong_hu_id: string;
  jiao_se: string | null;
  neng_li: string[];
};

export async function 管理登录(正文: 管理登录请求): Promise<管理登录结果> {
  const 响应: AxiosResponse = await 请求实例.post('/api/guan-li/deng-lu', 正文);
  return 解析包络<管理登录结果>(响应.data).数据;
}

/** YH-108 身份以服务端查库结果为准，供刷新页面后重建权限视图 */
export async function 我的身份(): Promise<当前身份> {
  const 响应: AxiosResponse = await 请求实例.get('/api/guan-li/wo-de-jiao-se');
  return 解析包络<当前身份>(响应.data).数据;
}

/** 刷新号在 httpOnly Cookie 里，前端读不到：缺省不发正文键，由 Cookie 承载 */
export async function 刷新管理令牌(刷新令牌?: string): Promise<管理登录结果> {
  const 响应: AxiosResponse = await 请求实例.post(
    '/api/guan-li/shua-xin',
    刷新令牌 === undefined ? {} : { shua_xin_ling_pai: 刷新令牌 },
    { buTuiDengLu: true },
  );
  return 解析包络<管理登录结果>(响应.data).数据;
}

export async function 管理登出(): Promise<注销结果> {
  const 响应: AxiosResponse = await 请求实例.post('/api/guan-li/tui-chu', {}, { buTuiDengLu: true });
  return 解析包络<注销结果>(响应.data).数据;
}

export type 编号请求 = {
  yong_hu_id: string;
  que_ren?: boolean;
  jiao_se?: string;
};

export type 角色请求 = {
  jiao_se_id: string;
};

export async function 授予角色(正文: 编号请求): Promise<封禁写入结果> {
  const 响应: AxiosResponse = await 请求实例.post('/api/guan-li/shou-quan', 正文);
  return 解析包络<封禁写入结果>(响应.data).数据;
}

export async function 回收角色(正文: 编号请求): Promise<封禁写入结果> {
  const 响应: AxiosResponse = await 请求实例.post('/api/guan-li/hui-shou', 正文);
  return 解析包络<封禁写入结果>(响应.data).数据;
}

export async function 接管角色(正文: 角色请求): Promise<封禁写入结果> {
  const 响应: AxiosResponse = await 请求实例.post('/api/guan-li/duo-she', 正文);
  return 解析包络<封禁写入结果>(响应.data).数据;
}

export async function 结束接管(正文: 角色请求): Promise<封禁写入结果> {
  const 响应: AxiosResponse = await 请求实例.post('/api/guan-li/gui-huan', 正文);
  return 解析包络<封禁写入结果>(响应.data).数据;
}

export async function 账号封禁列表(查询: 分页查询 & { ji_bie?: string; shen_su?: string } = {}): Promise<列表结果<表格行>> {
  return 取列表<表格行>('/api/guan-li/zhang-hao-feng-jin', { ...查询 });
}

export async function 解封账号(正文: 编号请求): Promise<封禁写入结果> {
  const 响应: AxiosResponse = await 请求实例.post('/api/guan-li/zhang-hao-feng-jin/jie-feng', 正文);
  return 解析包络<封禁写入结果>(响应.data).数据;
}

export async function 审核申诉(正文: 编号请求 & { tong_guo: boolean }): Promise<封禁写入结果> {
  const 响应: AxiosResponse = await 请求实例.post('/api/guan-li/shen-su/shen-he', 正文);
  return 解析包络<封禁写入结果>(响应.data).数据;
}

export function 审计日志(查询: 审计查询 = {}): Promise<列表结果<表格行>> {
  return 取列表<表格行>('/api/guan-li/shen-ji-ri-zhi', { ...查询 });
}

export function 注册统计(天数?: number): Promise<表格行> {
  return 取详情<表格行>('/api/guan-li/tong-ji/zhu-ce', { tian_shu: 天数 });
}

export function 消息统计(天数?: number): Promise<表格行> {
  return 取详情<表格行>('/api/guan-li/tong-ji/xiao-xi', { tian_shu: 天数 });
}

export function 好感度统计(): Promise<表格行> {
  return 取详情<表格行>('/api/guan-li/tong-ji/hao-gan-du');
}

export function 留存统计(天数?: number): Promise<表格行> {
  return 取详情<表格行>('/api/guan-li/tong-ji/liu-cun', { tian_shu: 天数 });
}

export function 用量统计(): Promise<表格行> {
  return 取详情<表格行>('/api/guan-li/tong-ji/ai-yong-liang');
}

export function 埋点字典(): Promise<表格行> {
  return 取详情<表格行>('/api/guan-li/tong-ji/mai-dian-zi-dian');
}

export function 审计保留(): Promise<表格行> {
  return 取详情<表格行>('/api/guan-li/shen-ji-bao-liu');
}

export function 就绪检查(): Promise<就绪状态> {
  return 取详情<就绪状态>('/api/ready');
}

export function 指标概览(): Promise<指标状态> {
  return 取详情<指标状态>('/api/zhi-biao');
}

const 审核路径段: Record<string, string> = {
  ju_bao: 'ju-bao',
  gong_dan: 'gong-dan',
  gong_gao: 'gong-gao',
  huo_dong: 'huo-dong',
  shi_yan: 'shi-yan',
};

export function 审核列表(目标类型: string, 查询: 审核查询 = {}): Promise<列表结果<表格行>> {
  const 路径段 = 审核路径段[目标类型] ?? 目标类型;
  return 取列表<表格行>(`/api/guan-li/${路径段}-lie-biao`, { ...查询 });
}

export async function 审核新建(目标类型: string, 正文: 审核新建): Promise<表格行> {
  const 路径段 = 审核路径段[目标类型] ?? 目标类型;
  const 响应: AxiosResponse = await 请求实例.post(`/api/guan-li/${路径段}-xin-jian`, 正文);
  return 解析包络<表格行>(响应.data).数据;
}

export async function 审核初审(目标类型: string, 正文: 审核评审): Promise<封禁写入结果> {
  const 路径段 = 审核路径段[目标类型] ?? 目标类型;
  const 响应: AxiosResponse = await 请求实例.post(`/api/guan-li/${路径段}-yi-shen`, 正文);
  return 解析包络<封禁写入结果>(响应.data).数据;
}

export async function 审核复审(目标类型: string, 正文: 审核评审): Promise<封禁写入结果> {
  const 路径段 = 审核路径段[目标类型] ?? 目标类型;
  const 响应: AxiosResponse = await 请求实例.post(`/api/guan-li/${路径段}-er-shen`, 正文);
  return 解析包络<封禁写入结果>(响应.data).数据;
}

export async function 审核多项处理(目标类型: string, 正文: 审核多项处理): Promise<表格行> {
  const 路径段 = 审核路径段[目标类型] ?? 目标类型;
  const 响应: AxiosResponse = await 请求实例.post(`/api/guan-li/${路径段}-pi-liang`, 正文);
  return 解析包络<表格行>(响应.data).数据;
}

export function 处理记录列表(查询: 处理记录查询 = {}): Promise<列表结果<表格行>> {
  return 取列表<表格行>('/api/guan-li/liu-hen', { ...查询 });
}
