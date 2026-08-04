import { chromium } from 'playwright';

const BASE = 'http://localhost:3012';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const loginResp = await page.request.post(`${BASE}/api/auth/login`, {
  data: { username: 'admin', password: 'admin123' },
});
const { data } = await loginResp.json();
await page.goto(`${BASE}/login`);
await page.evaluate(
  (d) => {
    localStorage.setItem('token', d.token);
    if (d.refreshToken) localStorage.setItem('refreshToken', d.refreshToken);
    const { token: _t, refreshToken: _r, ...u } = d;
    localStorage.setItem('user', JSON.stringify(u));
  },
  data,
);

await page.goto(`${BASE}/platform/dashboard`);
try {
  await page.waitForSelector('text=待处理', { timeout: 30000 });
  console.log('[ok] 待处理 出现');
} catch (e) {
  console.log('[timeout] 未出现待处理');
}
await sleep(3000);

const text = await page.evaluate(() => document.body.innerText);
console.log('contains 数据看板:', text.includes('数据看板'));
console.log('contains 待处理:', text.includes('待处理'));
console.log('contains 待接单:', text.includes('待接单'));
console.log('contains 待备餐:', text.includes('待备餐'));
console.log('contains "11":', text.includes('11'));
console.log('contains "1" (待接单):', text.includes('1'));
console.log('contains "10" (待备餐):', text.includes('10'));
console.log('URL:', page.url());
await page.screenshot({ path: '/Users/zhaolong/前端/vibe-coding-project/taste-food/test-results/dashboard-platform.png', fullPage: true });
await browser.close();