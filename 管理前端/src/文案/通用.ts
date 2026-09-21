import { 应用标题, 加载中, 暂无数据, 待补充, 未收录, 查询, 重置, 上一页, 下一页, 返回, 提交, 详情, 操作, 未记录, 无适用值, 全部, 已隐藏 } from '../术语/通用';
import { 条目单位 } from '../术语/公共';

type 通用键清单 = {
  应用标题: string;
  加载中: string;
  暂无数据: string;
  待补充: string;
  查询: string;
  重置: string;
  上一页: string;
  下一页: string;
  返回: string;
  提交: string;
  请求失败: string;
  登录过期: string;
  总数前缀: string;
  总数后缀: string;
  详情: string;
  操作列: string;
  未收录: string;
  未记录: string;
  无适用值: string;
  全部: string;
  已隐藏: string;
};

export const 通用文案 = {
  应用标题: 应用标题,
  加载中: 加载中,
  暂无数据: 暂无数据,
  待补充: 待补充,
  查询: 查询,
  重置: 重置,
  上一页: 上一页,
  下一页: 下一页,
  返回: 返回,
  提交: 提交,
  请求失败: '请求失败，请稍后再试',
  登录过期: '登录已过期，请重新登录',
  总数前缀: '共',
  总数后缀: 条目单位,
  详情: 详情,
  操作列: 操作,
  未收录: 未收录,
  未记录: 未记录,
  无适用值: 无适用值,
  全部: 全部,
  已隐藏: 已隐藏,
} as const satisfies 通用键清单;
