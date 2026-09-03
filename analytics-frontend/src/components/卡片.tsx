import type { ReactNode } from 'react'
import { 翻译 } from '../i18n/zh-CN'

interface 卡片属性 {
  标题: string
  加载中?: boolean
  错误信息?: string | null
  重试?: () => void
  类名?: string
  内容类名?: string
  children: ReactNode
}

export function 骨架块({ 类名 = '' }: { 类名?: string }) {
  return <div className={`animate-pulse rounded bg-slate-700/40 ${类名}`} />
}

function 骨架屏() {
  return (
    <div className="flex h-full flex-col gap-3 p-1">
      <div className="flex flex-1 items-end gap-2 pb-2">
        <骨架块 类名="h-1/4 w-6" />
        <骨架块 类名="h-2/3 w-6" />
        <骨架块 类名="h-1/2 w-6" />
        <骨架块 类名="h-3/4 w-6" />
        <骨架块 类名="h-2/5 w-6" />
        <骨架块 类名="h-3/5 w-6" />
      </div>
      <div className="flex gap-2">
        <骨架块 类名="h-3 w-12" />
        <骨架块 类名="h-3 w-16" />
        <骨架块 类名="h-3 w-10" />
      </div>
    </div>
  )
}

function 错误视图({ 错误信息, 重试 }: { 错误信息: string; 重试?: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3">
      <p className="text-sm text-rose-400">{翻译.通用.加载失败}</p>
      <p className="max-w-full truncate text-xs text-slate-500">{错误信息}</p>
      {重试 && (
        <button
          onClick={重试}
          className="rounded border border-sky-500/50 px-4 py-1 text-sm text-sky-300 transition hover:bg-sky-500/10"
        >
          {翻译.通用.重试}
        </button>
      )}
    </div>
  )
}

export function 卡片({ 标题, 加载中 = false, 错误信息, 重试, 类名 = '', 内容类名 = '', children }: 卡片属性) {
  return (
    <section
      className={`rounded-lg border border-[#22304d]/80 bg-panel/80 shadow-[0_0_18px_rgba(56,189,248,0.06)] backdrop-blur ${类名}`}
    >
      <header className="flex items-center gap-2 border-b border-[#22304d]/60 px-4 py-3">
        <span className="h-3 w-1 rounded bg-gradient-to-b from-sky-400 to-violet-400" />
        <h2 className="text-sm font-semibold tracking-wide text-slate-200">{标题}</h2>
      </header>
      <div className={`p-4 ${内容类名}`}>
        {加载中 ? <骨架屏 /> : 错误信息 ? <错误视图 错误信息={错误信息} 重试={重试} /> : children}
      </div>
    </section>
  )
}
