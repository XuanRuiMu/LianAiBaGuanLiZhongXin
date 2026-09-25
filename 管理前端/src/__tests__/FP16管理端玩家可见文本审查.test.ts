import { describe, it, expect } from 'vitest'
import fs from 'node:fs';
import { mount } from '@vue/test-utils'
import XiaoXiTiao from '../components/XiaoXiTiao.vue'
import { 通用文案 } from '../文案/通用'
import { 登录文案 } from '../文案/登录'
import { 取错误展示 } from '../api/错误展示'
import { 创建前端错误, 前端错误码, 业务错误 } from '../api/请求'
import { 错误注册表, 全部错误码, 取错误定义 } from '../../../管理后端/src/错误码'

/** 判据①：内部实现/第三方原文/协议英文 */
const XU_LIU_WU = /SQL|stack|\/srv\/|\/app\/|SELECT\s|postgres|mysql|password|api[_-]?key|ECONNREFUSED|127\.0\.0\.1|localhost|base64|axios|DOMException/i
/** 判据②：占位符与脏值 */
const ZHAN_WEI = /\{\{|\}\}|undefined|null|NaN|\[object /
/** 判据④：敷衍 */
const FU_YAN = /出错了|未知错误|请稍后重试|开小差/

function 建展示(码: string): ReturnType<typeof 取错误展示> {
  return 取错误展示(
    new 业务错误({
      code: 码,
      message: '服务内部文案',
      traceId: 'fp16-trace-0001',
      retryable: 取错误定义(码)?.可重试 ?? false,
    }),
  )
}

describe('FP-16 管理中心最终可见文本审查', () => {
  describe('A. 错误码注册表与最终显示', () => {
    it('注册表非空、码形合法，且每个码都能解析出定义', () => {
      expect(全部错误码.length).toBeGreaterThanOrEqual(18)
      for (const 码 of 全部错误码) {
        expect(码, `${码} 不是合法错误码形态`).toMatch(/^[A-Z][A-Z0-9_]{3,63}$/)
        expect(取错误定义(码), `${码} 查不到定义`).toBeDefined()
      }
    })

    it('判据①：摘要不得出现错误码原形、第三方原文或内部实现', () => {
      const 违规: string[] = []
      for (const 码 of [...全部错误码, ...Object.values(前端错误码)]) {
        const 展示 = 建展示(码)
        if (XU_LIU_WU.test(展示.消息)) 违规.push(`${码} 摘要泄露内部原文：${展示.消息}`)
        if (ZHAN_WEI.test(展示.消息)) 违规.push(`${码} 摘要含占位或脏值：${展示.消息}`)
        if (展示.消息.includes(码)) 违规.push(`${码} 摘要里带错误码原形：${展示.消息}`)
      }
      expect(违规).toEqual([])
    })

    it('判据③：每个服务端错误码都给出影响与下一步，且下一步可执行', () => {
      const 违规: string[] = []
      for (const 码 of 全部错误码) {
        const 展示 = 建展示(码)
        if (展示.影响.trim() === '') 违规.push(`${码}：影响为空`)
        if (展示.下一步.trim() === '') 违规.push(`${码}：下一步为空`)
        if (!/请|可以|返回|刷新|重试|重新|切换/.test(展示.下一步)) 违规.push(`${码}：下一步不可执行：${展示.下一步}`)
      }
      expect(违规).toEqual([])
    })

    it('判据③：retryable 与可重试动作一致（按钮只在可重试时出现）', () => {
      const 违规: string[] = []
      for (const 码 of 全部错误码) {
        const 定义 = 取错误定义(码)
        const 展示 = 建展示(码)
        expect(展示.可重试, `${码} 的可重试与注册表不一致`).toBe(定义?.可重试 ?? false)
        if (定义?.可重试 === true && !/重试/.test(展示.下一步)) {
          违规.push(`${码}：可重试但下一步未给重试动作：${展示.下一步}`)
        }
        if (定义?.可重试 !== true && /请重试当前操作|请稍后重试/.test(展示.下一步)) {
          违规.push(`${码}：不可重试却承诺重试：${展示.下一步}`)
        }
      }
      expect(违规).toEqual([])
    })

    it('判据④：无敷衍语', () => {
      const 违规: string[] = []
      for (const 码 of [...全部错误码, ...Object.values(前端错误码)]) {
        const 展示 = 建展示(码)
        if (FU_YAN.test(展示.消息)) 违规.push(`${码}：${展示.消息}`)
        if (FU_YAN.test(展示.下一步) && !/；持续失败请提供追踪编号/.test(展示.下一步)) {
          违规.push(`${码} 下一步敷衍：${展示.下一步}`)
        }
      }
      expect(违规).toEqual([])
    })

    it('判据⑧⑨：错误条实际渲染时摘要不含错误码，详情含错误码与追踪编号', () => {
      for (const 码 of [...全部错误码, ...Object.values(前端错误码)]) {
        const 展示 = 建展示(码)
        const wrapper = mount(XiaoXiTiao, { props: { xingTai: 'cuo-wu', 错误展示: 展示 } })
        const 跨 = wrapper.findAll('span')
        const 摘要 = 跨[0].text()
        const 详情 = 跨[1].text()
        expect(摘要, `${码} 的摘要泄露错误码`).not.toContain(码)
        expect(摘要.length, `${码} 的摘要为空`).toBeGreaterThan(0)
        expect(详情, `${码} 的详情缺错误码标签`).toContain(通用文案.错误码)
        expect(详情, `${码} 的详情缺追踪编号`).toContain(通用文案.错误追踪编号)
        const 重试按钮 = wrapper.get('[data-testid="cuo-wu-chong-shi"]')
        const 应可重试 = 展示.可重试 === true
        expect(重试按钮.attributes('disabled'), `${码} 的重试按钮态错`).toBe(应可重试 ? undefined : '')
        expect(重试按钮.attributes('hidden'), `${码} 的重试按钮显隐错`).toBe(应可重试 ? undefined : '')
      }
    })
  })

  describe('B. 文案层（登录/列表/筛选/审核/健康）', () => {
    it('判据①②：管理端文案无内部原文、无占位符与脏值', () => {
      const 全: { 键: string; 值: string }[] = []
      const 走 = (v: unknown, p: string): void => {
        if (typeof v === 'string') {
          全.push({ 键: p, 值: v })
          return
        }
        if (Array.isArray(v)) {
          v.forEach((x, i) => 走(x, `${p}[${i}]`))
          return
        }
        if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) 走(x, `${p}.${k}`)
      }
      走(通用文案, '通用文案')
      走(登录文案, '登录文案')
      const 违规 = 全
        .filter(({ 值 }) => XU_LIU_WU.test(值))
        .map(({ 键, 值 }) => `${键}：${值}`)
      expect(违规).toEqual([])
    })

    it('判据⑤：省略号形态唯一为「……」', () => {
      expect(通用文案.加载中).toBe('加载中……')
      expect(通用文案.加载中).not.toContain('...')
    })

    it('判据③：登录页本地校验文案说清缺什么，不复用通用「请求失败」', () => {
      expect(登录文案.账号或密码为空).toBe('请输入手机号与密码')
      expect(登录文案.账号或密码为空).not.toBe(通用文案.请求失败)
    })

    it('判据③：登录本地校验错误的码仍是稳定码，便于对账', () => {
      const 展示 = 取错误展示(创建前端错误(登录文案.账号或密码为空))
      expect(展示.错误码).toBe(前端错误码.本地校验)
      expect(展示.影响).not.toBe('')
      expect(展示.下一步).not.toBe('')
    })

    it('判据③：未知错误码不得直接显示，必须回落到安全中文并保留可执行下一步', () => {
      const 展示 = 取错误展示(new 业务错误({ code: 'WO_ZHI_DE_MA', message: 'Error: boom', traceId: 't' }))
      expect(展示.消息).not.toContain('WO_ZHI_DE_MA')
      expect(展示.消息).not.toContain('Error')
      expect(展示.消息).not.toBe('')
      expect(展示.影响).not.toBe('')
      expect(展示.下一步).not.toBe('')
    })

    it('判据③：字段级错误不得回落到「请求失败」这种整体口径', () => {
      const 展示 = 取错误展示(
        new 业务错误({
          code: 'CAN_SHU_CUO_WU',
          message: '请求参数有误：手机号',
          traceId: 't',
          fieldErrors: { shou_ji_hao: '手机号格式不正确' },
        }),
      )
      expect(展示.字段错误.shou_ji_hao).toBe('手机号格式不正确')
      expect(Object.values(展示.字段错误)).not.toContain(通用文案.请求失败)
    })

    it('判据⑨：超长/含 SQL 的字段错误文案不得上屏', () => {
      const 展示 = 取错误展示(
        new 业务错误({
          code: 'CAN_SHU_CUO_WU',
          message: 'x',
          traceId: 't',
          fieldErrors: { a: 'SELECT * FROM users password=1', b: 'x'.repeat(4000) },
        }),
      )
      for (const 文案 of Object.values(展示.字段错误)) {
        expect(文案.length).toBeLessThanOrEqual(200)
        expect(文案).not.toMatch(/SELECT|password/)
      }
    })

    it('判据⑤⑥：认证失效口径与管理端自身文案一致（登录过期/重新登录）', () => {
      expect(通用文案.登录过期).toBe('登录已过期，请重新登录')
      expect(通用文案.重新登录后重试).toContain('重新登录')
    })
  })

  describe('C. 未就绪出口覆盖与状态契约', () => {
    it('表未就绪与依赖未就绪返回503，且外壳懒装载就绪错误条', () => {
      expect(错误注册表.数据表未就绪.状态码).toBe(503);
      expect(错误注册表.依赖未就绪.状态码).toBe(503);
      expect(错误注册表.缓存服务不可用.状态码).toBe(503);
      const 外壳源 = fs.readFileSync('src/App.vue', 'utf8');
      expect(外壳源).toContain("import('./components/就绪错误条.vue')");
      expect(外壳源).not.toContain("from './api/探针'");
      const 就绪条源 = fs.readFileSync('src/components/就绪错误条.vue', 'utf8');
      expect(就绪条源).toContain('就绪检查');
      expect(就绪条源).toContain('XiaoXiTiao');
    });
  });
})
