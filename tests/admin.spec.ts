import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3012';

test('管理端完整流程', async ({ page }) => {
  // 1. 登录
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState('networkidle');
  await page.click('button:has-text("管理员登录")');
  await page.waitForURL('**/dashboard', { timeout: 15000 });
  await expect(page.locator('h4:has-text("数据看板")')).toBeVisible();

  // 2. 数据看板
  await expect(page.locator('text=今日订单')).toBeVisible();
  await expect(page.locator('text=今日营收')).toBeVisible();
  await expect(page.locator('text=最近订单')).toBeVisible();

  // 3. 店铺管理 - 店铺信息
  await page.click('.ant-menu-item:has-text("店铺管理")');
  await page.click('a:has-text("店铺信息")');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('text=店铺名称').first()).toBeVisible();

  // 4. 店铺管理 - 多店铺列表
  await page.click('.ant-menu-item:has-text("店铺管理")');
  await page.click('a:has-text("多店铺管理")');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('button:has-text("新增店铺")')).toBeVisible();

  // 5. 新增店铺弹窗
  await page.click('button:has-text("新增店铺")');
  await expect(page.locator('.ant-modal')).toBeVisible();
  await expect(page.locator('.ant-form-item:has-text("店铺名称")')).toBeVisible();
  await expect(page.locator('.ant-form-item:has-text("配送范围")')).toBeVisible();
  await page.click('.ant-modal .ant-btn:not(.ant-btn-primary)');
  await page.waitForTimeout(500);

  // 6. 菜品管理 - 分类管理
  await page.click('.ant-menu-item:has-text("菜品管理")');
  await page.click('a:has-text("分类管理")');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('button:has-text("新增分类")')).toBeVisible();

  // 7. 新增分类弹窗
  await page.click('button:has-text("新增分类")');
  await expect(page.locator('.ant-modal')).toBeVisible();
  await expect(page.locator('.ant-form-item:has-text("分类名称")')).toBeVisible();
  await page.click('.ant-modal .ant-btn:not(.ant-btn-primary)');
  await page.waitForTimeout(500);

  // 8. 菜品管理 - 菜品列表
  await page.click('.ant-menu-item:has-text("菜品管理")');
  await page.click('a:has-text("菜品列表")');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('button:has-text("新增菜品")')).toBeVisible();
  await expect(page.locator('th:has-text("菜品名称")')).toBeVisible();

  // 9. 新增菜品弹窗
  await page.click('button:has-text("新增菜品")');
  await expect(page.locator('.ant-modal')).toBeVisible();
  await expect(page.locator('.ant-form-item:has-text("菜品名称")')).toBeVisible();
  await expect(page.locator('.ant-form-item:has-text("所属分类")')).toBeVisible();
  await page.click('.ant-modal .ant-btn:not(.ant-btn-primary)');
  await page.waitForTimeout(500);

  // 10. 订单管理
  await page.click('a:has-text("订单管理")');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('th:has-text("订单号")')).toBeVisible();

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
  await expect(page.locator('th:has-text("昵称")')).toBeVisible();

  // 13. 促销管理
  await page.click('a:has-text("促销管理")');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('button:has-text("新增促销")')).toBeVisible();

  // 14. 新增促销弹窗
  await page.click('button:has-text("新增促销")');
  await expect(page.locator('.ant-modal')).toBeVisible();
  await expect(page.locator('.ant-form-item:has-text("活动名称")')).toBeVisible();
  await expect(page.locator('.ant-form-item:has-text("活动类型")')).toBeVisible();
  await page.click('.ant-modal .ant-btn:not(.ant-btn-primary)');
  await page.waitForTimeout(500);

  // 15. 返回数据看板
  await page.click('a[href="/dashboard"]');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('h4:has-text("数据看板")')).toBeVisible();
});
