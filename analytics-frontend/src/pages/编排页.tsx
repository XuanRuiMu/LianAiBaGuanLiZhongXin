import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Background,
  Controls,
  ReactFlow,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { 翻译 } from '../i18n/zh-CN'
import { 弹出提示 } from '../components/Toast'
import {
  审批编排,
  导出流程YAML,
  保存编排流程,
  查询回放,
  运行编排流程,
  type 编排边,
  type 编排节点,
} from '../api/编排接口'

const 八类节点 = ['开始', '结束', '大模型', '工具调用', '条件分支', '循环', '代码', '人工审批']

let 计数 = 0

function 状态边框(状态?: string): string {
  if (状态 === '成功') return 'border-emerald-400'
  if (状态 === '失败') return 'border-rose-400'
  if (状态 === '跳过') return 'border-slate-500'
  return 'border-[#22304d]'
}

export function 编排页() {
  const [节点们, 设置节点, 处理节点变化] = useNodesState([] as Node[])
  const [边们, 设置边, 处理边变化] = useEdgesState([] as Edge[])
  const [流程名, 设置流程名] = useState('演示流程')
  const [选中编号, 设置选中] = useState<string | null>(null)
  const [参数表, 设置参数表] = useState<Record<string, string>>({})
  const [输入文本, 设置输入文本] = useState('{}')
  const [跟踪号, 设置跟踪号] = useState('')
  const [节点状态, 设置节点状态] = useState<Record<string, string>>({})
  const [忙, 设置忙] = useState(false)

  const 添加节点 = useCallback(
    (类型: string) => {
      计数 += 1
      const 编号 = `${类型}${计数}`
      设置节点((列表) => [
        ...列表,
        {
          id: 编号,
          type: 'default',
          position: { x: 60 + (列表.length % 5) * 170, y: 60 + Math.floor(列表.length / 5) * 110 },
          data: { label: `${类型} · ${编号}`, 类型 },
        },
      ])
    },
    [设置节点],
  )

  const 处理连接 = useCallback(
    (连接: Connection) => 设置边((列表) => addEdge({ ...连接, animated: true }, 列表)),
    [设置边],
  )

  const 当前节点 = 节点们.find((节点) => 节点.id === 选中编号)

  function 收集定义(): { 名称: string; 节点: 编排节点[]; 边: 编排边[] } {
    return {
      名称: 流程名.trim() || '未命名流程',
      节点: 节点们.map((节点) => {
        let 参数: Record<string, unknown> = {}
        try {
          参数 = JSON.parse(参数表[节点.id] ?? '{}') as Record<string, unknown>
        } catch {
          参数 = {}
        }
        return {
          编号: 节点.id,
          类型: String((节点.data as { 类型?: string }).类型 ?? '代码'),
          参数,
        }
      }),
      边: 边们
        .filter((边) => 边.source && 边.target)
        .map((边) => ({ 从: 边.source, 到: 边.target })),
    }
  }

  async function 处理保存() {
    设置忙(true)
    try {
      const 结果 = await 保存编排流程(收集定义())
      弹出提示(`已保存 v${结果.版本}`)
    } catch (错误) {
      弹出提示(错误 instanceof Error ? 错误.message : '保存失败')
    } finally {
      设置忙(false)
    }
  }

  async function 处理运行() {
    let 输入: Record<string, unknown> = {}
    try {
      输入 = JSON.parse(输入文本) as Record<string, unknown>
    } catch {
      弹出提示('输入不是合法 JSON')
      return
    }
    设置忙(true)
    try {
      await 保存编排流程(收集定义())
      const 结果 = await 运行编排流程(流程名.trim(), 输入)
      const 状态表: Record<string, string> = {}
      for (const [编号, 信息] of Object.entries(结果.节点状态)) {
        状态表[编号] = 信息.状态
      }
      设置节点状态(状态表)
      设置跟踪号(结果.跟踪号)
      if (结果.状态 === '挂起') {
        弹出提示('流程已挂起等待审批')
      } else {
        弹出提示(`执行${结果.状态}`)
      }
    } catch (错误) {
      弹出提示(错误 instanceof Error ? 错误.message : '运行失败')
    } finally {
      设置忙(false)
    }
  }

  async function 处理审批(批准: boolean) {
    const 执行号 = prompt('执行号')
    if (!执行号) return
    try {
      await 审批编排(执行号, 批准)
      弹出提示('审批已提交')
    } catch (错误) {
      弹出提示(错误 instanceof Error ? 错误.message : '审批失败')
    }
  }

  async function 处理回放() {
    if (!跟踪号.trim()) {
      弹出提示('请先运行或填写跟踪号')
      return
    }
    try {
      const 跨度们 = await 查询回放(跟踪号.trim())
      const 状态表: Record<string, string> = {}
      for (const 跨度 of 跨度们) 状态表[跨度.节点] = 跨度.状态
      设置节点状态(状态表)
      弹出提示(`回放 ${跨度们.length} 个跨度`)
    } catch (错误) {
      弹出提示(错误 instanceof Error ? 错误.message : '回放失败')
    }
  }

  async function 处理导出() {
    try {
      const 结果 = await 导出流程YAML(流程名.trim())
      await navigator.clipboard.writeText(结果.yaml)
      弹出提示('YAML 已复制')
    } catch (错误) {
      弹出提示(错误 instanceof Error ? 错误.message : '导出失败')
    }
  }

  return (
    <div className="flex h-screen flex-col bg-夜空">
      <header className="flex items-center gap-2 border-b border-[#22304d]/70 px-4 py-2">
        <Link to="/dashboard" className="text-xs text-slate-400 hover:text-slate-200">
          ← 大屏
        </Link>
        <input
          value={流程名}
          onChange={(事件) => 设置流程名(事件.target.value)}
          className="w-40 rounded border border-[#22304d] bg-[#0d1526] px-2 py-1 text-xs text-slate-200"
        />
        <input
          value={输入文本}
          onChange={(事件) => 设置输入文本(事件.target.value)}
          placeholder="输入 JSON"
          className="w-48 rounded border border-[#22304d] bg-[#0d1526] px-2 py-1 text-xs text-slate-200"
        />
        <button
          onClick={处理保存}
          disabled={忙}
          className="rounded border border-sky-500/40 px-3 py-1 text-xs text-sky-300"
        >
          保存
        </button>
        <button
          onClick={处理运行}
          disabled={忙}
          className="rounded bg-sky-500 px-3 py-1 text-xs text-white"
        >
          运行
        </button>
        <button onClick={() => 处理审批(true)} className="rounded border px-3 py-1 text-xs text-slate-300">
          批准
        </button>
        <button onClick={() => 处理审批(false)} className="rounded border px-3 py-1 text-xs text-slate-300">
          驳回
        </button>
        <input
          value={跟踪号}
          onChange={(事件) => 设置跟踪号(事件.target.value)}
          placeholder="跟踪号"
          className="w-36 rounded border border-[#22304d] bg-[#0d1526] px-2 py-1 text-xs text-slate-200"
        />
        <button onClick={处理回放} className="rounded border px-3 py-1 text-xs text-slate-300">
          回放
        </button>
        <button onClick={处理导出} className="rounded border px-3 py-1 text-xs text-slate-300">
          导出YAML
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-32 space-y-2 overflow-y-auto border-r border-[#22304d]/70 p-2">
          {八类节点.map((类型) => (
            <button
              key={类型}
              onClick={() => 添加节点(类型)}
              className="w-full rounded border border-[#22304d] px-2 py-1.5 text-xs text-slate-300 hover:border-sky-500/50"
            >
              ＋ {类型}
            </button>
          ))}
        </aside>

        <div className="flex-1">
          <ReactFlow
            nodes={节点们.map((节点) => ({
              ...节点,
              style: {
                ...节点.style,
                borderWidth: 2,
                borderColor:
                  节点状态[节点.id] === '成功'
                    ? '#34d399'
                    : 节点状态[节点.id] === '失败'
                      ? '#fb7185'
                      : undefined,
              },
              className: `${节点.className ?? ''} ${状态边框(节点状态[节点.id])}`,
            }))}
            edges={边们}
            onNodesChange={处理节点变化}
            onEdgesChange={处理边变化}
            onConnect={处理连接}
            onNodeClick={(_, 节点) => {
              设置选中(节点.id)
            }}
            fitView
          >
            <Background />
            <Controls />
          </ReactFlow>
        </div>

        <aside className="w-64 overflow-y-auto border-l border-[#22304d]/70 p-3">
          <h2 className="mb-2 text-xs text-slate-400">节点参数（JSON）</h2>
          {当前节点 ? (
            <>
              <p className="mb-2 text-xs text-slate-300">{当前节点.id}</p>
              <textarea
                value={选中编号 ? (参数表[选中编号] ?? '{}') : '{}'}
                onChange={(事件) =>
                  选中编号 &&
                  设置参数表((表) => ({ ...表, [选中编号]: 事件.target.value }))
                }
                rows={12}
                className="w-full rounded border border-[#22304d] bg-[#0d1526] p-2 font-mono text-xs text-slate-200"
              />
              <p className="mt-2 text-xs text-slate-500">保存时随流程一起提交</p>
            </>
          ) : (
            <p className="text-xs text-slate-600">点击画布节点后编辑</p>
          )}
          <h2 className="mb-2 mt-4 text-xs text-slate-400">{翻译.运营.标题}入口</h2>
          <Link to="/ops" className="text-xs text-sky-300">
            前往运营看板 →
          </Link>
        </aside>
      </div>
    </div>
  )
}
