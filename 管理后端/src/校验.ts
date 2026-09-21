import net from 'node:net';
import { 取文案, 取字段显示名 } from './文案';
import { 当前配置 } from './配置';

export class 校验失败 extends Error {
  readonly 状态码 = 400;

  constructor(消息: string) {
    super(消息);
    this.name = '校验失败';
  }
}

export class 记录缺失 extends Error {
  readonly 状态码 = 404;

  constructor(消息: string) {
    super(消息);
    this.name = '记录缺失';
  }
}

const UUID表达式 = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const 手机号表达式 = /^1[3-9]\d{9}$/;

export const 发送方白名单: readonly string[] = ['yonghu', 'jiaose', 'xitong'];
export const 排序方向白名单: readonly string[] = ['asc', 'desc'];
export const 账号封禁级别白名单: readonly string[] = [
  'zheng_chang',
  'feng_jin_1_fen',
  'feng_jin_1_tian',
  'yong_feng',
];
export const 账号封禁写入级别白名单: readonly string[] = [
  'feng_jin_1_fen',
  'feng_jin_1_tian',
  'yong_feng',
];
export const 账号申诉状态白名单: readonly string[] = [
  'wu',
  'shen_su_zhong',
  'bo_hui',
  'yi_jie_chu',
];
export const 严重程度白名单: readonly string[] = ['轻微', '中等', '严重'];
export const 审核目标类型白名单: readonly string[] = ['ju_bao', 'gong_dan', 'gong_gao', 'huo_dong', 'shi_yan'];
export const 审核状态白名单: readonly string[] = ['dai_yi_shen', 'dai_er_shen', 'yi_tong_guo', 'bo_hui', 'yi_guan_bi', 'yi_fa_bu', 'yi_xia_xian', 'jin_xing_zhong', 'yi_jie_shu', 'yun_xing_zhong'];
export const 审核动作白名单: readonly string[] = ['chuang_jian', 'yi_shen', 'er_shen', 'pi_liang', 'fa_bu', 'xia_xian', 'jie_shu', 'guan_bi'];
export const 审核伸缩结果白名单: readonly string[] = ['wu', 'tong_guo', 'bo_hui'];
export const 工单优先级白名单: readonly string[] = ['di', 'zhong', 'gao', 'jin_ji'];
export const 审计事件白名单: readonly string[] = [
  'guan_li_deng_lu',
  'guan_li_shou_quan',
  'guan_li_hui_shou',
  'guan_li_duo_she',
  'guan_li_gui_huan',
  'guan_li_feng_jin',
  'guan_li_jie_chu_feng_jin',
  'guan_li_shen_he_shen_su',
  'guan_li_cha_kan_zhang_hao_xiang_qing',
  'guan_li_jie_mi_shou_ji_hao',
  'guan_li_cha_kan_shen_ji',
  'guan_li_cha_kan_tong_ji',
  'guan_li_dao_chu_shen_ji',
  'guan_li_shen_he_ju_bao',
  'guan_li_shen_he_gong_dan',
  'guan_li_shen_he_gong_gao',
  'guan_li_shen_he_huo_dong',
  'guan_li_shen_he_shi_yan',
  'guan_li_pi_liang_shen_he',
];
export const 健康就绪态白名单: readonly string[] = ['jiu_xu', 'jiang_ji', 'bu_ke_yong'];

export function 参数错误提示(字段标识: string): string {
  const 显示名 = 取字段显示名(字段标识);
  const 前缀 = 取文案('通用', '参数错误');
  return 显示名 === '' ? 前缀 : `${前缀}：${显示名}`;
}

export function 取可选字符串(值: unknown): string | undefined {
  if (typeof 值 !== 'string' || 值.length === 0) {
    return undefined;
  }
  return 值;
}

export function 取必填字符串(值: unknown, 字段标识: string, 上限 = 500): string {
  if (typeof 值 !== 'string' || 值.trim().length === 0) {
    throw new 校验失败(参数错误提示(字段标识));
  }
  const 修剪 = 值.trim();
  if (修剪.length > 上限) {
    throw new 校验失败(参数错误提示(字段标识));
  }
  return 修剪;
}

