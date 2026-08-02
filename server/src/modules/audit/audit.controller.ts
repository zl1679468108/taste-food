import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { PlatformOnly } from '../../common/decorators/shop-scope.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/constants/enums';
import { DEFAULT_SHOP_ID } from '../../common/constants/shop';
import { success, ApiResponse } from '../../common/interfaces/api-response.interface';
import { PaginatedData } from '../../common/interfaces/pagination.interface';
import { AuditLogRecord, AuditService } from './audit.service';

// 审计为平台治理专属：前缀 /api/platform/audit-logs，仅平台管理员可访问（T300.6 deny-by-default）
@Controller('platform/audit-logs')
@PlatformOnly()
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Roles(UserRole.ADMIN)
  async list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('method') method?: string,
    @Query('action') action?: string,
    @Query('keyword') keyword?: string,
    @CurrentUser('shopId') userShopId?: string,
  ): Promise<ApiResponse<PaginatedData<AuditLogRecord>>> {
    const shopId = userShopId || DEFAULT_SHOP_ID;
    const result = await this.auditService.list({
      shopId,
      page: parseInt(page || '1', 10) || 1,
      pageSize: parseInt(pageSize || '20', 10) || 20,
      method,
      action,
      keyword,
    });
    return success(result);
  }
}
