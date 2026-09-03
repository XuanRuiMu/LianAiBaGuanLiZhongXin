import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { 常量 } from '../常量'
import { 登录 as 调用登录, 保存令牌 } from '../api/认证接口'
import { 业务错误 } from '../api/http'
import { 翻译 } from '../i18n/zh-CN'

export function 登录页() {
  const 导航 = useNavigate()
  const [用户名, 设置用户名] = useState('')
  const [密码, 设置密码] = useState('')
  const [提交中, 设置提交中] = useState(false)
  const [失败原因, 设置失败原因] = useState<string | null>(null)

  async function 处理提交(事件: FormEvent) {
    事件.preventDefault()
    if (!用户名.trim() || !密码) return
    设置提交中(true)
    设置失败原因(null)
    try {
      const 结果 = await 调用登录(用户名.trim(), 密码)
      if (!结果.token) {
        设置失败原因(翻译.登录.失败默认提示)
        return
      }
      保存令牌(结果.token)
      导航('/dashboard', { replace: true })
    } catch (err) {
      设置失败原因(err instanceof 业务错误 && err.message ? err.message : 翻译.登录.失败默认提示)
    } finally {
      设置提交中(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-夜空">
      <div className="pointer-events-none absolute -left-40 -top-40 h-96 w-96 rounded-full bg-sky-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-violet-500/10 blur-3xl" />
      <form
        onSubmit={处理提交}
        className="relative z-10 w-full max-w-sm rounded-xl border border-[#22304d]/80 bg-panel/90 p-8 shadow-[0_0_40px_rgba(56,189,248,0.12)] backdrop-blur"
      >
        <h1 className="mb-1 text-center text-2xl font-bold tracking-wide">
          <span className="bg-gradient-to-r from-sky-400 to-violet-400 bg-clip-text text-transparent">
            {翻译.产品名}
          </span>
        </h1>
        <p className="mb-8 text-center text-xs text-slate-500">{翻译.登录.标题}</p>

        <label className="mb-4 block">
          <input
            value={用户名}
            onChange={(e) => 设置用户名(e.target.value)}
            placeholder={翻译.登录.用户名占位}
            autoComplete="username"
            className="w-full rounded-md border border-[#22304d] bg-[#0d1526] px-3 py-2.5 text-sm text-slate-200 outline-none transition placeholder:text-slate-600 focus:border-sky-500/70"
          />
        </label>
        <label className="mb-2 block">
          <input
            type="password"
            value={密码}
            onChange={(e) => 设置密码(e.target.value)}
            placeholder={翻译.登录.密码占位}
            autoComplete="current-password"
            className="w-full rounded-md border border-[#22304d] bg-[#0d1526] px-3 py-2.5 text-sm text-slate-200 outline-none transition placeholder:text-slate-600 focus:border-sky-500/70"
          />
        </label>

        {失败原因 && <p className="mb-2 text-xs text-rose-400">{失败原因}</p>}

        <button
          type="submit"
          disabled={提交中}
          className="mt-4 w-full rounded-md bg-gradient-to-r from-sky-500 to-violet-500 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {提交中 ? 翻译.登录.登录中 : 翻译.登录.提交按钮}
        </button>

        <p className="mt-6 text-center text-xs text-slate-600">
          {翻译.登录.演示前缀}
          {常量.演示账号.用户名} / {常量.演示账号.密码}
        </p>
      </form>
    </div>
  )
}
