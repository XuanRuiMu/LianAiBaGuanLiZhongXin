import { 页面审计日志, 开始时间, 结束时间 } from '../术语/公共';
import { 审计分类, 审计保留总数, 明细 } from '../术语/审计';

import { type 审计枚举键清单, 审计枚举文案 } from './审计枚举';

type 审计页面键清单 = {
  标题: string;
  开始时间标签: string;
  结束时间标签: string;
  保留标题: string;
  详情列: string;
  类型列: string;
};

export const 审计页面文案 = {
  标题: 页面审计日志,
  开始时间标签: 开始时间,
  结束时间标签: 结束时间,
  保留标题: 审计保留总数,
  详情列: 明细,
  类型列: 审计分类,
} as const satisfies 审计页面键清单;

export const 审计文案 = {
  ...审计页面文案,
  ...审计枚举文案,
} as const satisfies 审计页面键清单 & 审计枚举键清单;
