import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3012';

test('管理端完整流程', async ({ page }) => {
  // 1. 登录：直接调登录接口拿 token，注入 localStorage 后进入 dashboard
  //    （绕过 antd 表单整页导航竞态，登录流程本身不在本用例验证范围）
  const loginApi = page.request.post(`${BASE_URL}/api/auth/login`, {
    data: { username: 'admin', password: 'admin123' },
  });
  const loginResp = await loginApi;
  const loginJson = (await loginResp.json()) as { data: { token: string; refreshToken?: string; [k: string]: unknown } };
  const { token, refreshToken, ...user } = loginJson.data;
  await page.goto(`${BASE_URL}/login`);
  await page.evaluate(
    (data: { token: string; refreshToken?: string; user: Record<string, unknown> }) => {
      localStorage.setItem('token', data.token);
      if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);
      localStorage.setItem('user', JSON.stringify(data.user));
    },
    { token, refreshToken, user },
  );
  // 平台管理员进入 /platform/dashboard
  await page.goto(`${BASE_URL}/platform/dashboard`);
  await page.waitForURL('**/platform/dashboard', { timeout: 20000 });
  await expect(page.locator('h4:has-text("数据看板")').first()).toBeVisible();

  // 2. 数据看板
  await expect(page.locator('text=订单').first()).toBeVisible();
  await expect(page.locator('text=营收').first()).toBeVisible();
  await expect(page.locator('text=待处理')).toBeVisible();

  // 3. 操作审计（平台端菜单）
  await page.click('.ant-menu-item:has-text("操作审计")');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('text=操作审计').first()).toBeVisible();

  // 4. 用户管理（平台端）
  await page.click('.ant-menu-item:has-text("用户管理")');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('thead th:has-text("用户")')).toBeVisible();

  // 5. 返回数据看板
  await page.click('.ant-menu-item:has-text("数据看板")');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('h4:has-text("数据看板")').first()).toBeVisible();
});
