import { Controller, Get, Param, Query } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/constants/enums';
import { success, ApiResponse } from '../../common/interfaces/api-response.interface';
import {
  CustomerService,
  PaginatedShopCustomers,
  ShopCustomerProfile,
  CustomerSortBy,
} from './customer.service';

/**
 * 商家视角「顾客管理」接口（§3.24 / T313）
 * 仅商家可访问；数据范围严格绑定当前商家的 shop_id。
 */
@Controller('merchant/customers')
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Get()
  @Roles(UserRole.MERCHANT)
  async list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
    @Query('sortBy') sortBy?: CustomerSortBy,
    @Query('hasOrderWithinDays') hasOrderWithinDays?: string,
    @CurrentUser() user?: CurrentUserPayload,
  ): Promise<ApiResponse<PaginatedShopCustomers>> {
    const days = hasOrderWithinDays ? parseInt(hasOrderWithinDays, 10) : undefined;
    const result = await this.customerService.getShopCustomers(user?.shopId, {
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
      keyword,
      sortBy,
      hasOrderWithinDays: Number.isFinite(days) ? days : undefined,
    });
    return success(result);
  }

  @Get(':id/profile')
  @Roles(UserRole.MERCHANT)
  async profile(
    @Param('id') id: string,
    @CurrentUser() user?: CurrentUserPayload,
  ): Promise<ApiResponse<ShopCustomerProfile>> {
    const result = await this.customerService.getShopCustomerProfile(user?.shopId, id);
    return success(result);
  }

}
