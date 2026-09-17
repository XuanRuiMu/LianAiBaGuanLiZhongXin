export interface 埋点事件定义 {
  名称: string;
  版本: string;
  漏斗: string;
  留存: boolean;
  归因: string;
}

export const 埋点事件字典: readonly 埋点事件定义[] = [
  { 名称: 'zhu_ce_kai_shi', 版本: '1.0.0', 漏斗: 'zhu_ce', 留存: true, 归因: 'qu_dao' },
  { 名称: 'zhu_ce_fa_ma', 版本: '1.0.0', 漏斗: 'zhu_ce', 留存: true, 归因: 'qu_dao' },
  { 名称: 'zhuCeChengGong', 版本: '1.0.0', 漏斗: 'zhu_ce', 留存: true, 归因: 'qu_dao' },
  { 名称: 'deng_lu_cheng_gong', 版本: '1.0.0', 漏斗: 'deng_lu', 留存: true, 归因: 'qu_dao' },
  { 名称: 'deng_lu_shi_bai', 版本: '1.0.0', 漏斗: 'deng_lu', 留存: false, 归因: 'qu_dao' },
  { 名称: 'shouTiaoXiaoXi', 版本: '1.0.0', 漏斗: 'liao_tian', 留存: true, 归因: 'jiao_se' },
  { 名称: 'xiao_xi_fa_song', 版本: '1.0.0', 漏斗: 'liao_tian', 留存: true, 归因: 'jiao_se' },
  { 名称: 'xiao_xi_che_hui', 版本: '1.0.0', 漏斗: 'liao_tian', 留存: false, 归因: 'jiao_se' },
  { 名称: 'biaoBaiJieGuo', 版本: '1.0.0', 漏斗: 'biao_bai', 留存: true, 归因: 'jiao_se' },
  { 名称: 'biao_bai_fa_qi', 版本: '1.0.0', 漏斗: 'biao_bai', 留存: true, 归因: 'jiao_se' },
  { 名称: 'junShiShiYong', 版本: '1.0.0', 漏斗: 'jun_shi', 留存: true, 归因: 'jiao_se' },
  { 名称: 'jun_shi_wan_cheng', 版本: '1.0.0', 漏斗: 'jun_shi', 留存: true, 归因: 'jiao_se' },
  { 名称: 'xiangDaoWanCheng', 版本: '1.0.0', 漏斗: 'xiang_dao', 留存: true, 归因: 'qu_dao' },
  { 名称: 'xiang_dao_fang_qi', 版本: '1.0.0', 漏斗: 'xiang_dao', 留存: false, 归因: 'qu_dao' },
  { 名称: 'hao_you_tian_jia', 版本: '1.0.0', 漏斗: 'she_jiao', 留存: true, 归因: 'yao_qing' },
  { 名称: 'hao_you_liao_tian', 版本: '1.0.0', 漏斗: 'she_jiao', 留存: true, 归因: 'yao_qing' },
  { 名称: 'tiao_zhan_kai_shi', 版本: '1.0.0', 漏斗: 'tiao_zhan', 留存: true, 归因: 'huo_dong' },
  { 名称: 'tiao_zhan_wan_cheng', 版本: '1.0.0', 漏斗: 'tiao_zhan', 留存: true, 归因: 'huo_dong' },
  { 名称: 'duo_mei_ti_shang_chuan', 版本: '1.0.0', 漏斗: 'liao_tian', 留存: true, 归因: 'jiao_se' },
  { 名称: 'tong_zhi_dian_ji', 版本: '1.0.0', 漏斗: 'zhao_hui', 留存: true, 归因: 'qu_dao' },
  { 名称: 'ye_mian_liu_cun', 版本: '1.0.0', 漏斗: 'liu_cun', 留存: true, 归因: 'qu_dao' },
  { 名称: 'fu_fei_zhuan_hua', 版本: '1.0.0', 漏斗: 'fu_fei', 留存: true, 归因: 'qu_dao' },
];

const 事件版本表 = new Map<string, string>(埋点事件字典.map((项) => [项.名称, 项.版本]));

export function 校验埋点事件(名称: string, 版本: string): boolean {
  const 期望 = 事件版本表.get(名称);
  if (期望 === undefined) {
    return false;
  }
  return 期望 === 版本;
}
