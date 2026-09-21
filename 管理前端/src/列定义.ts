import type { 表格行 } from './api/管理';
import { 文案, 取文案, type 文案分类 } from './文案/聚合';
import { 通用文案 } from './文案/通用';
import { 取徽标文案, 取徽标色调, type 徽标族, type 徽标色调 } from './枚举映射';
import { 时间展示格式 } from './配置';
import { 密码 } from './术语/登录';

export type 渲染方式 = '文本' | '编号' | '时间' | '地址' | '数字' | '枚举' | '徽标' | '链接' | '插槽';

export interface 值域依赖 {
  readonly 依赖列: string;
  readonly 族: 徽标族;
  readonly 不适用码: readonly string[];
}

export interface 列<键 extends string = string> {
  readonly 数据键: 键 | null;
  readonly 表头: readonly [文案分类, PropertyKey] | null;
  readonly 渲染: 渲染方式;
  readonly 族: 徽标族 | null;
  readonly 插槽: string | null;
  readonly 测试标识: string | null;
  readonly 值域依赖: 值域依赖 | null;
}

type 表头对 = { [分类 in 文案分类]: readonly [分类, keyof (typeof 文案)[分类]] }[文案分类] | null;

function 建列<键 extends string>(
  数据键: 键 | null,
  表头: 表头对,
  渲染: 渲染方式,
  族: 徽标族 | null = null,
  插槽: string | null = null,
  测试标识: string | null = null,
  值域依赖: 值域依赖 | null = null,
): 列<键> {
  return { 数据键, 表头, 渲染, 族, 插槽, 测试标识, 值域依赖 };
}

const 文本列 = <键 extends string>(数据键: 键, 表头: 表头对) => 建列(数据键, 表头, '文本');
const 编号列 = <键 extends string>(数据键: 键, 表头: 表头对) => 建列(数据键, 表头, '编号');
const 时间列 = <键 extends string>(数据键: 键, 表头: 表头对) => 建列(数据键, 表头, '时间');
const 地址列 = <键 extends string>(数据键: 键, 表头: 表头对) => 建列(数据键, 表头, '地址');
const 数字列 = <键 extends string>(数据键: 键, 表头: 表头对) => 建列(数据键, 表头, '数字');
const 枚举列 = <键 extends string>(数据键: 键, 表头: 表头对, 族: 徽标族) => 建列(数据键, 表头, '枚举', 族);
const 徽标列 = <键 extends string>(数据键: 键, 表头: 表头对, 族: 徽标族, 测试标识?: string) =>
  建列(数据键, 表头, '徽标', 族, null, 测试标识 ?? null);
const 链接列 = <键 extends string>(数据键: 键, 表头: 表头对, 插槽?: string) => 建列(数据键, 表头, '链接', null, 插槽 ?? null);
const 插槽列 = (表头: 表头对, 插槽: string) => 建列<never>(null, 表头, '插槽', null, 插槽);
const 条件时间列 = <键 extends string>(数据键: 键, 表头: 表头对, 依赖: 值域依赖) =>
  建列(数据键, 表头, '时间', null, null, null, 依赖);

