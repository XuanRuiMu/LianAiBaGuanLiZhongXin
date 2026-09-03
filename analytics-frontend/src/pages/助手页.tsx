import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { 常量 } from '../常量'
import { 翻译 } from '../i18n/zh-CN'
import { 流式对话 } from '../api/AI对话接口'
import { 弹出提示 } from '../components/Toast'
import { 渲染气泡文本 } from '../utils/format'
import type { SSE事件 } from '../utils/sse-parser'
import type { 对话历史项 } from '../types/接口类型'

interface 对话条目 {
  角色: 'user' | 'ai' | 'system'
  内容: string
  是否错误?: boolean
}

export function 助手页() {
  const [对话列表, 设置对话列表] = useState<对话条目[]>([])
  const [输入内容, 设置输入内容] = useState('')
  const [发送中, 设置发送中] = useState(false)
  const 底部引用 = useRef<HTMLDivElement>(null)

  useEffect(() => {
    底部引用.current?.scrollIntoView({ behavior: 'smooth' })
  }, [对话列表])

  function 提取历史(): 对话历史项[] {
    return 对话列表
      .filter((条目) => 条目.角色 !== 'system' && 条目.内容.trim() !== '')
      .slice(-常量.AI历史保留轮数 * 2)
      .map((条目) => ({
        role: 条目.角色 === 'user' ? ('user' as const) : ('assistant' as const),
        content: 条目.内容,
      }))
  }

  function 更新末条AI(更新函数: (条目: 对话条目) => 对话条目): void {
    设置对话列表((列表) => {
      if (列表.length === 0 || 列表[列表.length - 1].角色 !== 'ai') return 列表
      const 新列表 = [...列表]
      新列表[新列表.length - 1] = 更新函数(新列表[新列表.length - 1])
      return 新列表
    })
  }

  function 处理流式事件(事件: SSE事件): void {
    if (事件.类型 === 'token') {
      更新末条AI((条目) => ({ ...条目, 内容: 条目.内容 + 事件.内容 }))
    } else if (事件.类型 === 'tool_end') {
      const 摘要 =
        (事件.工具名 && (翻译.助手.工具摘要 as Record<string, string>)[事件.工具名]) ||
        翻译.助手.工具默认摘要
      设置对话列表((列表) => [
        ...列表,
        { 角色: 'system', 内容: `${翻译.助手.工具行前缀}${摘要}` },
      ])
    } else if (事件.类型 === 'error') {
      const 详情 = 事件.内容 ? `\n${事件.内容}` : ''
      更新末条AI((条目) => ({ ...条目, 内容: 条目.内容 + 详情, 是否错误: true }))
    }
  }

  async function 处理发送(原文: string): Promise<void> {
    const 问题 = 原文.trim()
    if (!问题 || 发送中) return
    设置输入内容('')
    设置发送中(true)
    const 历史 = 提取历史()
    设置对话列表((列表) => [...列表, { 角色: 'user', 内容: 问题 }, { 角色: 'ai', 内容: '' }])
    try {
      await 流式对话(问题, 历史, 处理流式事件)
    } catch (err) {
      弹出提示(err instanceof Error && err.message ? err.message : 翻译.通用.网络错误)
      更新末条AI((条目) => ({ ...条目, 是否错误: true }))
    } finally {
      设置发送中(false)
    }
  }

  function 处理按键(事件: KeyboardEvent<HTMLInputElement>): void {
    if (事件.key === 'Enter' && !事件.nativeEvent.isComposing) {
      事件.preventDefault()
      void 处理发送(输入内容)
    }
  }

  function 渲染气泡(条目: 对话条目, 序号: number) {
    if (条目.角色 === 'system') {
      return (
        <div key={序号} className="my-1 text-center text-xs text-slate-500">
          {条目.内容}
        </div>
      )
    }
    const 是用户 = 条目.角色 === 'user'
    const 空气泡 = !是用户 && 条目.内容 === ''
    return (
      <div key={序号} className={`flex ${是用户 ? 'justify-end' : 'justify-start'}`}>
        <div
          className={
            是用户
              ? `max-w-[75%] rounded-2xl rounded-br-sm bg-gradient-to-r from-sky-600 to-violet-600 px-4 py-2.5 text-sm leading-relaxed text-white`
              : `max-w-[75%] rounded-2xl rounded-bl-sm border border-[#22304d]/70 bg-panel/90 px-4 py-2.5 text-sm leading-relaxed text-slate-200 ${
                  条目.是否错误 ? 'border-rose-500/40 text-rose-300' : ''
                }`
          }
        >
          {空气泡 ? (
            <span className="animate-pulse text-slate-500">{翻译.助手.发送中}</span>
          ) : (
            <span dangerouslySetInnerHTML={{ __html: 渲染气泡文本(条目.内容) }} />
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col bg-夜空">
      <header className="flex items-center gap-3 border-b border-[#22304d]/70 bg-[#0b1120]/85 px-6 py-3 backdrop-blur">
        <Link
          to="/dashboard"
          className="rounded-md border border-[#22304d] px-3 py-1.5 text-xs text-slate-400 transition hover:border-sky-500/50 hover:text-sky-300"
        >
          ← {翻译.产品名}
        </Link>
        <h1 className="text-base font-semibold tracking-wide text-slate-200">{翻译.助手.标题}</h1>
        <button
          onClick={() => 设置对话列表([])}
          disabled={对话列表.length === 0}
          className="ml-auto rounded-md border border-[#22304d] px-3 py-1.5 text-xs text-slate-400 transition hover:border-rose-500/50 hover:text-rose-300 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {翻译.助手.清空对话}
        </button>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 space-y-3 overflow-y-auto px-6 py-6">
        {对话列表.length === 0 ? (
          <p className="pt-24 text-center text-sm text-slate-600">{翻译.助手.对话为空提示}</p>
        ) : (
          对话列表.map(渲染气泡)
        )}
        <div ref={底部引用} />
      </main>

      <footer className="border-t border-[#22304d]/70 bg-[#0b1120]/85 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-3xl gap-3">
          <input
            value={输入内容}
            onChange={(e) => 设置输入内容(e.target.value)}
            onKeyDown={处理按键}
            placeholder={翻译.助手.输入占位}
            className="flex-1 rounded-lg border border-[#22304d] bg-[#0d1526] px-4 py-2.5 text-sm text-slate-200 outline-none transition placeholder:text-slate-600 focus:border-sky-500/70"
          />
          <button
            onClick={() => void 处理发送(输入内容)}
            disabled={发送中 || 输入内容.trim() === ''}
            className="rounded-lg bg-gradient-to-r from-sky-500 to-violet-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {发送中 ? 翻译.助手.发送中 : 翻译.助手.发送按钮}
          </button>
        </div>
      </footer>
    </div>
  )
}
