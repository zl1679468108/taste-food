import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { UserRole } from '../constants/enums';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // 没有设置角色要求，允许访问（认证已由全局 AuthGuard 完成）
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('请先登录');
    }

    // 大小写归一化比较，避免字符串大小写差异导致误拒
    const userRole = String(user.role).toLowerCase();
    const hasRole = requiredRoles.some((r) => String(r).toLowerCase() === userRole);
    if (!hasRole) {
      throw new ForbiddenException('没有足够的权限');
    }

    return true;
  }
}
