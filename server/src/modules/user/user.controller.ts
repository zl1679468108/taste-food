import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/constants/enums';
import { success, ApiResponse } from '../../common/interfaces/api-response.interface';
import { UserService, UserSummary, PaginatedUsers } from './user.service';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async getUsers(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ): Promise<ApiResponse<PaginatedUsers>> {
    const p = parseInt(page || '1', 10);
    const ps = parseInt(pageSize || '20', 10);
    const users = await this.userService.getUsers(p, ps);
    return success(users);
  }

  @Get(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async getUserDetail(@Param('id') id: string): Promise<ApiResponse<UserSummary>> {
    const user = await this.userService.getUserDetail(id);
    return success(user);
  }
}
