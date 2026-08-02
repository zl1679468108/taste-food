/**
 * T267 批量异步导出 — 端到端运行时验证（Excel-only）。
 *
 * 启动真实 AppModule（含 ExportModule + 全局 Auth/Roles 守卫），
 * 通过真实 HTTP 接口走通：
 *   1) dev/seed-merchant + login 获取 Bearer 令牌
 *   2) POST /api/merchant/export-jobs 提交后台异步导出任务（立即返回）
 *   3) 轮询 GET /api/merchant/export-jobs/:id 直到 completed
 *   4) GET /api/merchant/export-jobs/:id/download 下载产物，校验为合法 .xlsx
 *
 * 运行模式：内存回退（无 Supabase）。仅验证代码逻辑与管线，
 * 真实 Supabase 部署需先执行 docs/migrations/v28-export-jobs.sql。
 */
// 强制内存回退模式，避免依赖外部 Supabase / 网络（必须在加载 AppModule 前设置）。
process.env.NODE_ENV = 'test';
process.env.ALLOW_MEMORY_FALLBACK = 'true';
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_ANON_KEY;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

import test from 'node:test';
import assert from 'node:assert/strict';
import { NestFactory } from '@nestjs/core';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';

async function bootstrap(): Promise<{ app: INestApplication; base: string }> {
  const app = await NestFactory.create(AppModule);
  // 生产环境在 main.ts 中设置全局前缀 /api，这里镜像之
  app.setGlobalPrefix('api');
  await app.listen(0);
  const httpServer = app.getHttpServer();
  const address = httpServer.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  return { app, base: `http://127.0.0.1:${port}/api` };
}

test('T267 批量异步导出端到端（Excel-only）', async () => {
  const { app, base } = await bootstrap();
  const auth = (token: string) => ({ authorization: `Bearer ${token}` });
  try {
    // 1. 准备演示商家（公开接口）
    const seedRes = await fetch(`${base}/auth/dev/seed-merchant`, { method: 'POST' });
    assert.ok(seedRes.ok, `seed-merchant 应成功，状态码 ${seedRes.status}`);

    // 2. 登录拿令牌
    const loginRes = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'merchant', password: 'merchant123' }),
    });
    const loginJson = (await loginRes.json()) as any;
    const token = loginJson?.data?.token as string | undefined;
    assert.ok(token, '登录应返回 token');

    // 3. 提交导出任务（应立刻返回，不阻塞）
    const createRes = await fetch(`${base}/merchant/export-jobs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...auth(token) },
      body: JSON.stringify({ entity: 'orders' }),
    });
    assert.ok(createRes.ok, `提交导出应成功，状态码 ${createRes.status}`);
    const createJson = (await createRes.json()) as any;
    const job = createJson?.data;
    assert.ok(job?.id, '应返回导出任务 id');
    assert.equal(job.status, 'pending', '初始状态应为 pending');
    assert.equal(job.format, 'xlsx', '格式必须为 xlsx（Excel-only，不走 CSV）');

    const jobId = job.id;

    // 4. 轮询直到完成 / 失败（fire-and-forget 后台执行）
    let finalStatus = '';
    for (let i = 0; i < 40; i++) {
      const detailRes = await fetch(`${base}/merchant/export-jobs/${jobId}`, { headers: auth(token) });
      const detailJson = (await detailRes.json()) as any;
      const cur = detailJson?.data?.status;
      if (cur === 'completed' || cur === 'failed') {
        finalStatus = cur;
        Object.assign(job, detailJson.data);
        break;
      }
      await new Promise((r) => setTimeout(r, 250));
    }
    assert.equal(finalStatus, 'completed', `导出任务应完成，实际为 "${finalStatus}"（${job.errorMessage || ''}）`);
    assert.ok(job.filePath, '完成后应写入 filePath');
    assert.equal(job.rowCount, 0, '内存模式无种子订单，rowCount 应为 0');

    // 5. 下载产物，校验为合法 xlsx（ZIP 头 PK\x03\x04）
    const dlRes = await fetch(`${base}/merchant/export-jobs/${jobId}/download`, { headers: auth(token) });
    assert.equal(dlRes.status, 200, '下载应返回 200');
    const buf = Buffer.from(await dlRes.arrayBuffer());
    assert.ok(buf.length > 0, '下载内容不应为空');
    assert.equal(buf[0], 0x50, 'xlsx 应以 PK 头开头 (P)');
    assert.equal(buf[1], 0x4b, 'xlsx 应以 PK 头开头 (K)');
    assert.equal(buf[2], 0x03, 'xlsx Zip 头第 3 字节 0x03');
    assert.equal(buf[3], 0x04, 'xlsx Zip 头第 4 字节 0x04');

    // 6. 未完成任务下载应被拒绝（409）
    const pendingRes = await fetch(`${base}/merchant/export-jobs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...auth(token) },
      body: JSON.stringify({ entity: 'orders' }),
    });
    const pendingJson = (await pendingRes.json()) as any;
    const pendingId = pendingJson?.data?.id;
    assert.ok(pendingId, '应能再提交一个任务');
    const earlyDl = await fetch(`${base}/merchant/export-jobs/${pendingId}/download`, { headers: auth(token) });
    assert.equal(earlyDl.status, 409, '未完成任务下载应返回 409 Conflict');
  } finally {
    await app.close();
  }
});
