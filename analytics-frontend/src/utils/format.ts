export function 格式化千分位(值: number): string {
  if (!Number.isFinite(值)) return '-'
  return 值.toLocaleString('zh-CN', { maximumFractionDigits: 2 })
}

export function 格式化万单位(值: number): string {
  if (!Number.isFinite(值)) return '-'
  if (Math.abs(值) >= 10000) {
    const 万值 = (值 / 10000).toFixed(1).replace(/\.0$/, '')
    return `${万值}万`
  }
  return 格式化千分位(值)
}

export function 格式化时间(iso文本: string): string {
  if (!iso文本) return '-'
  const 时间 = new Date(iso文本)
  if (Number.isNaN(时间.getTime())) return iso文本
  const 补零 = (数: number) => String(数).padStart(2, '0')
  const 月 = 补零(时间.getMonth() + 1)
  const 日 = 补零(时间.getDate())
  const 时 = 补零(时间.getHours())
  const 分 = 补零(时间.getMinutes())
  return `${月}-${日} ${时}:${分}`
}

export function 转义HTML(文本: string): string {
  return 文本
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function 渲染气泡文本(原文: string): string {
  const 安全 = 转义HTML(原文)
  const 加粗 = 安全.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  return 加粗.replace(/\n/g, '<br/>')
}
