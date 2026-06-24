// 必须在所有其他 import 之前加载环境变量
import * as dotenv from 'dotenv';
import { resolve } from 'path';

const envFile = resolve(process.cwd(), `.env.${process.env.NODE_ENV || 'development'}`);
dotenv.config({ path: envFile });

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 设置全局路由前缀
  app.setGlobalPrefix('api');

  // 开启 CORS（允许小程序访问）
  app.enableCors({
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: false,
  });

  // 全局 ValidationPipe（自动校验 DTO）
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = process.env.SERVER_PORT || 3010;
  await app.listen(port);
  console.log(`后端已启动: http://localhost:${port}/api`);
  console.log(`WebSocket 已就绪: ws://localhost:${port}`);
  console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
}

bootstrap();
