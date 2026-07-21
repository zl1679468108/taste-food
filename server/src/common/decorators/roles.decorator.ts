import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../constants/enums';

export const ROLES_KEY = 'roles';
/**
 * 标记接口所需角色。统一使用 UserRole 枚举，避免字符串硬编码。
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
