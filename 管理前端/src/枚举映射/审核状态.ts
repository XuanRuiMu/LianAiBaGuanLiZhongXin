import { 通用文案 } from '../文案/通用';
import { 审核枚举文案 } from '../文案/审核枚举';
import { 取选项, type 枚举选项, type 族定义 } from './基础';

export type 审核状态码 =
  | 'dai_yi_shen'
  | 'dai_er_shen'
  | 'yi_tong_guo'
  | 'bo_hui'
  | 'yi_guan_bi'
  | 'yi_fa_bu'
  | 'yi_xia_xian'
  | 'jin_xing_zhong'
  | 'yi_jie_shu'
  | 'yun_xing_zhong';

export const 审核状态文案键表 = {
  dai_yi_shen: 审核枚举文案.状态待初审,
  dai_er_shen: 审核枚举文案.状态待复审,
  yi_tong_guo: 审核枚举文案.状态已通过,
  bo_hui: 审核枚举文案.状态已驳回,
  yi_guan_bi: 审核枚举文案.状态已关闭,
  yi_fa_bu: 审核枚举文案.状态已发布,
  yi_xia_xian: 审核枚举文案.状态已下线,
  jin_xing_zhong: 审核枚举文案.状态进行中,
  yi_jie_shu: 审核枚举文案.状态已结束,
  yun_xing_zhong: 审核枚举文案.状态运行中,
} as const satisfies Record<审核状态码, string>;

export const 审核状态族: 族定义 = {
  值域: 审核状态文案键表,
  空态名: 通用文案.未记录,
};

export const 审核状态选项: ReadonlyArray<枚举选项> = 取选项(
  Object.keys(审核状态文案键表) as readonly 审核状态码[],
  审核状态文案键表,
);
