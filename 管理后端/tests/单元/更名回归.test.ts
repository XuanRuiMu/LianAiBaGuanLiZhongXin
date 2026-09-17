import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

function 旧中文(): string {
  return String.fromCharCode(0x604b, 0x7231, 0x5427, 0x6570, 0x636e, 0x4e2d, 0x5fc3);
}

function 旧英文(): string {
  return ['L', 'i', 'a', 'n', 'A', 'i', 'B', 'a', 'D', 'a', 't', 'a', 'C', 'e', 'n', 't', 'e', 'r'].join('');
}

function 旧英文小写连字符(): string {
  return ['l', 'i', 'a', 'n', '-', 'a', 'i', '-', 'b', 'a', '-', 'd', 'a', 't', 'a', '-', 'c', 'e', 'n', 't', 'e', 'r'].join('');
}

const 跳过目录 = new Set(['node_modules', 'dist', '.git', '.test-chroma', '测试截图', 'logs']);
const 跳过后缀 = new Set(['.sqlite3', '.woff2', '.png', '.jpg', '.jpeg', '.ico', '.db', '.woff', '.ttf', '.mp3', '.mp4', '.jar']);
const 允许后缀 = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json', '.md', '.txt', '.yml', '.yaml', '.ps1', '.sh', '.html', '.vue', '.py', '.java', '.xml', '.properties', '.toml', '.ini']);

function 应跳过(绝对路径: string, 相对路径: string): boolean {
  const 段 = 相对路径.split(path.sep);
  for (const s of 段) {
    if (跳过目录.has(s)) {
      return true;
    }
  }
  const 后缀 = path.extname(绝对路径).toLowerCase();
  if (跳过后缀.has(后缀)) {
    return true;
  }
  if (后缀 !== '' && !允许后缀.has(后缀)) {
    return true;
  }
  return false;
}

function 收集文件(根: string): string[] {
  const 结果: string[] = [];
  const 栈: string[] = [根];
  while (栈.length > 0) {
    const 当前 = 栈.pop() as string;
    let 状态: fs.Stats;
    try {
      状态 = fs.statSync(当前);
    } catch {
      continue;
    }
    if (状态.isDirectory()) {
      let 子: string[];
      try {
        子 = fs.readdirSync(当前);
      } catch {
        continue;
      }
      for (const 名称 of 子) {
        const 全 = path.join(当前, 名称);
        const 相对 = path.relative(根, 全);
        if (应跳过(全, 相对)) {
          continue;
        }
        栈.push(全);
      }
    } else if (状态.isFile()) {
      if (状态.size > 2 * 1024 * 1024) {
        continue;
      }
      const 相对 = path.relative(根, 当前);
      if (应跳过(当前, 相对)) {
        continue;
      }
      结果.push(当前);
    }
  }
  return 结果;
}

describe('更名回归', () => {
  it('全工作区无旧称残留', { timeout: 120000 }, () => {
    const 后端目录 = path.resolve(__dirname, '..', '..');
    const 管理中心目录 = path.resolve(后端目录, '..');
    const 工作区根 = path.resolve(管理中心目录, '..');
    const 旧中 = 旧中文();
    const 旧英 = 旧英文();
    const 旧英连 = 旧英文小写连字符();
    const 文件列表 = 收集文件(工作区根);
    const 命中: string[] = [];
    for (const 文件 of 文件列表) {
      let 内容: string;
      try {
        内容 = fs.readFileSync(文件, 'utf8');
      } catch {
        continue;
      }
      if (内容.includes(旧中) || 内容.includes(旧英) || 内容.toLowerCase().includes(旧英连)) {
        命中.push(path.relative(工作区根, 文件));
      }
      if (命中.length >= 20) {
        break;
      }
    }
    expect(命中).toEqual([]);
  });
});
