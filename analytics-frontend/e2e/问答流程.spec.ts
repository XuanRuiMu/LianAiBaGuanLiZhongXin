import { expect, test } from '@playwright/test'
import { 界面登录 } from './登录助手'

test('问答发送后出现助手气泡或错误反馈', async ({ page }) => {
  await 界面登录(page)
  await page.goto('/assistant')
  await page.getByPlaceholder('向 AI 助手提问，回车发送…').fill('平台最近用户趋势如何')
  await page.getByRole('button', { name: '发送' }).click()
  const 气泡 = page.locator('text=平台最近用户趋势如何')
  await expect(气泡.first()).toBeVisible()
  await expect(page.locator('.animate-pulse, [class*="rose"]').first()).toBeVisible({ timeout: 60_000 })
})

test('未登录访问助手页被拦回登录页', async ({ page }) => {
  await page.goto('/assistant')
  await expect(page).toHaveURL(/\/login/)
})
