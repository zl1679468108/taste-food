import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { CurrentUserPayload } from '../decorators/current-user.decorator';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException('缺少认证令牌');
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      throw new UnauthorizedException('认证令牌格式错误');
    }

    const token = parts[1];

    try {
      const payload: CurrentUserPayload = this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET || 'default-secret',
      });
      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('认证令牌无效或已过期');
    }
  }
}
