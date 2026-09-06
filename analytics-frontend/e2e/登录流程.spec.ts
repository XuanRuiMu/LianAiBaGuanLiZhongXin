import { expect, test } from '@playwright/test'
import { 界面登录 } from './登录助手'

test('登录成功后跳转大屏', async ({ page }) => {
  await 界面登录(page)
  await expect(page.getByText('总用户')).toBeVisible()
})

test('错误密码停留登录页并提示', async ({ page }) => {
  await page.goto('/login')
  await page.getByPlaceholder('请输入用户名').fill('admin')
  await page.getByPlaceholder('请输入密码').fill('错误密码')
  await page.getByRole('button', { name: '登 录' }).click()
  await expect(page).toHaveURL(/\/login/)
})
