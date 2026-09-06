import { Link, useNavigate } from 'react-router-dom'
import { 常量 } from '../常量'
import { 翻译 } from '../i18n/zh-CN'
import { use异步数据 } from '../hooks/use异步数据'
import { 卡片 } from '../components/卡片'
import { 图表容器 } from '../components/图表容器'
import {
  构建AI用量选项,
  构建人设热度选项,
  构建注册趋势选项,
  构建消息趋势选项,
  构建留存趋势选项,
  构建阶段分布选项,
} from '../components/图表选项'
import {
  获取AI用量,
  获取人设热度,
  获取同步状态,
  获取挑战排行,
  获取消息趋势,
  获取注册趋势,
  获取概览,
  获取留存趋势,
  获取阶段分布,
} from '../api/统计接口'
import { 清除令牌 } from '../api/认证接口'
import { 格式化千分位, 格式化时间, 格式化万单位 } from '../utils/format'

const 取注册趋势 = () => 获取注册趋势(常量.统计天数)
const 取消息趋势 = () => 获取消息趋势(常量.统计天数)
const 取AI用量 = () => 获取AI用量(常量.统计天数)
const 取留存趋势 = () => 获取留存趋势(常量.统计天数)

function 状态点颜色(状态: string): string {
  const 小写 = 状态.toLowerCase()
  if (小写 === 'success') return 'bg-emerald-400'
  if (小写 === 'failed' || 小写 === 'error') return 'bg-rose-400'
  return 'bg-amber-400'
}

function 状态文本(状态: string): string {
  const 小写 = 状态.toLowerCase()
  if (小写 === 'success') return 翻译.大屏.状态成功
  if (小写 === 'failed' || 小写 === 'error') return 翻译.大屏.状态失败
  return 状态
}

function 指标卡({ 标题, 数值 }: { 标题: string; 数值: string }) {
  return (
    <div className="rounded-lg border border-[#22304d]/80 bg-panel/80 p-4 shadow-[0_0_18px_rgba(56,189,248,0.06)] backdrop-blur">
      <p className="text-xs tracking-wider text-slate-500">{标题}</p>
      <p className="mt-2 bg-gradient-to-r from-sky-300 to-violet-300 bg-clip-text text-2xl font-bold text-transparent">
        {数值}
      </p>
    </div>
  )
}

