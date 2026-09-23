import { 超级管理员, 运营, 审核员, 无管理身份, 性别男, 性别女 } from '../术语/账号';

export type 账号枚举键清单 = {
  角色超级管理员: string;
  角色运营: string;
  角色审核员: string;
  角色无: string;
  性别男: string;
  性别女: string;
};

export const 账号枚举文案 = {
  角色超级管理员: 超级管理员,
  角色运营: 运营,
  角色审核员: 审核员,
  角色无: 无管理身份,
  性别男: 性别男,
  性别女: 性别女,
} as const satisfies 账号枚举键清单;
