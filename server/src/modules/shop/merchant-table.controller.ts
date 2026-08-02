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
import { MerchantOnly } from '../../common/decorators/shop-scope.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/constants/enums';
import { success, ApiResponse } from '../../common/interfaces/api-response.interface';
import { TableService } from './table.service';
import { CreateShopTableDto, UpdateShopTableDto, ShopTableDto } from './dto/table.dto';

/**
 * 商家桌台管理（T300.5 双入口拆分）。
 *
 * 迁到 /api/merchant/shops/:id/tables：这些接口只服务商家后台，
 * 顾客侧扫码选桌走公开的 GET /api/shops/:id/tables（只返回启用中的桌台），
 * 两者互不影响。
 */
@Controller('merchant/shops/:id/tables')
@Roles(UserRole.ADMIN, UserRole.MERCHANT)
@MerchantOnly()
export class MerchantTableController {
  constructor(private readonly tableService: TableService) {}

  /** 商家只能操作自己绑定的店铺 */
  private assertOwnShop(shopId: string, userShopId?: string): void {
    if (userShopId && shopId !== userShopId) {
      throw new ForbiddenException('无权操作其他店铺桌台');
    }
  }

  /** 管理视角：含已停用桌台 */
  @Get()
  async listTables(
    @Param('id') id: string,
    @CurrentUser('shopId') userShopId?: string,
  ): Promise<ApiResponse<ShopTableDto[]>> {
    this.assertOwnShop(id, userShopId);
    const tables = await this.tableService.list(id, { includeInactive: true });
    return success(tables);
  }

  @Post('seed')
  @HttpCode(HttpStatus.CREATED)
  async seedTables(
    @Param('id') id: string,
    @CurrentUser('shopId') userShopId?: string,
  ): Promise<ApiResponse<ShopTableDto[]>> {
    this.assertOwnShop(id, userShopId);
    const tables = await this.tableService.seed(id);
    return success(tables, '已初始化默认桌台');
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createTable(
    @Param('id') id: string,
    @Body() dto: CreateShopTableDto,
    @CurrentUser('shopId') userShopId?: string,
  ): Promise<ApiResponse<ShopTableDto>> {
    this.assertOwnShop(id, userShopId);
    const table = await this.tableService.create(id, dto);
    return success(table, '桌台已创建');
  }

  @Patch(':tableId')
  async updateTable(
    @Param('id') id: string,
    @Param('tableId') tableId: string,
    @Body() dto: UpdateShopTableDto,
    @CurrentUser('shopId') userShopId?: string,
  ): Promise<ApiResponse<ShopTableDto>> {
    this.assertOwnShop(id, userShopId);
    const table = await this.tableService.update(id, tableId, dto);
    return success(table, '桌台已更新');
  }

  @Delete(':tableId')
  async deleteTable(
    @Param('id') id: string,
    @Param('tableId') tableId: string,
    @CurrentUser('shopId') userShopId?: string,
  ): Promise<ApiResponse<null>> {
    this.assertOwnShop(id, userShopId);
    await this.tableService.remove(id, tableId);
    return success(null, '桌台已删除');
  }
}
