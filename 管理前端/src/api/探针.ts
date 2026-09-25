import { 解析包络, 请求实例, type 响应包装 } from './请求';

export type 就绪状态 = {
  zhuang_tai: string;
  jiu_xu: boolean;
  kui: string[];
};

/** 就绪探针与业务管理接口分属两个模块：壳层复核就绪不得把 28 条管理端路径拉进首屏分块 */
export async function 就绪检查(): Promise<就绪状态> {
  const 响应: 响应包装 = await 请求实例.get('/api/ready');
  return 解析包络<就绪状态>(响应.data).数据;
}
