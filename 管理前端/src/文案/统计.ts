import { 页面统计图表, 条目单位 } from '../术语/公共';
import { 创建时间 } from '../术语/统计';

import { type 统计枚举键清单, 统计枚举文案 } from './统计枚举';

type 统计页面键清单 = {
  标题: string;
  天数标签: string;
  注册趋势: string;
  消息趋势: string;
  消息数: string;
  好感度总览: string;
  好感度分阶段: string;
  留存趋势: string;
  用量趋势: string;
  注册总数: string;
  日期列: string;
  数量列: string;
  数量单位: string;
  总数列: string;
  平均分列: string;
  最高分列: string;
  最低分列: string;
  模型列: string;
  创建时间列: string;
};

export const 统计页面文案 = {
  标题: 页面统计图表,
  天数标签: '统计天数',
  注册趋势: '注册趋势',
  消息趋势: '消息趋势',
  消息数: '消息数',
  好感度总览: '好感度总览',
  好感度分阶段: '好感度分阶段',
  留存趋势: '留存趋势',
  用量趋势: '用量趋势',
  注册总数: '注册总数',
  日期列: '日期',
  数量列: '数量',
  数量单位: 条目单位,
  总数列: '总数',
  平均分列: '平均分',
  最高分列: '最高分',
  最低分列: '最低分',
  模型列: '模型',
  创建时间列: 创建时间,
} as const satisfies 统计页面键清单;

export const 统计文案 = {
  ...统计页面文案,
  ...统计枚举文案,
} as const satisfies 统计页面键清单 & 统计枚举键清单;
