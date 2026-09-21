import fs from 'node:fs';
import { createHash } from 'node:crypto';

function 收集文件(目录: string, 前缀: string, 结果: string[]): void {
  for (const 名 of fs.readdirSync(目录)) {
    const 全 = `${目录}/${名}`;
    if (fs.statSync(全).isDirectory()) {
      收集文件(全, 前缀, 结果);
    } else {
      结果.push(全.slice(前缀.length));
    }
  }
}

export function 源码指纹(根目录 = '.'): string {
  const 前缀 = 根目录.endsWith('/') ? 根目录 : `${根目录}/`;
  const 文件: string[] = [];
  收集文件(`${前缀}src`, 前缀, 文件);
  文件.push('index.html');
  const 摘要 = createHash('sha256');
  for (const 相对路径 of 文件.sort()) {
    const 内容 = fs.readFileSync(相对路径 === 'index.html' ? `${前缀}index.html` : `${前缀}${相对路径}`, 'utf8');
    摘要.update(`${相对路径}:${内容.length}:`);
    摘要.update(内容);
  }
  return 摘要.digest('hex');
}
