import { 通用文案 } from '../文案/通用';

export type 徽标色调 = '安' | '警' | '危' | '墨';

export interface 族定义 {
  readonly 值域: Readonly<Record<string, string>>;
  readonly 空态名: string;
  readonly 色调表?: Readonly<Record<string, 徽标色调>>;
  readonly 底色?: 徽标色调;
  readonly 透传?: true;
}

export const 空值域: Readonly<Record<string, string>> = {};

export function 未收录显示名(原始码: string): string {
  return `${通用文案.未收录}（${原始码}）`;
}

export function 取原码(原始: unknown): string {
  return typeof 原始 === 'string' ? 原始 : String(原始);
}

export function 取枚举文案(值域: Readonly<Record<string, string>>, 空态名: string, 原始: unknown): string {
  if (原始 === null || 原始 === undefined || 原始 === '') {
    return 空态名;
  }
  const 码 = 取原码(原始);
  const 命中: string | undefined = Object.prototype.hasOwnProperty.call(值域, 码) ? 值域[码] : undefined;
  if (命中 === undefined) {
    return 未收录显示名(码);
  }
  return 命中;
}

export function 取族文案(定义: 族定义, 原始: unknown): string {
  if (定义.透传 === true) {
    return 原始 === null || 原始 === undefined || 原始 === '' ? 定义.空态名 : 取原码(原始);
  }
  return 取枚举文案(定义.值域, 定义.空态名, 原始);
}

export function 取族色调(定义: 族定义, 原始: unknown): 徽标色调 {
  const 底色 = 定义.底色 ?? '墨';
  if (定义.色调表 === undefined || 原始 === null || 原始 === undefined || 原始 === '') {
    return 底色;
  }
  return 定义.色调表[取原码(原始)] ?? '警';
}

export interface 枚举选项 {
  值: string;
  文案: string;
}

export function 取选项<码 extends string>(值域: readonly 码[], 键表: Readonly<Record<码, string>>): ReadonlyArray<枚举选项> {
  return 值域.map((项) => ({ 值: 项, 文案: 键表[项] }));
}
