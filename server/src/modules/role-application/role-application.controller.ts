import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { RoleApplicationService } from './role-application.service';
import { CreateRoleApplicationDto, ReviewRoleApplicationDto } from './dto/role-application.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PlatformOnly } from '../../common/decorators/shop-scope.decorator';
import { UserRole } from '../../common/constants/enums';
import { success, ApiResponse } from '../../common/interfaces/api-response.interface';

@Controller('role-applications')
export class RoleApplicationController {
  constructor(private readonly service: RoleApplicationService) {}

  @Post()
  async create(
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateRoleApplicationDto,
  ): Promise<ApiResponse<any>> {
    const row = await this.service.create(userId, dto);
    return success(row, '申请已提交');
  }

  @Get('mine')
  async mine(@CurrentUser('userId') userId: string): Promise<ApiResponse<any>> {
    const rows = await this.service.listMine(userId);
    return success(rows);
  }

  @Get('check-eligibility')
  async checkEligibility(
    @CurrentUser('userId') userId: string,
    @Query('applyRole') applyRole: 'merchant' | 'rider',
    @Query('shopName') shopName?: string,
  ): Promise<ApiResponse<any>> {
    const data = await this.service.checkEligibility(userId, applyRole, shopName);
    return success(data);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  @PlatformOnly()
  async list(@Query('status') status?: string): Promise<ApiResponse<any>> {
    const rows = await this.service.listAll(status);
    return success(rows);
  }

  @Patch(':id/review')
  @Roles(UserRole.ADMIN)
  @PlatformOnly()
  async review(
    @Param('id') id: string,
    @CurrentUser('userId') reviewerId: string,
    @Body() dto: ReviewRoleApplicationDto,
  ): Promise<ApiResponse<any>> {
    const row = await this.service.review(id, reviewerId, dto);
    return success(row, dto.status === 'approved' ? '已通过' : '已驳回');
  }
}
