declare module 'node:fs' {
  interface 文件状态 {
    isFile(): boolean;
    isDirectory(): boolean;
  }
  interface 文件系统 {
    readFileSync(路径: string, 编码: string): string;
    existsSync(路径: string): boolean;
    statSync(路径: string): 文件状态;
    readdirSync(路径: string): string[];
  }
  const fs: 文件系统;
  export default fs;
}

declare module 'node:crypto' {
  interface 哈希 {
    update(数据: string): 哈希;
    digest(编码: string): string;
  }
  function createHash(算法: string): 哈希;
}
