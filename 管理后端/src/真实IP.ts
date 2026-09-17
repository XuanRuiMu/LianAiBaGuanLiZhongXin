import type { Request } from 'express';
import { 当前配置 } from './配置';

const 回环默认IP = '127.0.0.1';

function 是否合法IPv4(值: string): boolean {
  const 分段 = 值.split('.');
  if (分段.length !== 4) return false;
  return 分段.every((段) => /^\d{1,3}$/.test(段) && Number(段) <= 255);
}

function ipv4转数字(值: string): number {
  const 分段 = 值.split('.');
  return (
    ((Number(分段[0]) << 24) | (Number(分段[1]) << 16) | (Number(分段[2]) << 8) | Number(分段[3])) >>>
    0
  );
}

function 归一化IP(值: string): string {
  if (/^::ffff:/i.test(值)) {
    const 映射 = 值.slice(7);
    if (是否合法IPv4(映射)) return 映射;
  }
  return 值;
}

/** YH-016 照抄主仓真实IP推导：仅回环+KE_XIN_DAI_LI_WANG_DUAN网段信任X-Real-IP */
export function 是否可信代理(地址: string): boolean {
  const 归一 = 归一化IP(地址);
  const 网段 = 当前配置().可信代理网段;
  const 回环恒信: string[] = ['127.0.0.1', '::1'];
  const 全表 = [...回环恒信, ...网段];
  for (const 项 of 全表) {
    const 修剪 = 项.trim();
    if (!修剪) continue;
    const [网段地址, 掩码段] = 修剪.split('/');
    if (是否合法IPv4(网段地址)) {
      const 掩码 = 掩码段 === undefined ? 32 : Number(掩码段);
      if (!Number.isInteger(掩码) || 掩码 < 1 || 掩码 > 32) continue;
      if (!是否合法IPv4(归一)) continue;
      const 右移 = 32 - 掩码;
      if ((ipv4转数字(归一) >>> 右移) === (ipv4转数字(网段地址) >>> 右移)) return true;
      continue;
    }
    if (掩码段 !== undefined) continue;
    if (归一.toLowerCase() === 修剪.toLowerCase()) return true;
  }
  return false;
}

function 是否合法IP面量(值: string): boolean {
  const 修剪 = 值.trim();
  if (是否合法IPv4(修剪)) return true;
  if (修剪.includes(':') && /^[0-9a-f:.]{2,45}$/i.test(修剪)) return true;
  return false;
}

/** YH-016 真实IP推导：对端不可信直接取对端；可信才读X-Real-IP */
export function 取真实IP(请求: Request): string {
  const 对端 = 请求.socket?.remoteAddress;
  if (!对端) return 回环默认IP;
  const 对端归一 = 归一化IP(对端);
  if (!是否可信代理(对端)) return 对端归一;
  const 头 = 请求.headers['x-real-ip'];
  if (typeof 头 === 'string' && 是否合法IP面量(头)) return 归一化IP(头.trim());
  return 对端归一;
}
