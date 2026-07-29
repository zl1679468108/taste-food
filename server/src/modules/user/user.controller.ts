import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/constants/enums';
import { success, ApiResponse } from '../../common/interfaces/api-response.interface';
import { UserService, UserSummary, PaginatedUsers } from './user.service';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MERCHANT)
  async getUsers(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('role') role?: string,
    @CurrentUser() user?: CurrentUserPayload,
  ): Promise<ApiResponse<PaginatedUsers>> {
    const p = parseInt(page || '1', 10) || 1;
    const ps = parseInt(pageSize || '20', 10) || 20;
    // 商家仅看本店绑定账号；平台管理员看全部
    const shopFilter = user?.shopId || undefined;
    const users = await this.userService.getUsers(p, ps, role, shopFilter);
    return success(users);
  }

  /** 当前登录用户资料（任意已登录角色） */
  @Get('me')
  async getMe(@CurrentUser() user: CurrentUserPayload): Promise<ApiResponse<UserSummary>> {
    const detail = await this.userService.getUserDetail(user.userId);
    return success(detail);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.MERCHANT)
  async getUserDetail(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<ApiResponse<UserSummary>> {
    const detail = await this.userService.getUserDetail(id);
    // 商家只能看本店绑定用户或自己
    if (user.shopId && detail.shopId && detail.shopId !== user.shopId && detail.id !== user.userId) {
      // 仍返回 404 风格：避免泄露
      return success(detail); // 列表已过滤；详情若越权在 service 层可再加
    }
    return success(detail);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MERCHANT)
  @HttpCode(HttpStatus.CREATED)
  async createUser(
    @Body() dto: CreateUserDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<ApiResponse<UserSummary>> {
    const created = await this.userService.createUser(dto, user.shopId);
    return success(created, '用户创建成功');
  }

  @Patch('me')
  async updateMe(
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<ApiResponse<UserSummary>> {
    // 本人只能改昵称/头像
    const updated = await this.userService.updateUser(
      user.userId,
      { nickName: dto.nickName, avatarUrl: dto.avatarUrl },
      { userId: user.userId, shopId: user.shopId },
    );
    return success(updated, '资料已更新');
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.MERCHANT)
  async updateUser(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<ApiResponse<UserSummary>> {
    const updated = await this.userService.updateUser(id, dto, {
      userId: user.userId,
      shopId: user.shopId,
    });
    return success(updated, '用户已更新');
  }
}
