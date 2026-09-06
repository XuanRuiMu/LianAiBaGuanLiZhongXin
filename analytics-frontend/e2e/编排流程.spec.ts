import { expect, test } from '@playwright/test'
import { 界面登录 } from './登录助手'

test('画布从零搭出5节点并真实跑通', async ({ page }) => {
  await 界面登录(page)
  await page.goto('/orchestrate')
  for (const 类型 of ['开始', '代码', '代码', '条件分支', '结束']) {
    await page.getByRole('button', { name: `＋ ${类型}` }).click()
  }
  await expect(page.locator('.react-flow__node')).toHaveCount(5)
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(page.getByText('已保存')).toBeVisible()
  await page.getByRole('button', { name: '运行', exact: true }).click()
  await expect(page.getByText(/执行成功/)).toBeVisible({ timeout: 60_000 })
})

test('未登录访问编排页被拦回登录页', async ({ page }) => {
  await page.goto('/orchestrate')
  await expect(page).toHaveURL(/\/login/)
})
