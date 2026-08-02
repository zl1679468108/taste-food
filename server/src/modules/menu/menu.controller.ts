import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus,
  HttpException,
  BadRequestException,
} from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { MerchantOnly } from '../../common/decorators/shop-scope.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/constants/enums';
import { DEFAULT_SHOP_ID } from '../../common/constants/shop';
import { resolveAdminTargetShopId } from '../../common/utils/admin-shop-scope';
import { success, ApiResponse } from '../../common/interfaces/api-response.interface';
import { MenuService } from './menu.service';
import { CreateCategoryDto, CategoryResponseDto } from './dto/category.dto';
import {
  CreateMenuItemDto,
  MenuItemResponseDto,
  BatchUpdateMenuItemStatusDto,
  BatchUpdateMenuItemStatusResultDto,
  MAX_BATCH_STATUS_IDS,
} from './dto/menu-item.dto';
import { SpecGroupResponseDto, CreateSpecGroupDto } from './dto/spec.dto';

/**
 * 解析写操作目标店铺：
 * - 商家（JWT 有 shopId）：强制本店
 * - 平台管理员（JWT 无 shopId）：使用请求中的 shopId，缺省 DEFAULT_SHOP_ID
 */
function resolveAdminShopId(userShopId?: string, requestedShopId?: string): string {
  return resolveAdminTargetShopId(userShopId, requestedShopId, {
    lockToBoundShop: !!userShopId,
  });
}

/**
 * 解析更新/删除操作的归属校验店铺（service 层据此过滤 shop_id）：
 * - 商家（JWT 有 shopId）：强制本店，请求显式指定其他店铺时抛 403
 * - 平台管理员（JWT 无 shopId）：使用请求显式指定的 shopId；未指定时返回 undefined
 *   表示不限制店铺，保留平台管理员跨店操作既有语义（不能退化成 DEFAULT_SHOP_ID）
 */
function resolveWriteScopeShopId(
  userShopId?: string,
  requestedShopId?: string,
): string | undefined {
  if (userShopId) return resolveAdminShopId(userShopId, requestedShopId);
  return requestedShopId?.trim() || undefined;
}

/**
 * 菜单控制器：包含分类（categories）和菜品（menu-items）两类资源。
 *
 * 路由保持中性前缀（不迁 /api/merchant）：GET 是顾客点餐主链路，
 * 且 client/ 小程序管理页同样直接读写 /menu-items、/categories。
 * - 公开接口：GET 列表/详情/规格/热门（顾客浏览无需登录）
 * - 写接口：@MerchantOnly，仅商家可改本店菜单；平台管理员只治理、不代改菜单
 */
