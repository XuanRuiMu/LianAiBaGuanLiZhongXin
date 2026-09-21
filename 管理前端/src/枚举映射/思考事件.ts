import { 通用文案 } from '../文案/通用';
import { 思考枚举文案 } from '../文案/思考枚举';
import { 取选项, type 枚举选项, type 族定义 } from './基础';

export type 思考事件码 =
  | 'guan-li-yuan-shen-du-si-kao'
  | 'guan-li-yuan-gou-jian-guo-cheng'
  | 'guan-li-yuan-yin-cang-xin-xi'
  | 'guan-li-yuan-hao-gan-du-bian-hua';

export const 思考事件文案键表 = {
  'guan-li-yuan-shen-du-si-kao': 思考枚举文案.事件深度思考,
  'guan-li-yuan-gou-jian-guo-cheng': 思考枚举文案.事件构建过程,
  'guan-li-yuan-yin-cang-xin-xi': 思考枚举文案.事件隐藏信息,
  'guan-li-yuan-hao-gan-du-bian-hua': 思考枚举文案.事件好感度变化,
} as const satisfies Record<思考事件码, string>;

export const 思考事件族: 族定义 = {
  值域: 思考事件文案键表,
  空态名: 通用文案.未记录,
};

export const 思考事件选项: ReadonlyArray<枚举选项> = 取选项(
  Object.keys(思考事件文案键表) as readonly 思考事件码[],
  思考事件文案键表,
);
