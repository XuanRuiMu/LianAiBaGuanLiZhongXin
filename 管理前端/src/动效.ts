export const 过渡前进 = '页-qian-jin';

export const 过渡后退 = '页-hou-tui';

export type 过渡名 = typeof 过渡前进 | typeof 过渡后退;

export type 页面端点 = {
  路径: string;
  需登录: boolean;
};

export function 导航位次(导航序: readonly string[], 路径: string): number {
  let 秩 = -1;
  let 命中长 = -1;
  for (let 位 = 0; 位 < 导航序.length; 位++) {
    const 前缀 = 导航序[位];
    if (路径 === 前缀 || 路径.startsWith(`${前缀}/`)) {
      if (前缀.length > 命中长) {
        命中长 = 前缀.length;
        秩 = 位;
      }
    }
  }
  return 秩;
}

function 路径深度(路径: string): number {
  return 路径.split('/').filter((段) => 段.length > 0).length;
}

export function 页面过渡名(导航序: readonly string[], 旧页: 页面端点 | null, 新页: 页面端点): 过渡名 {
  if (旧页 === null) {
    return 过渡前进;
  }
  if (旧页.需登录 !== 新页.需登录) {
    return 新页.需登录 ? 过渡前进 : 过渡后退;
  }
  const 旧秩 = 导航位次(导航序, 旧页.路径);
  const 新秩 = 导航位次(导航序, 新页.路径);
  if (旧秩 >= 0 && 新秩 >= 0) {
    if (新秩 !== 旧秩) {
      return 新秩 > 旧秩 ? 过渡前进 : 过渡后退;
    }
    return 路径深度(新页.路径) >= 路径深度(旧页.路径) ? 过渡前进 : 过渡后退;
  }
  if (旧秩 >= 0 && 新秩 < 0) {
    return 过渡后退;
  }
  return 过渡前进;
}
