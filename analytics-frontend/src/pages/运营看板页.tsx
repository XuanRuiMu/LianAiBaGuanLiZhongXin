import { Link } from 'react-router-dom'
import { 翻译 } from '../i18n/zh-CN'
import { use异步数据 } from '../hooks/use异步数据'
import { 卡片 } from '../components/卡片'
import { 获取运营总览 } from '../api/统计接口'

export function 运营看板页() {
  const 总览 = use异步数据(获取运营总览)

  return (
    <div className="min-h-screen bg-夜空 pb-6">
      <header className="sticky top-0 z-40 border-b border-[#22304d]/70 bg-[#0b1120]/85 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] items-center gap-4 px-6 py-3">
          <h1 className="text-lg font-bold tracking-wider">
            <span className="bg-gradient-to-r from-sky-400 via-cyan-300 to-violet-400 bg-clip-text text-transparent">
              {翻译.运营.标题}
            </span>
          </h1>
          <div className="ml-auto">
            <Link
              to="/dashboard"
              className="rounded-md border border-[#22304d] px-3 py-1.5 text-xs text-slate-400 transition hover:text-slate-200"
            >
              {翻译.运营.返回大屏}
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] space-y-4 px-6 pt-4">
        {总览.加载中 ? (
          <p className="text-sm text-slate-500">{翻译.通用.加载中}</p>
        ) : 总览.错误信息 ? (
          <div className="rounded-lg border border-rose-500/30 p-4 text-sm text-rose-300">
            {总览.错误信息}
            <button onClick={总览.重试} className="ml-4 underline">
              {翻译.通用.重试}
            </button>
          </div>
        ) : (
          <>
            <卡片 标题={翻译.运营.血缘标题}>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {(总览.数据?.血缘 ?? []).map((节点, 序号, 列表) => (
                  <span key={节点} className="flex items-center gap-2">
                    <span className="rounded-md border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-sky-200">
                      {节点}
                    </span>
                    {序号 < 列表.length - 1 && <span className="text-slate-600">→</span>}
                  </span>
                ))}
              </div>
            </卡片>

            <卡片 标题={翻译.运营.类型状态标题}>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
                {(总览.数据?.类型状态 ?? []).map((项) => (
                  <div
                    key={项.类型}
                    className="rounded-lg border border-[#22304d]/80 bg-[#0d1526] p-3"
                  >
                    <p className="text-xs text-slate-400">{项.类型}</p>
                    <p className="mt-1 text-xl font-bold text-slate-100">
                      {(项.成功率 * 100).toFixed(0)}%
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {翻译.运营.成功率} {项.成功次数}/{项.运行次数}
                    </p>
                    <p className="text-xs text-slate-500">
                      {翻译.运营.平均耗时} {项.平均耗时毫秒}
                      {翻译.运营.毫秒}
                    </p>
                    <p
                      className={`mt-1 text-xs ${项.迟到 ? 'text-rose-300' : 'text-emerald-300'}`}
                    >
                      {项.迟到 ? 翻译.运营.迟到 : 翻译.运营.正常}
                    </p>
                  </div>
                ))}
              </div>
            </卡片>

            <卡片 标题={翻译.运营.质量告警标题}>
              {(总览.数据?.质量告警 ?? []).length === 0 ? (
                <p className="text-sm text-slate-500">{翻译.运营.无告警}</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {(总览.数据?.质量告警 ?? []).map((告警, 序号) => (
                    <li
                      key={序号}
                      className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-amber-200"
                    >
                      {String(告警.批次号 ?? '')} · {String(告警.类型 ?? '')} ·{' '}
                      {String(告警.检查项 ?? '')}
                    </li>
                  ))}
                </ul>
              )}
            </卡片>
          </>
        )}
      </main>
    </div>
  )
}
