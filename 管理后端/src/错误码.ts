export const 错误注册表 = {
  未授权: { code: 'WEI_SHOU_QUAN', 状态码: 401, 可重试: false },
  登录失效: { code: 'LING_PAI_WU_XIAO', 状态码: 401, 可重试: false },
  无管理身份: { code: 'WU_GUAN_LI_QUAN_XIAN', 状态码: 403, 可重试: false },
  源地址被拒: { code: 'YUAN_DI_ZHI_JU_JUE', 状态码: 403, 可重试: false },
  需加密访问: { code: 'XU_JIA_MI_TONG_DAO', 状态码: 426, 可重试: false },
  参数有误: { code: 'CAN_SHU_CUO_WU', 状态码: 400, 可重试: false },
  需再次确认: { code: 'XU_YAO_QUE_REN', 状态码: 400, 可重试: true },
  需审批单: { code: 'XU_SHEN_PI_DAN', 状态码: 400, 可重试: false },
  记录未找到: { code: 'WEI_ZHAO_DAO', 状态码: 404, 可重试: false },
  无待审申诉: { code: 'WU_DAI_SHEN_SHEN_SU', 状态码: 409, 可重试: false },
  审核对象已变: { code: 'SHEN_HE_DUI_XIANG_YI_BIAN', 状态码: 409, 可重试: true },
  请求过频: { code: 'XIAN_LIU', 状态码: 429, 可重试: true },
  数据表未就绪: { code: 'BIAO_QUE_SHI_JIANG_JI', 状态码: 503, 可重试: true },
  表结构不完整: { code: 'MO_SHI_QUE_SHI', 状态码: 500, 可重试: false },
  数据服务失败: { code: 'SHU_JU_KU_CUO_WU', 状态码: 500, 可重试: true },
  依赖未就绪: { code: 'YI_LAI_QUE_SHI', 状态码: 503, 可重试: true },
  缓存服务不可用: { code: 'HUAN_CUN_BU_KE_YONG', 状态码: 503, 可重试: true },
  内部错误: { code: 'NEI_BU_CUO_WU', 状态码: 500, 可重试: true },
} as const;

export type 错误码键 = keyof typeof 错误注册表;
export type 错误码值 = (typeof 错误注册表)[错误码键]['code'];
export type 错误定义 = (typeof 错误注册表)[错误码键];

export const 错误码 = Object.fromEntries(
  Object.entries(错误注册表).map(([键, 定义]) => [键, 定义.code]),
) as { [键 in 错误码键]: 错误码值 };

export const 全部错误码: readonly 错误码值[] = Object.freeze(
  Object.values(错误注册表).map((定义) => 定义.code),
);

const 定义索引 = new Map<string, 错误定义>(
  Object.values(错误注册表).map((定义) => [定义.code, 定义]),
);

export function 取错误定义(代码: string): 错误定义 | undefined {
  return 定义索引.get(代码);
}
