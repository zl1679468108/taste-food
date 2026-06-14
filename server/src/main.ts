import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 设置全局路由前缀
  app.setGlobalPrefix('api');

  // 开启 CORS（允许小程序访问）
  app.enableCors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  // 全局 ValidationPipe（自动校验 DTO）
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // 剔除不在 DTO 中的字段
      forbidNonWhitelisted: true, // 对非白名单字段抛出错误
      transform: true, // 自动转换类型
    }),
  );

  const port = process.env.SERVER_PORT || 3001;
  await app.listen(port);
  console.log(`🚀 小买卖点餐系统后端已启动: http://localhost:${port}/api`);
  console.log(`📡 WebSocket 服务已就绪: ws://localhost:${port}`);
}

bootstrap();
