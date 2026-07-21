import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from '../../modules/auth/auth.service';
import { CurrentUserPayload } from '../decorators/current-user.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 公开接口直接放行（@Public() 装饰）
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException('缺少认证令牌');
    }

    // 容忍多空格的 Bearer 解析
    const match = /^Bearer\s+(.+)$/i.exec(authHeader);
    if (!match) {
      throw new UnauthorizedException('认证令牌格式错误');
    }
    const token = match[1].trim();

    try {
      const payload: CurrentUserPayload = await this.authService.validateToken(token);
      request.user = payload;
      return true;
    } catch (e) {
      // 仅对 JwtService 相关异常抛 401，其他异常向上抛由全局 filter 处理
      if (e instanceof UnauthorizedException) throw e;
      const errName = (e as { name?: string })?.name;
      const isJwtError =
        errName === 'TokenExpiredError' ||
        errName === 'JsonWebTokenError' ||
        errName === 'NotBeforeError';
      if (isJwtError) {
        throw new UnauthorizedException('认证令牌无效或已过期');
      }
      throw e;
    }
  }
}
