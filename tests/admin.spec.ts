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
  await page.goto(`${BASE_URL}/dashboard`);
  await page.waitForURL('**/dashboard', { timeout: 20000 });
  await expect(page.locator('h4:has-text("数据看板")')).toBeVisible();

  // 2. 数据看板
  await expect(page.locator('text=订单').first()).toBeVisible();
  await expect(page.locator('text=营收').first()).toBeVisible();
  await expect(page.locator('text=待处理')).toBeVisible();

  // 3. 店铺管理（单页面，无子菜单）
  await page.click('.ant-menu-item:has-text("店铺管理")');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('text=店铺管理').first()).toBeVisible();
  await expect(page.locator('button:has-text("新增店铺")')).toBeVisible();

  // 4. 新增店铺弹窗
  await page.click('button:has-text("新增店铺")');
  await expect(page.locator('.ant-modal')).toBeVisible();
  await expect(page.locator('.ant-form-item:has-text("店铺名称")')).toBeVisible();
  await expect(page.locator('.ant-form-item:has-text("配送范围")')).toBeVisible();
  await page.click('.ant-modal-close');
  await page.waitForTimeout(500);

  // 5. 菜品管理 - 分类管理（菜品管理是 submenu）
  await page.click('.ant-menu-submenu-title:has-text("菜品管理")');
  await page.click('a:has-text("分类管理")');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('button:has-text("新增分类")')).toBeVisible();

  // 6. 新增分类弹窗
  await page.click('button:has-text("新增分类")');
  await expect(page.locator('.ant-modal')).toBeVisible();
  await expect(page.locator('.ant-form-item:has-text("分类名称")')).toBeVisible();
  await page.click('.ant-modal-close');
  await page.waitForTimeout(500);

  // 7. 菜品管理 - 菜品列表
  await page.click('.ant-menu-submenu-title:has-text("菜品管理")');
  await page.click('a:has-text("菜品列表")');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('button:has-text("新增菜品")')).toBeVisible();
  await expect(page.locator('thead th:has-text("菜品名称")')).toBeVisible();

  // 8.1 菜品搜索走后端（验证 search 透传链路）
  const rowSel = '.ant-table-tbody tr.ant-table-row';
  await page.waitForSelector(rowSel);
  const beforeCount = await page.locator(rowSel).count();
  await page.fill('input[placeholder="搜索菜品名称"]', '烤');
  // Input.Search 需回车或点「搜索」按钮才触发 onSearch
  await page.keyboard.press('Enter');
  await page.waitForResponse(
    (resp) => resp.url().includes('/api/menu-items'),
    { timeout: 10000 },
  );
  const afterCount = await page.locator(rowSel).count();
  expect(afterCount).toBeLessThan(beforeCount);

  // 9. 新增菜品弹窗
  await page.click('button:has-text("新增菜品")');
  await expect(page.locator('.ant-modal')).toBeVisible();
  await expect(page.locator('.ant-form-item:has-text("菜品名称")')).toBeVisible();
  await expect(page.locator('.ant-form-item:has-text("所属分类")')).toBeVisible();
  await page.click('.ant-modal-close');
  await page.waitForTimeout(500);

  // 10. 订单管理
  await page.click('a:has-text("订单管理")');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('thead th:has-text("订单号")')).toBeVisible();

  // 11. 订单状态筛选
  await page.click('.ant-tabs-tab-btn:has-text("已支付")');
  await page.waitForTimeout(500);
  await page.click('.ant-tabs-tab-btn:has-text("已完成")');
  await page.waitForTimeout(500);
  await page.click('.ant-tabs-tab-btn:has-text("全部")');
  await page.waitForTimeout(500);

  // 12. 用户管理
  await page.click('a:has-text("用户管理")');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('thead th:has-text("用户")')).toBeVisible();

  // 13. 促销管理
  await page.click('a:has-text("促销管理")');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('button:has-text("新增促销")')).toBeVisible();

  // 14. 新增促销弹窗
  await page.click('button:has-text("新增促销")');
  await expect(page.locator('.ant-modal')).toBeVisible();
  await expect(page.locator('.ant-form-item:has-text("活动名称")')).toBeVisible();
  await expect(page.locator('.ant-form-item:has-text("活动类型")')).toBeVisible();
  await page.click('.ant-modal-close');
  await page.waitForTimeout(500);

  // 15. 返回数据看板
  await page.click('a[href="/dashboard"]');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('h4:has-text("数据看板")')).toBeVisible();
});
