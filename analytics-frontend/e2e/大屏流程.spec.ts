import { expect, test } from '@playwright/test'
import { 界面登录 } from './登录助手'

test('大屏展示五项指标与图表', async ({ page }) => {
  await 界面登录(page)
  for (const 标题 of ['总用户', '总角色', '总消息']) {
    await expect(page.getByText(标题).first()).toBeVisible()
  }
  await expect(page.locator('canvas').first()).toBeVisible()
})

test('未登录访问大屏被拦回登录页', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login/)
})