export const 列定义登记 = {
  账号列表: [
    文本列('昵称', ['账号', '昵称']),
    编号列('手机号', ['账号', '手机号']),
    徽标列('角色', ['账号', '角色标签'], '管理角色', 'jiao-se-hui'),
    徽标列('封禁级别', ['封禁', '级别标签'], '封禁级别'),
    时间列('创建时间', ['统计', '创建时间列']),
    链接列('ID', ['通用', '操作列'], 'cao-zuo'),
  ] as const,
  账号概览: [文本列('昵称', null), 文本列('用户名', null)] as const,
  账号详情: [
    编号列('ID', ['账号', '用户编号']),
    编号列('手机号', ['账号', '手机号']),
    文本列('性别', ['账号', '性别']),
    文本列('人设标签', ['账号', '人设标签']),
    文本列('签名', ['账号', '签名']),
    枚举列('角色', ['账号', '角色标签'], '管理角色'),
    徽标列('封禁级别', ['封禁', '级别标签'], '封禁级别'),
    数字列('违规次数', ['账号', '违规次数']),
    枚举列('申诉状态', ['账号', '申诉状态'], '申诉状态'),
    条件时间列('账号解封时间', ['账号', '账号解封时间'], { 依赖列: '封禁级别', 族: '封禁级别', 不适用码: ['zheng_chang'] }),
    时间列('创建时间', ['统计', '创建时间列']),
  ] as const,
  单聊消息: [
    徽标列('发送者', null, '发送方'),
    枚举列('类型', null, '消息类型'),
    时间列('创建时间', null),
    文本列('内容', null),
  ] as const,
  好友消息: [
    文本列('发送者ID', null),
    枚举列('类型', null, '消息类型'),
    时间列('创建时间', null),
    文本列('内容', null),
  ] as const,
  思考记录: [
    编号列('ID', ['思考', '记录编号列']),
    编号列('用户ID', ['账号', '用户编号']),
    编号列('角色ID', ['账号', '角色编号标签']),
    徽标列('事件', ['思考', '事件标签'], '思考事件'),
    文本列('来源', ['思考', '来源列']),
    文本列('阶段', ['思考', '阶段列']),
    文本列('类型', ['思考', '类型列']),
    数字列('轮次', ['思考', '轮次列']),
    文本列('摘要', ['思考', '摘要标签']),
    数字列('原文长度', ['思考', '原文长度列']),
    时间列('创建时间', ['统计', '创建时间列']),
  ] as const,
  记忆: [
    编号列('ID', ['思考', '记录编号列']),
    编号列('用户ID', ['账号', '用户编号']),
    编号列('角色ID', ['账号', '角色编号标签']),
    文本列('内容', ['思考', '内容标签']),
    数字列('重要度', ['思考', '重要度列']),
    时间列('创建时间', ['统计', '创建时间列']),
  ] as const,
  对话摘要: [
    编号列('ID', ['思考', '记录编号列']),
    编号列('用户ID', ['账号', '用户编号']),
    编号列('角色ID', ['账号', '角色编号标签']),
    文本列('摘要', ['思考', '摘要标签']),
    时间列('创建时间', ['统计', '创建时间列']),
    文本列('摘要内容', ['思考', '摘要内容列']),
    数字列('概括消息数', ['思考', '概括消息数列']),
    时间列('更新时间', ['思考', '更新时间列']),
    时间列('素材锚点时间', ['思考', '素材锚点时间列']),
  ] as const,
  关键事件: [
    编号列('ID', ['思考', '记录编号列']),
    编号列('用户ID', ['账号', '用户编号']),
    编号列('角色ID', ['账号', '角色编号标签']),
    文本列('事件类型', ['审计', '事件类型列']),
    文本列('描述', ['思考', '描述列']),
    时间列('创建时间', ['统计', '创建时间列']),
  ] as const,
  接管记录: [
    编号列('ID', ['思考', '记录编号列']),
    编号列('管理员ID', ['思考', '管理员编号标签']),
    编号列('角色ID', ['账号', '角色编号标签']),
    时间列('结束时间', ['思考', '结束时间列']),
    时间列('创建时间', ['统计', '创建时间列']),
  ] as const,
  评估: [
    编号列('ID', ['思考', '记录编号列']),
    编号列('用户ID', ['账号', '用户编号']),
    编号列('角色ID', ['账号', '角色编号标签']),
    文本列('话题引导', ['思考', '话题引导列']),
    文本列('情感共鸣', ['思考', '情感共鸣列']),
    文本列('幽默感', ['思考', '幽默感列']),
    文本列('体贴度', ['思考', '体贴度列']),
    文本列('节奏把控', ['思考', '节奏把控列']),
    文本列('总体评价', ['思考', '总体评价列']),
    文本列('改进建议', ['思考', '改进建议列']),
    时间列('创建时间', ['统计', '创建时间列']),
  ] as const,
  封禁记录: [
    地址列('IP', ['封禁', '地址列']),
    文本列('原因', ['封禁', '原因列']),
    徽标列('严重程度', ['封禁', '严重程度标签'], '严重程度'),
    时间列('创建时间', ['统计', '创建时间列']),
  ] as const,
  账号封禁: [
    编号列('用户ID', ['账号', '用户编号']),
    徽标列('级别', ['封禁', '级别标签'], '封禁级别'),
    徽标列('申诉状态', ['账号', '申诉状态'], '申诉状态'),
    文本列('最后原因', ['封禁', '原因列']),
    插槽列(['通用', '操作列'], 'cao-zuo'),
  ] as const,
  审计日志: [
    徽标列('事件类型', ['审计', '事件类型列'], '审计事件'),
    编号列('用户ID', ['账号', '用户编号']),
    地址列('IP', ['封禁', '地址列']),
    文本列('详情', ['审计', '详情列']),
    枚举列('类型', ['审计', '类型列'], '审计分类'),
    时间列('创建时间', ['统计', '创建时间列']),
  ] as const,
  审核列表: [
    编号列('ID', ['审核', '目标编号列']),
    枚举列('状态', ['审核', '状态列'], '审核状态'),
    时间列('创建时间', ['统计', '创建时间列']),
  ] as const,
  审核留痕: [
    编号列('目标ID', ['审核', '目标编号列']),
    时间列('创建时间', ['统计', '创建时间列']),
  ] as const,
  注册统计: [
    时间列('日期', ['统计', '日期列']),
    数字列('数量', ['统计', '数量列']),
  ] as const,
  消息统计: [
    时间列('日期', ['统计', '日期列']),
    徽标列('发送方', ['聊天', '发送方标签'], '发送方'),
    数字列('数量', ['统计', '数量列']),
  ] as const,
  留存统计: [
    时间列('日期', ['统计', '日期列']),
    数字列('数量', ['统计', '数量列']),
  ] as const,
  用量统计: [
    时间列('日期', ['统计', '日期列']),
    枚举列('模型类型', ['统计', '模型列'], '模型类型'),
    数字列('总数', ['统计', '数量列']),
  ] as const,
  好感总览: [
    数字列('总数', ['统计', '总数列']),
    数字列('平均分', ['统计', '平均分列']),
    数字列('最高分', ['统计', '最高分列']),
    数字列('最低分', ['统计', '最低分列']),
  ] as const,
  好感阶段: [
    枚举列('阶段', null, '关系阶段'),
    数字列('数量', ['统计', '数量列']),
    数字列('平均分', ['统计', '平均分列']),
  ] as const,
} as const;

