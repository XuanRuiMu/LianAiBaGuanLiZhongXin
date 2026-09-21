import { 通用文案 } from '../文案/通用';
import { 审计枚举文案 } from '../文案/审计枚举';
import { 取选项, type 枚举选项, type 族定义 } from './基础';

export type 审计事件码 =
  | 'guan_li_deng_lu'
  | 'guan_li_shou_quan'
  | 'guan_li_hui_shou'
  | 'guan_li_duo_she'
  | 'guan_li_gui_huan'
  | 'guan_li_feng_jin'
  | 'guan_li_jie_chu_feng_jin'
  | 'guan_li_shen_he_shen_su'
  | 'guan_li_cha_kan_zhang_hao_xiang_qing'
  | 'guan_li_jie_mi_shou_ji_hao'
  | 'guan_li_cha_kan_shen_ji'
  | 'guan_li_cha_kan_tong_ji'
  | 'guan_li_dao_chu_shen_ji'
  | 'guan_li_shen_he_ju_bao'
  | 'guan_li_shen_he_gong_dan'
  | 'guan_li_shen_he_gong_gao'
  | 'guan_li_shen_he_huo_dong'
  | 'guan_li_shen_he_shi_yan'
  | 'guan_li_pi_liang_shen_he';

export const 审计事件文案键表 = {
  guan_li_deng_lu: 审计枚举文案.事件管理员登录,
  guan_li_shou_quan: 审计枚举文案.事件授予角色,
  guan_li_hui_shou: 审计枚举文案.事件回收角色,
  guan_li_duo_she: 审计枚举文案.事件接管角色,
  guan_li_gui_huan: 审计枚举文案.事件结束接管,
  guan_li_feng_jin: 审计枚举文案.事件提交封禁,
  guan_li_jie_chu_feng_jin: 审计枚举文案.事件解除封禁,
  guan_li_shen_he_shen_su: 审计枚举文案.事件审核申诉,
  guan_li_cha_kan_zhang_hao_xiang_qing: 审计枚举文案.事件查看账号详情,
  guan_li_jie_mi_shou_ji_hao: 审计枚举文案.事件解密手机号,
  guan_li_cha_kan_shen_ji: 审计枚举文案.事件查看审计,
  guan_li_cha_kan_tong_ji: 审计枚举文案.事件查看统计,
  guan_li_dao_chu_shen_ji: 审计枚举文案.事件导出审计,
  guan_li_shen_he_ju_bao: 审计枚举文案.事件审核举报,
  guan_li_shen_he_gong_dan: 审计枚举文案.事件审核工单,
  guan_li_shen_he_gong_gao: 审计枚举文案.事件审核公告,
  guan_li_shen_he_huo_dong: 审计枚举文案.事件审核活动,
  guan_li_shen_he_shi_yan: 审计枚举文案.事件审核实验,
  guan_li_pi_liang_shen_he: 审计枚举文案.事件多项审核,
} as const satisfies Record<审计事件码, string>;

export const 审计事件族: 族定义 = {
  值域: 审计事件文案键表,
  空态名: 通用文案.未记录,
};

export const 审计事件选项: ReadonlyArray<枚举选项> = 取选项(
  Object.keys(审计事件文案键表) as readonly 审计事件码[],
  审计事件文案键表,
);