function 同步状态徽标() {
  const { 数据, 加载中 } = use异步数据(获取同步状态)
  if (加载中) {
    return <span className="text-xs text-slate-600">{翻译.大屏.最近同步}…</span>
  }
  const 最近日志 = 数据?.recentLogs?.[0]
  if (!最近日志) {
    return (
      <span className="flex items-center gap-1.5 rounded-full border border-[#22304d] px-3 py-1 text-xs text-slate-500">
        <span className="h-2 w-2 rounded-full bg-slate-600" />
        {翻译.大屏.暂无同步记录}
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1.5 rounded-full border border-[#22304d] bg-[#0d1526]/80 px-3 py-1 text-xs text-slate-400">
      <span className={`h-2 w-2 animate-pulse rounded-full ${状态点颜色(最近日志.status)}`} />
      {翻译.大屏.最近同步} {格式化时间(最近日志.createdAt)}
    </span>
  )
}

function 同步日志列表() {
  const { 数据, 加载中, 错误信息, 重试 } = use异步数据(获取同步状态)
  const 日志列表 = 数据?.recentLogs ?? []
  return (
    <卡片
      标题={翻译.大屏.同步日志}
      加载中={加载中}
      错误信息={错误信息}
      重试={重试}
      类名="h-full"
      内容类名="h-[calc(100%-49px)] overflow-y-auto"
    >
      {日志列表.length === 0 ? (
        <p className="py-8 text-center text-xs text-slate-600">{翻译.通用.暂无数据}</p>
      ) : (
        <ul className="space-y-2">
          {日志列表.slice(0, 常量.同步日志显示条数).map((日志, 序号) => (
            <li
              key={`${日志.createdAt}-${序号}`}
              className="flex items-center gap-2.5 rounded-md border border-[#22304d]/60 bg-[#0d1526]/60 px-3 py-2"
            >
              <span className={`h-2 w-2 shrink-0 rounded-full ${状态点颜色(日志.status)}`} />
              <span className="min-w-0 flex-1 truncate text-xs text-slate-400">
                {日志.errorMsg || 状态文本(日志.status)}
              </span>
              <span className="shrink-0 text-xs text-slate-500">
                {翻译.大屏.同步行数} {格式化千分位(日志.rowsSynced ?? 0)}
              </span>
              <span className="shrink-0 text-xs text-slate-600">{格式化时间(日志.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </卡片>
  )
}

function 排行徽章色(排名: number): string {
  if (排名 === 1) return 'text-amber-300'
  if (排名 === 2) return 'text-slate-300'
  if (排名 === 3) return 'text-orange-400'
  return 'text-slate-500'
}

export function 大屏页() {
  const 导航 = useNavigate()
  const 概览 = use异步数据(获取概览)
  const 注册趋势 = use异步数据(取注册趋势)
  const 消息趋势 = use异步数据(取消息趋势)
  const 阶段分布 = use异步数据(获取阶段分布)
  const 人设热度 = use异步数据(获取人设热度)
  const AI用量 = use异步数据(取AI用量)
  const 留存趋势 = use异步数据(取留存趋势)
  const 挑战排行 = use异步数据(获取挑战排行)

  function 处理退出登录() {
    清除令牌()
    导航('/login', { replace: true })
  }

  const 指标列表 = [
    { 标题: 翻译.大屏.总用户, 数值: 格式化千分位(概览.数据?.totalUsers ?? 0) },
    { 标题: 翻译.大屏.总角色, 数值: 格式化千分位(概览.数据?.totalRoles ?? 0) },
    { 标题: 翻译.大屏.总消息, 数值: 格式化万单位(概览.数据?.totalMessages ?? 0) },
    { 标题: 翻译.大屏.新增用户24小时, 数值: 格式化千分位(概览.数据?.newUsers24h ?? 0) },
    { 标题: 翻译.大屏.新增消息24小时, 数值: 格式化万单位(概览.数据?.newMessages24h ?? 0) },
  ]

  const 排行数据 = (挑战排行.数据 ?? []).slice(0, 常量.挑战榜数量)

  return (
    <div className="min-h-screen bg-夜空 pb-6">
      <header className="sticky top-0 z-40 border-b border-[#22304d]/70 bg-[#0b1120]/85 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] items-center gap-4 px-6 py-3">
          <h1 className="text-lg font-bold tracking-wider">
            <span className="bg-gradient-to-r from-sky-400 via-cyan-300 to-violet-400 bg-clip-text text-transparent">
              {翻译.产品名}
            </span>
          </h1>
          <div className="ml-auto flex items-center gap-3">
            <同步状态徽标 />
            <Link
              to="/assistant"
              className="rounded-md border border-violet-500/40 px-3 py-1.5 text-xs text-violet-300 transition hover:bg-violet-500/10"
            >
              {翻译.大屏.助手入口}
            </Link>
            <Link
              to="/ops"
              className="rounded-md border border-sky-500/40 px-3 py-1.5 text-xs text-sky-300 transition hover:bg-sky-500/10"
            >
              {翻译.运营.标题}
            </Link>
            <Link
              to="/orchestrate"
              className="rounded-md border border-emerald-500/40 px-3 py-1.5 text-xs text-emerald-300 transition hover:bg-emerald-500/10"
            >
              编排
            </Link>
            <button
              onClick={处理退出登录}
              className="rounded-md border border-[#22304d] px-3 py-1.5 text-xs text-slate-400 transition hover:border-rose-500/50 hover:text-rose-300"
            >
              {翻译.通用.退出登录}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] space-y-4 px-6 pt-4">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
          {指标列表.map((指标) => (
            <div key={指标.标题}>
              {概览.加载中 ? (
                <div className="animate-pulse rounded-lg border border-[#22304d]/80 bg-panel/80 p-4">
                  <div className="mb-3 h-3 w-16 rounded bg-slate-700/40" />
                  <div className="h-7 w-24 rounded bg-slate-700/40" />
                </div>
              ) : 概览.错误信息 ? (
                <div className="flex h-[92px] flex-col items-center justify-center gap-1.5 rounded-lg border border-[#22304d]/80 bg-panel/80 p-4">
                  <p className="text-xs text-rose-400">{翻译.通用.加载失败}</p>
                  <button
                    onClick={概览.重试}
                    className="rounded border border-sky-500/50 px-3 py-0.5 text-xs text-sky-300 hover:bg-sky-500/10"
                  >
                    {翻译.通用.重试}
                  </button>
                </div>
              ) : (
                <指标卡 标题={指标.标题} 数值={指标.数值} />
              )}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <卡片
            标题={翻译.大屏.注册趋势(常量.统计天数)}
            加载中={注册趋势.加载中}
            错误信息={注册趋势.错误信息}
            重试={注册趋势.重试}
            类名="xl:col-span-8"
            内容类名="h-[280px]"
          >
            <图表容器 选项={构建注册趋势选项(注册趋势.数据 ?? [])} />
          </卡片>

          <卡片
            标题={翻译.大屏.阶段分布}
            加载中={阶段分布.加载中}
            错误信息={阶段分布.错误信息}
            重试={阶段分布.重试}
            类名="xl:col-span-4"
            内容类名="h-[280px]"
          >
            {(阶段分布.数据 ?? []).length === 0 ? (
              <p className="pt-24 text-center text-xs text-slate-600">{翻译.通用.暂无数据}</p>
            ) : (
              <图表容器 选项={构建阶段分布选项(阶段分布.数据 ?? [])} />
            )}
          </卡片>

          <卡片
            标题={翻译.大屏.消息趋势(常量.统计天数)}
            加载中={消息趋势.加载中}
            错误信息={消息趋势.错误信息}
            重试={消息趋势.重试}
            类名="xl:col-span-8"
            内容类名="h-[280px]"
          >
            <图表容器 选项={构建消息趋势选项(消息趋势.数据 ?? [])} />
          </卡片>

          <卡片
            标题={翻译.大屏.人设热度}
            加载中={人设热度.加载中}
            错误信息={人设热度.错误信息}
            重试={人设热度.重试}
            类名="xl:col-span-4"
            内容类名="h-[280px]"
          >
            {(人设热度.数据 ?? []).length === 0 ? (
              <p className="pt-24 text-center text-xs text-slate-600">{翻译.通用.暂无数据}</p>
            ) : (
              <图表容器
                选项={构建人设热度选项((人设热度.数据 ?? []).slice(0, 常量.人设榜数量))}
              />
            )}
          </卡片>

          <卡片
            标题={翻译.大屏.AI用量(常量.统计天数)}
            加载中={AI用量.加载中}
            错误信息={AI用量.错误信息}
            重试={AI用量.重试}
            类名="xl:col-span-7"
            内容类名="h-[280px]"
          >
            <图表容器 选项={构建AI用量选项(AI用量.数据 ?? [])} />
          </卡片>

          <div className="xl:col-span-5">
            <同步日志列表 />
          </div>

          <卡片
            标题={翻译.大屏.留存趋势(常量.统计天数)}
            加载中={留存趋势.加载中}
            错误信息={留存趋势.错误信息}
            重试={留存趋势.重试}
            类名="xl:col-span-12"
            内容类名="h-[280px]"
          >
            <图表容器 选项={构建留存趋势选项(留存趋势.数据 ?? [])} />
          </卡片>

          <卡片
            标题={翻译.大屏.挑战排行(常量.挑战榜数量)}
            加载中={挑战排行.加载中}
            错误信息={挑战排行.错误信息}
            重试={挑战排行.重试}
            类名="xl:col-span-12"
          >
            {排行数据.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-600">{翻译.通用.暂无数据}</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#22304d]/70 text-xs text-slate-500">
                    <th className="px-3 py-2 text-left font-normal">{翻译.大屏.排名}</th>
                    <th className="px-3 py-2 text-left font-normal">{翻译.大屏.用户}</th>
                    <th className="px-3 py-2 text-right font-normal">{翻译.大屏.分数}</th>
                    <th className="px-3 py-2 text-right font-normal">{翻译.大屏.聊天天数}</th>
                  </tr>
                </thead>
                <tbody>
                  {排行数据.map((行) => (
                    <tr
                      key={`${行.rankNo}-${行.userName}`}
                      className="border-b border-[#22304d]/40 transition hover:bg-sky-500/5"
                    >
                      <td className={`px-3 py-2 font-bold ${排行徽章色(行.rankNo)}`}>
                        {行.rankNo}
                      </td>
                      <td className="px-3 py-2 text-slate-300">{行.userName}</td>
                      <td className="px-3 py-2 text-right text-sky-300">
                        {格式化千分位(行.score)}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-400">
                        {格式化千分位(行.chatDays)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </卡片>
        </div>
      </main>
    </div>
  )
}