export type 表名 = keyof typeof 列定义登记;

export const 响应行键 = {
  ID: 'ID',
  用户ID: '用户ID',
  角色: '角色',
  内容: '内容',
} as const;

export type 思考页签 = 'si-kao-ji-lu' | 'ji-yi' | 'dui-hua-zhai-yao' | 'guan-jian-shi-jian' | 'duo-she-ri-zhi' | 'ping-gu';

export const 页签快照表: Record<思考页签, 表名> = {
  'si-kao-ji-lu': '思考记录',
  'ji-yi': '记忆',
  'dui-hua-zhai-yao': '对话摘要',
  'guan-jian-shi-jian': '关键事件',
  'duo-she-ri-zhi': '接管记录',
  'ping-gu': '评估',
};

type 列项of<表 extends 表名> = (typeof 列定义登记)[表][number];

export type 数据键of<表 extends 表名> = Exclude<列项of<表>['数据键'], null>;

export type 列映射<表 extends 表名> = { readonly [键 in 数据键of<表>]: 列 };

const 空列: 列 = 建列<never>(null, null, '文本');

export function 取列<表 extends 表名>(表: 表, 数据键: 数据键of<表>): 列 {
  const 清单 = 列定义登记[表] as readonly 列[];
  return 清单.find((项) => 项.数据键 === 数据键) ?? 空列;
}

export function 取列映射<表 extends 表名>(表: 表): 列映射<表> {
  const 结果: Record<string, 列> = {};
  for (const 项 of 列定义登记[表] as readonly 列[]) {
    if (项.数据键 !== null) {
      结果[项.数据键] = 项;
    }
  }
  return 结果 as 列映射<表>;
}

export function 表头文本(列: 列): string {
  return 列.表头 === null ? '' : 取文案(列.表头[0], 列.表头[1] as never);
}

export function 单元格色调(列: 列, 行: 表格行): 徽标色调 | null {
  if (列.渲染 !== '徽标' || 列.族 === null) {
    return null;
  }
  return 取徽标色调(列.族, 行[列.数据键 as string]);
}

export function 单元格原值(列: 列, 行: 表格行): unknown {
  return 列.数据键 === null ? undefined : 行[列.数据键];
}

function 值域不适用(列: 列, 行: 表格行): boolean {
  const 依赖 = 列.值域依赖;
  if (依赖 === null) {
    return false;
  }
  const 现值 = 取徽标文案(依赖.族, 行[依赖.依赖列]);
  return 依赖.不适用码.some((码) => 现值 === 取徽标文案(依赖.族, 码));
}

const 时刻形态 = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/;
const 补零 = (数: number): string => String(数).padStart(2, '0');
const 时间标记 = {
  YYYY: (时: Date) => String(时.getFullYear()),
  MM: (时: Date) => 补零(时.getMonth() + 1),
  DD: (时: Date) => 补零(时.getDate()),
  HH: (时: Date) => 补零(时.getHours()),
  mm: (时: Date) => 补零(时.getMinutes()),
  ss: (时: Date) => 补零(时.getSeconds()),
} as const;