export function 校验UUID(字段标识: string, 值: unknown): string {
  if (typeof 值 !== 'string' || !UUID表达式.test(值)) {
    throw new 校验失败(参数错误提示(字段标识));
  }
  return 值;
}

export function 校验可选UUID(字段标识: string, 值: unknown): string | undefined {
  const 文本 = 取可选字符串(值);
  if (文本 === undefined) {
    return undefined;
  }
  return 校验UUID(字段标识, 文本);
}

export function 校验手机号(字段标识: string, 值: unknown): string {
  if (typeof 值 !== 'string' || !手机号表达式.test(值)) {
    throw new 校验失败(参数错误提示(字段标识));
  }
  return 值;
}

export function 校验IP(字段标识: string, 值: unknown): string {
  if (typeof 值 !== 'string' || net.isIP(值) === 0) {
    throw new 校验失败(参数错误提示(字段标识));
  }
  return 值;
}

export interface 分页结果 {
  页码: number;
  每页条数: number;
  偏移量: number;
}

function 取正整数(值: unknown, 默认值: number, 字段标识: string): number {
  if (值 === undefined || 值 === '') {
    return 默认值;
  }
  const 文本 = Array.isArray(值) ? String(值[0]) : String(值);
  const 解析 = Number(文本);
  if (!Number.isInteger(解析) || 解析 <= 0) {
    throw new 校验失败(参数错误提示(字段标识));
  }
  return 解析;
}

export function 解析分页(查询: unknown): 分页结果 {
  const 参数 = 查询 as Record<string, unknown>;
  const 页码 = 取正整数(参数['ye_ma'], 1, 'ye_ma');
  const 请求条数 = 取正整数(参数['mei_ye_tiao_shu'], 20, 'mei_ye_tiao_shu');
  const 每页条数 = Math.min(请求条数, 当前配置().每页上限);
  return { 页码, 每页条数, 偏移量: (页码 - 1) * 每页条数 };
}

export interface 时间范围 {
  开始?: string;
  结束?: string;
}

export function 解析时间范围(查询: unknown): 时间范围 {
  const 参数 = 查询 as Record<string, unknown>;
  const 开始文本 = 取可选字符串(参数['kai_shi_shi_jian']);
  const 结束文本 = 取可选字符串(参数['jie_shu_shi_jian']);
  let 开始: string | undefined;
  let 结束: string | undefined;
  if (开始文本 !== undefined) {
    const 毫秒 = Date.parse(开始文本);
    if (Number.isNaN(毫秒)) {
      throw new 校验失败(参数错误提示('kai_shi_shi_jian'));
    }
    开始 = new Date(毫秒).toISOString();
  }
  if (结束文本 !== undefined) {
    const 毫秒 = Date.parse(结束文本);
    if (Number.isNaN(毫秒)) {
      throw new 校验失败(参数错误提示('jie_shu_shi_jian'));
    }
    结束 = new Date(毫秒).toISOString();
  }
  if (开始 !== undefined && 结束 !== undefined && 开始 > 结束) {
    throw new 校验失败(取文案('通用', '时间范围有误'));
  }
  return { 开始, 结束 };
}

export function 校验发送方(值: unknown): string {
  const 文本 = 取可选字符串(值);
  if (文本 === undefined) {
    return '';
  }
  if (!发送方白名单.includes(文本)) {
    throw new 校验失败(参数错误提示('fa_song_fang'));
  }
  return 文本;
}

export function 校验排序方向(值: unknown): 'ASC' | 'DESC' {
  const 文本 = 取可选字符串(值) ?? 'desc';
  if (!排序方向白名单.includes(文本)) {
    throw new 校验失败(参数错误提示('pai_xu'));
  }
  return 文本 === 'asc' ? 'ASC' : 'DESC';
}

export function 校验白名单(字段标识: string, 值: string, 白名单: readonly string[]): string {
  if (!白名单.includes(值)) {
    throw new 校验失败(参数错误提示(字段标识));
  }
  return 值;
}

export function 校验天数(值: unknown, 上限 = 90): number {
  const 天数 = 取正整数(值 === undefined || 值 === '' ? 30 : 值, 30, 'tian_shu');
  if (天数 > 上限) {
    throw new 校验失败(参数错误提示('tian_shu'));
  }
  return 天数;
}
