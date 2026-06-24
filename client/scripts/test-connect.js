const automator = require('miniprogram-automator');
const { execSync } = require('child_process');

const PROJECT_PATH = '/Users/zhaolong/前端/vibe-coding-project/taste-food/client';

async function findAutoPort() {
  const result = execSync('lsof -i -P 2>/dev/null | grep wechatweb | grep LISTEN', { encoding: 'utf8' });
  const ports = result.match(/:(\d+)\s+\(LISTEN\)/g);
  if (!ports) throw new Error('未找到微信开发者工具端口');
  // 返回最小的端口号（通常是自动化端口）
  return ports.map(p => parseInt(p.match(/(\d+)/)[1])).sort((a, b) => a - b)[0];
}

async function connectAndRunTests() {
  let miniProgram;
  let page;

  try {
    // 自动发现端口
    const port = await findAutoPort();
    console.log(`自动发现端口: ${port}`);

    miniProgram = await automator.connect({
      wsEndpoint: `ws://127.0.0.1:${port}`,
    });
    page = await miniProgram.currentPage();
    console.log('连接成功，当前页面:', page.path);

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

    // 导入并运行测试
    const tests = require('./miniprogram.e2e.test');
    console.log('测试完成');
  } catch (error) {
    console.error('连接失败:', error.message);
    console.error('请确保:');
    console.error('1. 微信开发者工具已打开项目');
    console.error('2. 已运行: bash scripts/start-devtools.sh');
    process.exit(1);
  } finally {
    if (miniProgram) {
      await miniProgram.close();
    }
  }
}

connectAndRunTests();