@Controller()
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  // ===== 公开接口（无需认证）=====

  @Get('categories')
  @Public()
  async getCategories(
    @Query('shop_id') shopId?: string,
  ): Promise<ApiResponse<CategoryResponseDto[]>> {
    const categories = await this.menuService.getAllCategories(shopId);
    return success(categories);
  }

  @Get('menu-items')
  @Public()
  async getMenuItems(
    @Query('shop_id') shopId?: string,
    @Query('category_id') categoryId?: string,
    @Query('search') search?: string,
    @CurrentUser('userId') userId?: string,
  ): Promise<ApiResponse<MenuItemResponseDto[]>> {
    const items = await this.menuService.getMenuItems(categoryId, search, shopId, userId);
    return success(items);
  }

  @Get('menu-items/popular')
  @Public()
  async getPopularItems(
    @Query('shop_id') shopId?: string,
    @Query('limit') limit?: string,
    @CurrentUser('userId') userId?: string,
  ): Promise<ApiResponse<MenuItemResponseDto[]>> {
    // 校验并约束 limit 范围，避免 NaN 或过大值
    const parsed = parseInt(limit || '10', 10);
    const parsedLimit = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 50) : 10;
    const items = await this.menuService.getPopularItems(shopId, parsedLimit, userId);
    return success(items);
  }

  @Get('menu-items/:id')
  @Public()
  async getMenuItem(@Param('id') id: string): Promise<ApiResponse<MenuItemResponseDto>> {
    const item = await this.menuService.getMenuItemById(id);
    return success(item);
  }


  @Get('spec-groups')
  @Public()
  async getSpecGroups(
    @Query('shop_id') shopId?: string,
  ): Promise<ApiResponse<SpecGroupResponseDto[]>> {
    const groups = await this.menuService.getShopSpecGroups(shopId);
    return success(groups);
  }

  @Get('menu-items/:id/specs')
  @Public()
  async getMenuItemSpecs(@Param('id') id: string): Promise<ApiResponse<SpecGroupResponseDto[]>> {
    const specs = await this.menuService.getMenuItemSpecs(id);
    return success(specs);
  }

  // ===== 受保护接口（Admin 角色）=====

  @Post('categories')
  @Roles(UserRole.ADMIN, UserRole.MERCHANT)
  @MerchantOnly()
  @HttpCode(HttpStatus.CREATED)
  async createCategory(
    @Body() dto: CreateCategoryDto,
    @CurrentUser('shopId') userShopId?: string,
  ): Promise<ApiResponse<CategoryResponseDto>> {
    // 商家强制本店；平台管理员可用 body.shopId 指定目标店
    dto.shopId = resolveAdminShopId(userShopId, dto.shopId);
    const category = await this.menuService.createCategory(dto);
    return success(category, '分类创建成功');
  }

  @Patch('categories/:id')
  @Roles(UserRole.ADMIN, UserRole.MERCHANT)
  @MerchantOnly()
  async updateCategory(
    @Param('id') id: string,
    @Body() dto: Partial<CreateCategoryDto>,
    @CurrentUser('shopId') userShopId?: string,
  ): Promise<ApiResponse<CategoryResponseDto>> {
    // 商家强制本店；平台管理员可用 body.shopId 指定目标店
    const scopeShopId = resolveWriteScopeShopId(userShopId, dto.shopId);
    const category = await this.menuService.updateCategory(id, dto, scopeShopId);
    return success(category, '分类更新成功');
  }

  @Delete('categories/:id')
  @Roles(UserRole.ADMIN, UserRole.MERCHANT)
  @MerchantOnly()
  async deleteCategory(
    @Param('id') id: string,
    @Query('shop_id') requestedShopId?: string,
    @CurrentUser('shopId') userShopId?: string,
  ): Promise<ApiResponse<null>> {
    const scopeShopId = resolveWriteScopeShopId(userShopId, requestedShopId);
    await this.menuService.deleteCategory(id, scopeShopId);
    return success(null, '分类删除成功');
  }

  @Post('menu-items')
  @Roles(UserRole.ADMIN, UserRole.MERCHANT)
  @MerchantOnly()
  @HttpCode(HttpStatus.CREATED)
  async createMenuItem(
    @Body() dto: CreateMenuItemDto,
    @CurrentUser('shopId') userShopId?: string,
  ): Promise<ApiResponse<MenuItemResponseDto>> {
    dto.shopId = resolveAdminShopId(userShopId, dto.shopId);
    const item = await this.menuService.createMenuItem(dto);
    return success(item, '菜品创建成功');
  }

  /**
   * 批量上/下架菜品。
   * 注意：必须声明在 `menu-items/:id` 之前，否则会被动态路由吞掉。
   */
  @Patch('menu-items/batch-status')
  @Roles(UserRole.ADMIN, UserRole.MERCHANT)
  @MerchantOnly()
  async batchUpdateMenuItemStatus(
    @Body() dto: BatchUpdateMenuItemStatusDto,
    @CurrentUser('shopId') userShopId?: string,
  ): Promise<ApiResponse<BatchUpdateMenuItemStatusResultDto>> {
    try {
      const ids = Array.from(new Set(dto.ids.map((id) => id.trim()).filter(Boolean)));
      if (ids.length === 0) {
        throw new BadRequestException('请选择要操作的菜品');
      }
      if (ids.length > MAX_BATCH_STATUS_IDS) {
        throw new BadRequestException(`单次最多操作 ${MAX_BATCH_STATUS_IDS} 个菜品`);
      }

      // 商家强制本店；平台管理员可用 body.shopId 指定目标店
      const scopeShopId = resolveWriteScopeShopId(userShopId, dto.shopId);
      const updated = await this.menuService.batchUpdateMenuItemStatus(
        ids,
        dto.isAvailable,
        scopeShopId,
      );
      return success(
        { updated },
        dto.isAvailable ? `已上架 ${updated} 个菜品` : `已下架 ${updated} 个菜品`,
      );
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new BadRequestException(
        `批量更新菜品状态失败: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  @Patch('menu-items/:id')
  @Roles(UserRole.ADMIN, UserRole.MERCHANT)
  @MerchantOnly()
  async updateMenuItem(
    @Param('id') id: string,
    @Body() dto: Partial<CreateMenuItemDto>,
    @CurrentUser('shopId') userShopId?: string,
  ): Promise<ApiResponse<MenuItemResponseDto>> {
    // 商家强制本店；平台管理员可用 body.shopId 指定目标店
    const scopeShopId = resolveWriteScopeShopId(userShopId, dto.shopId);
    const item = await this.menuService.updateMenuItem(id, dto, scopeShopId);
    return success(item, '菜品更新成功');
  }

  @Delete('menu-items/:id')
  @Roles(UserRole.ADMIN, UserRole.MERCHANT)
  @MerchantOnly()
  async deleteMenuItem(
    @Param('id') id: string,
    @Query('shop_id') requestedShopId?: string,
    @CurrentUser('shopId') userShopId?: string,
  ): Promise<ApiResponse<null>> {
    const scopeShopId = resolveWriteScopeShopId(userShopId, requestedShopId);
    await this.menuService.deleteMenuItem(id, scopeShopId);
    return success(null, '菜品删除成功');
  }

  // 收藏切换接口已统一到 POST /favorites/toggle，此处不再重复暴露

  @Post('spec-groups')
  @Roles(UserRole.ADMIN, UserRole.MERCHANT)
  @MerchantOnly()
  async createSpecGroup(
    @Body() dto: CreateSpecGroupDto,
    @CurrentUser('shopId') userShopId?: string,
  ): Promise<ApiResponse<SpecGroupResponseDto>> {
    // 商家强制本店；平台管理员可用 body.shopId 指定目标店
    dto.shopId = resolveAdminShopId(userShopId, dto.shopId);
    const group = await this.menuService.createSpecGroup(dto);
    return success(group, '规格组创建成功');
  }

  @Patch('spec-groups/:id')
  @Roles(UserRole.ADMIN, UserRole.MERCHANT)
  @MerchantOnly()
  async updateSpecGroup(
    @Param('id') id: string,
    @Body() dto: Partial<CreateSpecGroupDto>,
    @CurrentUser('shopId') userShopId?: string,
  ): Promise<ApiResponse<SpecGroupResponseDto>> {
    // 商家强制本店；平台管理员可用 body.shopId 指定目标店
    const scopeShopId = resolveWriteScopeShopId(userShopId, dto.shopId);
    const group = await this.menuService.updateSpecGroup(id, dto, scopeShopId);
    return success(group, '规格组更新成功');
  }

  @Delete('spec-groups/:id')
  @Roles(UserRole.ADMIN, UserRole.MERCHANT)
  @MerchantOnly()
  async deleteSpecGroup(
    @Param('id') id: string,
    @Query('shop_id') requestedShopId?: string,
    @CurrentUser('shopId') userShopId?: string,
  ): Promise<ApiResponse<null>> {
    const scopeShopId = resolveWriteScopeShopId(userShopId, requestedShopId);
    await this.menuService.deleteSpecGroup(id, scopeShopId);
    return success(null, '规格组删除成功');
  }
}
