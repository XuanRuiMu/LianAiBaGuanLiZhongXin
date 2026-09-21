export const 错误码 = {
  未授权: 'WEI_SHOU_QUAN',
  登录失效: 'LING_PAI_WU_XIAO',
  无管理身份: 'WU_GUAN_LI_QUAN_XIAN',
  源地址被拒: 'YUAN_DI_ZHI_JU_JUE',
  需加密访问: 'XU_JIA_MI_TONG_DAO',
  参数有误: 'CAN_SHU_CUO_WU',
  需再次确认: 'XU_YAO_QUE_REN',
  需审批单: 'XU_SHEN_PI_DAN',
  记录未找到: 'WEI_ZHAO_DAO',
  无待审申诉: 'WU_DAI_SHEN_SHEN_SU',
  审核对象已变: 'SHEN_HE_DUI_XIANG_YI_BIAN',
  请求过频: 'XIAN_LIU',
  数据表未就绪: 'BIAO_QUE_SHI_JIANG_JI',
  表结构不完整: 'MO_SHI_QUE_SHI',
  数据服务失败: 'SHU_JU_KU_CUO_WU',
  依赖未就绪: 'YI_LAI_QUE_SHI',
  缓存服务不可用: 'HUAN_CUN_BU_KE_YONG',
  内部错误: 'NEI_BU_CUO_WU',
} as const;

export type 错误码值 = (typeof 错误码)[keyof typeof 错误码];

export const 全部错误码: readonly 错误码值[] = Object.values(错误码);
