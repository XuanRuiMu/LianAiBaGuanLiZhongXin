import { useEffect, useState } from 'react'
import { 常量 } from '../常量'

export interface 提示条目 {
  id: number
  内容: string
}

let 自增序号 = 0
let 条目列表: 提示条目[] = []
const 监听器集合 = new Set<(条目: 提示条目[]) => void>()

function 广播(): void {
  for (const 监听 of 监听器集合) 监听(条目列表)
}

export function 弹出提示(内容: string): void {
  const 条目: 提示条目 = { id: ++自增序号, 内容 }
  条目列表 = [...条目列表, 条目]
  广播()
  setTimeout(() => {
    条目列表 = 条目列表.filter((现有) => 现有.id !== 条目.id)
    广播()
  }, 常量.Toast持续毫秒)
}

export function 使用提示列表(): 提示条目[] {
  const [列表, 设置列表] = useState<提示条目[]>(条目列表)
  useEffect(() => {
    const 监听 = (新列表: 提示条目[]) => 设置列表(新列表)
    监听器集合.add(监听)
    return () => {
      监听器集合.delete(监听)
    }
  }, [])
  return 列表
}
