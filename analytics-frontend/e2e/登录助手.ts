import { expect, type Page } from '@playwright/test'

export async function 界面登录(页面: Page) {
  await 页面.goto('/login')
  await 页面.getByPlaceholder('请输入用户名').fill('admin')
  await 页面.getByPlaceholder('请输入密码').fill('admin123')
  await 页面.getByRole('button', { name: '登 录' }).click()
  await expect(页面).toHaveURL(/\/dashboard/)
}
