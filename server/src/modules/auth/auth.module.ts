import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import type { StringValue } from 'ms';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthGuard } from '../../common/guards/auth.guard';

/**
 * 解析并校验 JWT Secret。
 * - 生产环境强制要求配置 JWT_SECRET 且长度 >= 32 字节，缺失则启动失败
 * - 开发/测试环境允许使用默认 secret 以便本地运行
 */
function resolveJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  const isProduction = process.env.NODE_ENV === 'production';

  if (!secret) {
    if (isProduction) {
      throw new Error(
        '[Auth] 生产环境必须配置 JWT_SECRET 环境变量（长度 >= 32 字节），禁止使用默认值。',
      );
    }
    console.warn(
      '[Auth] JWT_SECRET 未配置，使用不安全的默认值。仅限开发环境，生产环境必须配置。',
    );
    return 'dev-only-default-secret-do-not-use-in-production';
  }

  if (isProduction && secret.length < 32) {
    throw new Error(
      '[Auth] 生产环境 JWT_SECRET 长度必须 >= 32 字节，请使用强随机字符串。',
    );
  }

  return secret;
}

@Global()
@Module({
  imports: [
    JwtModule.register({
      secret: resolveJwtSecret(),
      signOptions: {
        expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as StringValue,
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthGuard],
  exports: [AuthService, AuthGuard, JwtModule],
})
export class AuthModule {}
