const 存储键 = 'lian-ai-guan-li-zhu-ti';

export type 主题名 = '浅' | '深';

export function 读初始主题(): 主题名 {
  try {
    const 存 = window.localStorage.getItem(存储键);
    if (存 === '深' || 存 === '浅') {
      return 存;
    }
  } catch {
    return '浅';
  }
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return '深';
  }
  return '浅';
}

export function 应用主题(主题: 主题名): void {
  document.documentElement.classList.toggle('dark', 主题 === '深');
  try {
    window.localStorage.setItem(存储键, 主题);
  } catch {
    return;
  }
}
