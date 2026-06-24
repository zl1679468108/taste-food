# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: admin.spec.ts >> 管理端完整流程
- Location: tests/admin.spec.ts:5:5

# Error details

```
TimeoutError: page.click: Timeout 10000ms exceeded.
Call log:
  - waiting for locator('.ant-menu-item:has-text("店铺管理")')

```

# Page snapshot

```yaml
- generic [ref=e4]:
  - complementary [ref=e6]:
    - generic [ref=e7]:
      - menu [ref=e9]:
        - menuitem "dashboard 数据看板" [ref=e10] [cursor=pointer]:
          - generic [ref=e12]:
            - img "dashboard" [ref=e14]:
              - img [ref=e15]
            - generic [ref=e17]: 数据看板
        - menuitem "shop 店铺管理" [ref=e18] [cursor=pointer]:
          - generic [ref=e20]:
            - img "shop" [ref=e22]:
              - img [ref=e23]
            - generic [ref=e25]: 店铺管理
        - menuitem "coffee 菜品管理" [ref=e26] [cursor=pointer]:
          - generic [ref=e28]:
            - img "coffee" [ref=e30]:
              - img [ref=e31]
            - generic [ref=e33]: 菜品管理
        - menuitem "ordered-list 订单管理" [ref=e34] [cursor=pointer]:
          - link "ordered-list 订单管理" [ref=e36]:
            - /url: /order
            - generic [ref=e37]:
              - img "ordered-list" [ref=e39]:
                - img [ref=e40]
              - generic [ref=e42]: 订单管理
        - menuitem "team 用户管理" [ref=e43] [cursor=pointer]:
          - link "team 用户管理" [ref=e45]:
            - /url: /user
            - generic [ref=e46]:
              - img "team" [ref=e48]:
                - img [ref=e49]
              - generic [ref=e51]: 用户管理
        - menuitem "gift 促销管理" [ref=e52] [cursor=pointer]:
          - link "gift 促销管理" [ref=e54]:
            - /url: /promotion
            - generic [ref=e55]:
              - img "gift" [ref=e57]:
                - img [ref=e58]
              - generic [ref=e60]: 促销管理
      - img [ref=e62] [cursor=pointer]
  - generic [ref=e64]:
    - banner [ref=e65]
    - banner [ref=e66]:
      - generic [ref=e67]:
        - generic [ref=e69] [cursor=pointer]:
          - generic [ref=e70]: 🍜
          - heading "小买卖管理后台" [level=1] [ref=e71]
        - generic [ref=e79] [cursor=pointer]: 管理员
    - main [ref=e80]:
      - generic [ref=e81]:
        - heading "rise 数据看板" [level=4] [ref=e83]:
          - img "rise" [ref=e84]:
            - img [ref=e85]
          - text: 数据看板
        - generic [ref=e87]:
          - generic [ref=e91]:
            - generic [ref=e92]: 今日订单
            - generic [ref=e93]:
              - img "shopping-cart" [ref=e96]:
                - img [ref=e97]
              - generic [ref=e99]: "0"
          - generic [ref=e103]:
            - generic [ref=e104]: 今日营收
            - generic [ref=e105]:
              - img "money-collect" [ref=e108]:
                - img [ref=e109]
              - generic [ref=e111]: "0.00"
              - generic [ref=e112]: 元
          - generic [ref=e116]:
            - generic [ref=e117]: 待处理
            - generic [ref=e118]:
              - img "clock-circle" [ref=e121]:
                - img [ref=e122]
              - generic [ref=e125]: "0"
          - generic [ref=e129]:
            - generic [ref=e130]: 已完成
            - generic [ref=e131]:
              - img "check-circle" [ref=e134]:
                - img [ref=e135]
              - generic [ref=e138]: "0"
        - generic [ref=e139]:
          - generic [ref=e145]:
            - img "line-chart" [ref=e147]:
              - img [ref=e148]
            - generic [ref=e150]: 近7天订单趋势
          - generic [ref=e160]:
            - img "pie-chart" [ref=e162]:
              - img [ref=e163]
            - generic [ref=e165]: 订单状态分布
        - generic [ref=e170]:
          - generic [ref=e176]:
            - img "bar-chart" [ref=e178]:
              - img [ref=e179]
            - generic [ref=e181]: 每日订单量
          - generic [ref=e191]:
            - img "rise" [ref=e193]:
              - img [ref=e194]
            - generic [ref=e196]: 近7天营收趋势
        - generic [ref=e201]:
          - generic [ref=e205]:
            - img "alert" [ref=e207]:
              - img [ref=e208]
            - generic [ref=e210]: 最近订单
          - table [ref=e218]:
            - rowgroup [ref=e219]:
              - row "订单号 状态 配送方式 金额 时间" [ref=e220]:
                - columnheader "订单号" [ref=e221]
                - columnheader "状态" [ref=e222]
                - columnheader "配送方式" [ref=e223]
                - columnheader "金额" [ref=e224]
                - columnheader "时间" [ref=e225]
            - rowgroup [ref=e226]:
              - row "暂无数据 暂无数据" [ref=e227]:
                - cell "暂无数据 暂无数据" [ref=e228]:
                  - generic [ref=e229]:
                    - img "暂无数据" [ref=e231]
                    - generic [ref=e237]: 暂无数据
    - generic [ref=e238]: 小买卖点餐系统 ©2026
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | const BASE_URL = 'http://localhost:3012';
  4   | 
  5   | test('管理端完整流程', async ({ page }) => {
  6   |   // 1. 登录
  7   |   await page.goto(`${BASE_URL}/login`);
  8   |   await page.waitForLoadState('networkidle');
  9   |   await page.click('button:has-text("管理员登录")');
  10  |   await page.waitForURL('**/dashboard', { timeout: 15000 });
  11  |   await expect(page.locator('h4:has-text("数据看板")')).toBeVisible();
  12  | 
  13  |   // 2. 数据看板
  14  |   await expect(page.locator('text=今日订单')).toBeVisible();
  15  |   await expect(page.locator('text=今日营收')).toBeVisible();
  16  |   await expect(page.locator('text=最近订单')).toBeVisible();
  17  | 
  18  |   // 3. 店铺管理 - 店铺信息
> 19  |   await page.click('.ant-menu-item:has-text("店铺管理")');
      |              ^ TimeoutError: page.click: Timeout 10000ms exceeded.
  20  |   await page.click('a:has-text("店铺信息")');
  21  |   await page.waitForLoadState('networkidle');
  22  |   await expect(page.locator('text=店铺名称').first()).toBeVisible();
  23  | 
  24  |   // 4. 店铺管理 - 多店铺列表
  25  |   await page.click('.ant-menu-item:has-text("店铺管理")');
  26  |   await page.click('a:has-text("多店铺管理")');
  27  |   await page.waitForLoadState('networkidle');
  28  |   await expect(page.locator('button:has-text("新增店铺")')).toBeVisible();
  29  | 
  30  |   // 5. 新增店铺弹窗
  31  |   await page.click('button:has-text("新增店铺")');
  32  |   await expect(page.locator('.ant-modal')).toBeVisible();
  33  |   await expect(page.locator('.ant-form-item:has-text("店铺名称")')).toBeVisible();
  34  |   await expect(page.locator('.ant-form-item:has-text("配送范围")')).toBeVisible();
  35  |   await page.click('.ant-modal .ant-btn:not(.ant-btn-primary)');
  36  |   await page.waitForTimeout(500);
  37  | 
  38  |   // 6. 菜品管理 - 分类管理
  39  |   await page.click('.ant-menu-item:has-text("菜品管理")');
  40  |   await page.click('a:has-text("分类管理")');
  41  |   await page.waitForLoadState('networkidle');
  42  |   await expect(page.locator('button:has-text("新增分类")')).toBeVisible();
  43  | 
  44  |   // 7. 新增分类弹窗
  45  |   await page.click('button:has-text("新增分类")');
  46  |   await expect(page.locator('.ant-modal')).toBeVisible();
  47  |   await expect(page.locator('.ant-form-item:has-text("分类名称")')).toBeVisible();
  48  |   await page.click('.ant-modal .ant-btn:not(.ant-btn-primary)');
  49  |   await page.waitForTimeout(500);
  50  | 
  51  |   // 8. 菜品管理 - 菜品列表
  52  |   await page.click('.ant-menu-item:has-text("菜品管理")');
  53  |   await page.click('a:has-text("菜品列表")');
  54  |   await page.waitForLoadState('networkidle');
  55  |   await expect(page.locator('button:has-text("新增菜品")')).toBeVisible();
  56  |   await expect(page.locator('th:has-text("菜品名称")')).toBeVisible();
  57  | 
  58  |   // 9. 新增菜品弹窗
  59  |   await page.click('button:has-text("新增菜品")');
  60  |   await expect(page.locator('.ant-modal')).toBeVisible();
  61  |   await expect(page.locator('.ant-form-item:has-text("菜品名称")')).toBeVisible();
  62  |   await expect(page.locator('.ant-form-item:has-text("所属分类")')).toBeVisible();
  63  |   await page.click('.ant-modal .ant-btn:not(.ant-btn-primary)');
  64  |   await page.waitForTimeout(500);
  65  | 
  66  |   // 10. 订单管理
  67  |   await page.click('a:has-text("订单管理")');
  68  |   await page.waitForLoadState('networkidle');
  69  |   await expect(page.locator('th:has-text("订单号")')).toBeVisible();
  70  | 
  71  |   // 11. 订单状态筛选
  72  |   await page.click('.ant-tabs-tab-btn:has-text("已支付")');
  73  |   await page.waitForTimeout(500);
  74  |   await page.click('.ant-tabs-tab-btn:has-text("已完成")');
  75  |   await page.waitForTimeout(500);
  76  |   await page.click('.ant-tabs-tab-btn:has-text("全部")');
  77  |   await page.waitForTimeout(500);
  78  | 
  79  |   // 12. 用户管理
  80  |   await page.click('a:has-text("用户管理")');
  81  |   await page.waitForLoadState('networkidle');
  82  |   await expect(page.locator('th:has-text("昵称")')).toBeVisible();
  83  | 
  84  |   // 13. 促销管理
  85  |   await page.click('a:has-text("促销管理")');
  86  |   await page.waitForLoadState('networkidle');
  87  |   await expect(page.locator('button:has-text("新增促销")')).toBeVisible();
  88  | 
  89  |   // 14. 新增促销弹窗
  90  |   await page.click('button:has-text("新增促销")');
  91  |   await expect(page.locator('.ant-modal')).toBeVisible();
  92  |   await expect(page.locator('.ant-form-item:has-text("活动名称")')).toBeVisible();
  93  |   await expect(page.locator('.ant-form-item:has-text("活动类型")')).toBeVisible();
  94  |   await page.click('.ant-modal .ant-btn:not(.ant-btn-primary)');
  95  |   await page.waitForTimeout(500);
  96  | 
  97  |   // 15. 返回数据看板
  98  |   await page.click('a[href="/dashboard"]');
  99  |   await page.waitForLoadState('networkidle');
  100 |   await expect(page.locator('h4:has-text("数据看板")')).toBeVisible();
  101 | });
  102 | 
```