import { Controller, Get, Post, Patch, Delete, Put, Param, Query, Body } from '@nestjs/common';
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
    @Query('tagIds') tagIds?: string,
    @CurrentUser() user?: CurrentUserPayload,
  ): Promise<ApiResponse<PaginatedShopCustomers>> {
    const days = hasOrderWithinDays ? parseInt(hasOrderWithinDays, 10) : undefined;
    const tagIdArr = tagIds
      ? tagIds.split(',').map((s) => s.trim()).filter(Boolean)
      : undefined;
    const result = await this.customerService.getShopCustomers(user?.shopId, {
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
      keyword,
      sortBy,
      hasOrderWithinDays: Number.isFinite(days) ? days : undefined,
      tagIds: tagIdArr,
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

  // ============ 顾客标签（店铺级） ============

  @Get('tags')
  @Roles(UserRole.MERCHANT)
  async listTags(@CurrentUser() user?: CurrentUserPayload) {
    const result = await this.customerService.listTags(user?.shopId);
    return success(result);
  }

  @Post('tags')
  @Roles(UserRole.MERCHANT)
  async createTag(
    @Body() body: { name?: string; color?: string },
    @CurrentUser() user?: CurrentUserPayload,
  ) {
    const result = await this.customerService.createTag(user?.shopId, body.name || '', body.color || '#1677ff');
    return success(result);
  }

  @Patch('tags/:id')
  @Roles(UserRole.MERCHANT)
  async updateTag(
    @Param('id') id: string,
    @Body() body: { name?: string; color?: string },
    @CurrentUser() user?: CurrentUserPayload,
  ) {
    const result = await this.customerService.updateTag(user?.shopId, id, body.name, body.color);
    return success(result);
  }

  @Delete('tags/:id')
  @Roles(UserRole.MERCHANT)
  async deleteTag(
    @Param('id') id: string,
    @CurrentUser() user?: CurrentUserPayload,
  ) {
    await this.customerService.deleteTag(user?.shopId, id);
    return success(null);
  }

  @Get(':id/tags')
  @Roles(UserRole.MERCHANT)
  async getCustomerTags(
    @Param('id') id: string,
    @CurrentUser() user?: CurrentUserPayload,
  ) {
    const result = await this.customerService.getCustomerTags(user?.shopId, id);
    return success(result);
  }

  @Put(':id/tags')
  @Roles(UserRole.MERCHANT)
  async setCustomerTags(
    @Param('id') id: string,
    @Body() body: { tagIds: string[] },
    @CurrentUser() user?: CurrentUserPayload,
  ) {
    const result = await this.customerService.setCustomerTags(user?.shopId, id, body.tagIds || []);
    return success(result);
  }
}
