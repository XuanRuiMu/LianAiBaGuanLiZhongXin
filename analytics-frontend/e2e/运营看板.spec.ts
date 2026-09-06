import { expect, test } from '@playwright/test'
import { 界面登录 } from './登录助手'

test('运营看板展示血缘与类型状态', async ({ page }) => {
  await 界面登录(page)
  await page.goto('/ops')
  await expect(page.getByText('数仓血缘').first()).toBeVisible()
  await expect(page.getByText('ODS.源业务库').first()).toBeVisible()
  await expect(page.getByText('USERS').first()).toBeVisible()
})

test('未登录访问运营看板被拦回登录页', async ({ page }) => {
  await page.goto('/ops')
  await expect(page).toHaveURL(/\/login/)
})
