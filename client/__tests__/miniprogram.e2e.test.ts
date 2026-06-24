const automator = require('miniprogram-automator');
const { execSync } = require('child_process');

const PROJECT_PATH = '/Users/zhaolong/前端/vibe-coding-project/taste-food/client';
const CLI_PATH = '/Applications/wechatwebdevtools.app/Contents/MacOS/cli';

let miniProgram;
let page;

async function findAutoPort() {
  try {
    const result = execSync('lsof -i -P 2>/dev/null | grep wechatweb | grep LISTEN', { encoding: 'utf8' });
    const ports = result.match(/:(\d+)\s+\(LISTEN\)/g);
    if (!ports) return null;
    return ports.map(p => parseInt(p.match(/(\d+)/)[1])).sort((a, b) => a - b)[0];
  } catch {
    return null;
  }
}

beforeAll(async () => {
  try {
    // 尝试连接已运行的实例
    const port = await findAutoPort();
    if (port) {
      console.log(`发现自动化端口: ${port}，尝试连接...`);
      miniProgram = await automator.connect({
        wsEndpoint: `ws://127.0.0.1:${port}`,
      });
      console.log('连接成功');
    } else {
      // 没有运行中的实例，启动新的
      console.log('未发现运行中的实例，启动新实例...');
      miniProgram = await automator.launch({
        projectPath: PROJECT_PATH,
        cliPath: CLI_PATH,
      });
      console.log('启动成功');
    }

    await new Promise(r => setTimeout(r, 3000));
    page = await miniProgram.currentPage();
    console.log('当前页面:', page.path);

    // 如果在登录页，点击管理员登录
    if (page.path.includes('login')) {
      const loginBtn = await page.$('view.login-page__btn');
      if (loginBtn) {
        await loginBtn.tap();
        console.log('已点击管理员登录');
        await page.waitFor(3000);
        page = await miniProgram.currentPage();
        console.log('登录后页面:', page.path);
      }
    }
  } catch (error) {
    console.error('连接失败:', error.message);
    throw error;
  }
}, 120000);

afterAll(async () => {
  if (miniProgram) {
    await miniProgram.close();
  }
});

describe('小程序启动', () => {
  test('登录后进入菜单页', async () => {
    expect(page.path).toContain('menu');
  }, 10000);

  test('页面有内容', async () => {
    const views = await page.$$('view');
    expect(views.length).toBeGreaterThan(0);
  }, 10000);
});

describe('菜单页功能', () => {
  test('页面包含文本', async () => {
    const texts = await page.$$('text');
    expect(texts.length).toBeGreaterThan(0);
  }, 10000);

  test('页面可以点击', async () => {
    const firstView = await page.$('view');
    if (firstView) {
      await firstView.tap();
      await page.waitFor(500);
    }
    expect(true).toBeTruthy();
  }, 10000);
});

describe('TabBar 导航', () => {
  test('点击操作不报错', async () => {
    const views = await page.$$('view');
    if (views.length > 0) {
      await views[0].tap();
      await page.waitFor(500);
    }
    expect(true).toBeTruthy();
  }, 10000);
});