function 时间文本(值: unknown): string {
  if (值 === null || 值 === undefined || 值 === '') {
    return 通用文案.未记录;
  }
  const 原文 = typeof 值 === 'string' ? 值.trim() : '';
  if (!时刻形态.test(原文)) {
    return 格式化值(值);
  }
  const 时 = new Date(原文);
  if (Number.isNaN(时.getTime())) {
    return 原文;
  }
  return 时间展示格式.replace(/\b\w+\b/g, (标记) =>
    标记 in 时间标记 ? 时间标记[标记 as keyof typeof 时间标记](时) : 标记,
  );
}

export function 单元格文本(列: 列, 行: 表格行): string {
  if (值域不适用(列, 行)) {
    return 通用文案.无适用值;
  }
  const 值 = 单元格原值(列, 行);
  if (列.渲染 === '徽标' || 列.渲染 === '枚举') {
    return 列.族 === null ? 格式化值(值) : 取徽标文案(列.族, 值);
  }
  if (列.渲染 === '插槽' || 列.渲染 === '链接') {
    return '';
  }
  if (列.渲染 === '时间') {
    return 时间文本(值);
  }
  return 格式化值(值);
}

export function 单元格类(列: 列): string {
  if (列.渲染 === '链接' || 列.渲染 === '插槽') {
    return '操作';
  }
  return 列.渲染 === '编号' || 列.渲染 === '数字' || 列.渲染 === '地址' ? '数字' : '';
}

export const 渲染为徽标 = (列: 列): boolean => 列.渲染 === '徽标';

export const 渲染为链接 = (列: 列): boolean => 列.渲染 === '链接';

export function 行快照文本(表: 表名, 行: 表格行): string {
  const 条目: string[] = [];
  for (const 项 of 列定义登记[表] as readonly 列[]) {
    if (项.数据键 === null || !Object.prototype.hasOwnProperty.call(行, 项.数据键)) {
      continue;
    }
    条目.push(命名值文本(表头文本(项), 单元格文本(项, 行)));
  }
  return 条目.length > 0 ? 条目.join('\n') : 取文案('通用', '未记录');
}

export function 命名值文本(标签: string, 值: unknown): string {
  return `${标签}：${格式化值(值)}`;
}

const 数据键表头集 = new Map<string, Set<string>>();
for (const 清单 of Object.values(列定义登记) as unknown as ReadonlyArray<readonly 列[]>) {
  for (const 项 of 清单) {
    if (项.数据键 === null || 项.表头 === null) {
      continue;
    }
    数据键表头集.set(项.数据键, new Set([...(数据键表头集.get(项.数据键) ?? []), 表头文本(项)]));
  }
}

export const 歧义数据键: readonly string[] = [...数据键表头集]
  .filter(([, 集]) => 集.size > 1)
  .map(([键]) => 键)
  .sort();

const 数据键显示名: ReadonlyMap<string, string> = new Map(
  [...数据键表头集].filter(([, 集]) => 集.size === 1).map(([键, 集]) => [键, [...集][0]]),
);

export const 内部键显示名: Readonly<Record<string, string>> = {
  mi_ma: 密码,
};

export const 敏感键形态 = /mi_?ma|mi_?yao|passw|token|secret|api_?key|密\s*码|密\s*钥/i;

export function 键显示名(键: string): string {
  if (敏感键形态.test(键)) {
    return 内部键显示名[键] ?? 通用文案.已隐藏;
  }
  return 数据键显示名.get(键) ?? 内部键显示名[键] ?? 键;
}

function 格式化值(值: unknown): string {
  if (值 === null || 值 === undefined || 值 === '') {
    return 通用文案.未记录;
  }
  if (Array.isArray(值)) {
    const 项清单 = 值.map((项) => 格式化值(项)).filter((项) => 项.length > 0);
    return 项清单.length > 0 ? 项清单.join('、') : 通用文案.未记录;
  }
  if (typeof 值 === 'object') {
    const 条目 = Object.entries(值 as Record<string, unknown>).map(([键, 项]) =>
      敏感键形态.test(键) ? 命名值文本(键显示名(键), 通用文案.已隐藏) : 命名值文本(键显示名(键), 项),
    );
    return 条目.length > 0 ? 条目.join('；') : 通用文案.未记录;
  }
  return String(值);
}
