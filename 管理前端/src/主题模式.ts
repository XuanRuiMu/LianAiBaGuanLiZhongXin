const 存储键 = 'lian-ai-guan-li-zhu-ti';

const 主题过渡类 = '主题过渡';

const 过渡时长令牌 = '--时长短';

export type 主题名 = '浅' | '深';

export const 浅色: 主题名 = '浅';

export const 深色: 主题名 = '深';

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

function 令牌毫秒(): number {
  const 声明 = window.getComputedStyle(document.documentElement).getPropertyValue(过渡时长令牌).trim();
  const 数值 = Number.parseFloat(声明);
  if (!Number.isFinite(数值) || 数值 <= 0) {
    return 0;
  }
  return 声明.endsWith('ms') ? 数值 : 数值 * 1000;
}

let 已应用主题: 主题名 | null = null;

let 撤类计时: number | undefined;

export function 应用主题(主题: 主题名): void {
  const 根 = document.documentElement;
  if (已应用主题 !== null && 已应用主题 !== 主题) {
    if (撤类计时 !== undefined) {
      window.clearTimeout(撤类计时);
    }
    根.classList.add(主题过渡类);
    撤类计时 = window.setTimeout(() => {
      根.classList.remove(主题过渡类);
      撤类计时 = undefined;
    }, 令牌毫秒());
  }
  已应用主题 = 主题;
  根.classList.toggle('dark', 主题 === '深');
  try {
    window.localStorage.setItem(存储键, 主题);
  } catch {
    return;
  }
}
