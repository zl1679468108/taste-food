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
import { CreateShopTableDto, UpdateShopTableDto, ShopTableDto } from './dto/table.dto';

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

  /** 管理：全部桌台 */
  @Get(':id/tables/manage')
  @Roles(UserRole.ADMIN)
  async listManageTables(
    @Param('id') id: string,
    @CurrentUser('shopId') userShopId?: string,
  ): Promise<ApiResponse<ShopTableDto[]>> {
    if (userShopId && id !== userShopId) {
      throw new ForbiddenException('无权查看其他店铺桌台');
    }
    const tables = await this.tableService.list(id, { includeInactive: true });
    return success(tables);
  }

  @Post(':id/tables/seed')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async seedTables(
    @Param('id') id: string,
    @CurrentUser('shopId') userShopId?: string,
  ): Promise<ApiResponse<ShopTableDto[]>> {
    if (userShopId && id !== userShopId) {
      throw new ForbiddenException('无权操作其他店铺桌台');
    }
    const tables = await this.tableService.seed(id);
    return success(tables, '已初始化默认桌台');
  }

  @Post(':id/tables')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async createTable(
    @Param('id') id: string,
    @Body() dto: CreateShopTableDto,
    @CurrentUser('shopId') userShopId?: string,
  ): Promise<ApiResponse<ShopTableDto>> {
    if (userShopId && id !== userShopId) {
      throw new ForbiddenException('无权操作其他店铺桌台');
    }
    const table = await this.tableService.create(id, dto);
    return success(table, '桌台已创建');
  }

  @Patch(':id/tables/:tableId')
  @Roles(UserRole.ADMIN)
  async updateTable(
    @Param('id') id: string,
    @Param('tableId') tableId: string,
    @Body() dto: UpdateShopTableDto,
    @CurrentUser('shopId') userShopId?: string,
  ): Promise<ApiResponse<ShopTableDto>> {
    if (userShopId && id !== userShopId) {
      throw new ForbiddenException('无权操作其他店铺桌台');
    }
    const table = await this.tableService.update(id, tableId, dto);
    return success(table, '桌台已更新');
  }

  @Delete(':id/tables/:tableId')
  @Roles(UserRole.ADMIN)
  async deleteTable(
    @Param('id') id: string,
    @Param('tableId') tableId: string,
    @CurrentUser('shopId') userShopId?: string,
  ): Promise<ApiResponse<null>> {
    if (userShopId && id !== userShopId) {
      throw new ForbiddenException('无权操作其他店铺桌台');
    }
    await this.tableService.remove(id, tableId);
    return success(null, '桌台已删除');
  }

  @Get(':id')
  @Public()
  async getShop(@Param('id') id: string): Promise<ApiResponse<ShopResponseDto>> {
    const shop = await this.shopService.findById(id);
    return success(shop);
  }

  // ===== 受保护接口（Admin 角色）=====

  @Post()
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async createShop(@Body() dto: CreateShopDto): Promise<ApiResponse<ShopResponseDto>> {
    const shop = await this.shopService.create(dto);
    return success(shop, '店铺创建成功');
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
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

  /** 仅更新营业时段（Admin） */
  @Patch(':id/business-hours')
  @Roles(UserRole.ADMIN)
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
  @Roles(UserRole.ADMIN)
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
  async deleteShop(
    @Param('id') id: string,
    @CurrentUser('shopId') userShopId?: string,
  ): Promise<ApiResponse<null>> {
    if (userShopId && id !== userShopId) {
      throw new ForbiddenException('无权删除其他店铺');
    }
    await this.shopService.delete(id);
    return success(null, '店铺删除成功');
  }
}
