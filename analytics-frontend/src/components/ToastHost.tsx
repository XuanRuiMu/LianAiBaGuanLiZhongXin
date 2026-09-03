import { 使用提示列表 } from './Toast'

export function ToastHost() {
  const 列表 = 使用提示列表()
  if (列表.length === 0) return null
  return (
    <div className="pointer-events-none fixed left-1/2 top-6 z-50 flex -translate-x-1/2 flex-col items-center gap-2">
      {列表.map((条目) => (
        <div
          key={条目.id}
          className="rounded-md border border-sky-500/30 bg-[#0d1424]/95 px-4 py-2 text-sm text-sky-100 shadow-[0_4px_24px_rgba(56,189,248,0.25)]"
        >
          {条目.内容}
        </div>
      ))}
    </div>
  )
}
