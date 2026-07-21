// 必须在所有其他 import 之前加载环境变量
import * as dotenv from 'dotenv';
import { resolve } from 'path';

const envFile = resolve(process.cwd(), `.env.${process.env.NODE_ENV || 'development'}`);
dotenv.config({ path: envFile });

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { getSupabaseClientAsync } from './database/supabase.client';

async function bootstrap() {
  // 启动时等待 Supabase 健康检查完成，避免请求误走内存回退
  await getSupabaseClientAsync();

  const app = await NestFactory.create(AppModule);

  // 设置全局路由前缀
  app.setGlobalPrefix('api');

  // CORS 配置：生产环境收紧为白名单（CORS_ORIGINS 逗号分隔），开发环境允许所有来源
  // 微信小程序请求不受 CORS 限制，此配置主要保护 admin 后台浏览器访问
  const isProd = process.env.NODE_ENV === 'production';
  const corsOriginsEnv = process.env.CORS_ORIGINS;
  if (isProd && !corsOriginsEnv) {
    console.warn('[安全警告] 生产环境未配置 CORS_ORIGINS，将拒绝所有跨域浏览器请求。请配置白名单域名。');
  }
  app.enableCors({
    origin: isProd && corsOriginsEnv
      ? corsOriginsEnv.split(',').map((s) => s.trim())
      : !isProd, // 开发环境允许所有来源，生产环境未配置则拒绝
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: false,
  });

  // 全局 ValidationPipe / AuthGuard / RolesGuard / HttpExceptionFilter 已在 AppModule 中通过 APP_* provider 注册

  const port = process.env.SERVER_PORT || 3010;
  await app.listen(port);
  console.log(`后端已启动: http://localhost:${port}/api`);
  console.log(`WebSocket 已就绪: ws://localhost:${port}`);
  console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
}

bootstrap();
