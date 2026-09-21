import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';

function 找仓库根(起点: string): string {
  let 当前 = 起点;
  for (let 步 = 0; 步 < 8; 步 += 1) {
    if (existsSync(join(当前, '管理前端', 'src')) && existsSync(join(当前, '管理后端', 'src'))) {
      return 当前;
    }
    const 上级 = dirname(当前);
    if (上级 === 当前) break;
    当前 = 上级;
  }
  return 当前;
}

const 仓库根 = 找仓库根(process.cwd());
const 管理后端源码 = join(仓库根, '管理后端', 'src');
const 管理前端源码 = join(仓库根, '管理前端', 'src');

function 列出源码文件(目录: string): string[] {
  const 结果: string[] = [];
  for (const 条目 of readdirSync(目录)) {
    const 路径 = join(目录, 条目);
    if (statSync(路径).isDirectory()) {
      结果.push(...列出源码文件(路径));
    } else if (/\.(ts|vue|js)$/.test(条目)) {
      结果.push(路径);
    }
  }
  return 结果;
}

describe('FP-09 结局列存枚举键后的管理端一致性', () => {
  it('两端源码目录均存在', () => {
    expect(existsSync(管理后端源码)).toBe(true);
    expect(existsSync(管理前端源码)).toBe(true);
  });

  it('管理端不读取结局状态/结果状态/结果类型三列', () => {
    const 违例: string[] = [];
    for (const 文件 of [...列出源码文件(管理后端源码), ...列出源码文件(管理前端源码)]) {
      const 内容 = readFileSync(文件, 'utf8');
      if (/结局状态|结果状态|结果类型/.test(内容)) {
        违例.push(文件);
      }
    }
    expect(违例).toEqual([]);
  });

  it('管理端不查询游戏档案/游戏结局表', () => {
    const 违例: string[] = [];
    for (const 文件 of 列出源码文件(管理后端源码)) {
      const 内容 = readFileSync(文件, 'utf8');
      if (/FROM\s+"(游戏档案|游戏结局)"/.test(内容)) {
        违例.push(文件);
      }
    }
    expect(违例).toEqual([]);
  });

  it('管理端不复制结局文案，避免与主仓渲染口径分叉', () => {
    const 结局文案 = ['被渣型骗了', '被渣男骗了', '被渣女骗了', '被渣型套路了', '识破渣型', '好感度归零'];
    const 违例: string[] = [];
    for (const 文件 of [...列出源码文件(管理后端源码), ...列出源码文件(管理前端源码)]) {
      const 内容 = readFileSync(文件, 'utf8');
      if (结局文案.some((案) => 内容.includes(案))) {
        违例.push(文件);
      }
    }
    expect(违例).toEqual([]);
  });
});
