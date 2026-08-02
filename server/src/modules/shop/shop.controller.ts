import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import {
  MerchantOnly,
  PlatformOnly,
} from '../../common/decorators/shop-scope.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/constants/enums';
import { success, ApiResponse } from '../../common/interfaces/api-response.interface';
import { ShopService } from './shop.service';
import {
  CreateShopDto,
  UpdateShopDto,
  UpdateBusinessHoursDto,
  ShopResponseDto,
  BusinessHoursResponseDto,
} from './dto/shop.dto';
import { TableService } from './table.service';
import { ShopTableDto } from './dto/table.dto';

/**
 * 店铺资源。
 *
 * 路由保持中性前缀 `/api/shops/**`：GET 列表/详情/营业时段/在座桌台
 * 都是 client/ 顾客侧主链路，不可改名。
 * 双入口隔离改由装饰器表达：开店/关店 @PlatformOnly，本店资料写 @MerchantOnly。
 */
@Controller('shops')
export class ShopController {
  constructor(
    private readonly shopService: ShopService,
    private readonly tableService: TableService,
  ) {}

  // ===== 公开接口（顾客浏览店铺无需登录）=====

  @Get()
  @Public()
  async getAllShops(): Promise<ApiResponse<ShopResponseDto[]>> {
    const shops = await this.shopService.findAll();
    return success(shops);
  }

  /** 须放在 :id 之前，避免被通用参数路由吞掉 */
  @Get(':id/business-hours')
  @Public()
  async getBusinessHours(
    @Param('id') id: string,
  ): Promise<ApiResponse<BusinessHoursResponseDto>> {
    const data = await this.shopService.getBusinessHours(id);
    return success(data);
  }

  /** 公开：顾客可见启用中的桌台（扫码入座/选桌） */
  @Get(':id/tables')
  @Public()
  async listActiveTables(@Param('id') id: string): Promise<ApiResponse<ShopTableDto[]>> {
    const tables = await this.tableService.list(id, { includeInactive: false });
    return success(tables);
  }

  // 桌台管理（含停用桌台、增删改）已迁至 MerchantTableController：
  // /api/merchant/shops/:id/tables

  @Get(':id')
  @Public()
  async getShop(@Param('id') id: string): Promise<ApiResponse<ShopResponseDto>> {
    const shop = await this.shopService.findById(id);
    return success(shop);
  }

  // ===== 受保护接口（Admin 角色）=====

  @Post()
  @Roles(UserRole.ADMIN)
  @PlatformOnly()
  @HttpCode(HttpStatus.CREATED)
  async createShop(
    @Body() dto: CreateShopDto,
  ): Promise<ApiResponse<ShopResponseDto>> {
    // 开店属平台治理动作，@PlatformOnly 已挡掉一切绑店账号
    const shop = await this.shopService.create(dto);
    return success(shop, '店铺创建成功');
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.MERCHANT)
  @MerchantOnly()
  async updateShop(
    @Param('id') id: string,
    @Body() dto: UpdateShopDto,
    @CurrentUser('shopId') userShopId?: string,
  ): Promise<ApiResponse<ShopResponseDto>> {
    // 多租户隔离：admin 只能修改自己绑定的店铺
    if (userShopId && id !== userShopId) {
      throw new ForbiddenException('无权修改其他店铺');
    }
    const shop = await this.shopService.update(id, dto);
    return success(shop, '店铺更新成功');
  }

  /** 仅更新营业时段（商家本店） */
  @Patch(':id/business-hours')
  @Roles(UserRole.ADMIN, UserRole.MERCHANT)
  @MerchantOnly()
  async updateBusinessHours(
    @Param('id') id: string,
    @Body() dto: UpdateBusinessHoursDto,
    @CurrentUser('shopId') userShopId?: string,
  ): Promise<ApiResponse<ShopResponseDto>> {
    if (userShopId && id !== userShopId) {
      throw new ForbiddenException('无权修改其他店铺');
    }
    const shop = await this.shopService.update(id, {
      businessHours: dto.businessHours,
    });
    return success(shop, '营业时段已更新');
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN, UserRole.MERCHANT)
  @MerchantOnly()
  async toggleShopStatus(
    @Param('id') id: string,
    @CurrentUser('shopId') userShopId?: string,
  ): Promise<ApiResponse<ShopResponseDto>> {
    if (userShopId && id !== userShopId) {
      throw new ForbiddenException('无权修改其他店铺状态');
    }
    const shop = await this.shopService.toggleStatus(id);
    return success(shop, '营业状态已更新');
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @PlatformOnly()
  async deleteShop(@Param('id') id: string): Promise<ApiResponse<null>> {
    // 关店属平台治理动作，@PlatformOnly 已挡掉一切绑店账号
    await this.shopService.delete(id);
    return success(null, '店铺删除成功');
  }
}
