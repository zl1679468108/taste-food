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
} from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/constants/enums';
import { DEFAULT_SHOP_ID } from '../../common/constants/shop';
import { resolveAdminTargetShopId } from '../../common/utils/admin-shop-scope';
import { success, ApiResponse } from '../../common/interfaces/api-response.interface';
import { MenuService } from './menu.service';
import { CreateCategoryDto, CategoryResponseDto } from './dto/category.dto';
import { CreateMenuItemDto, MenuItemResponseDto } from './dto/menu-item.dto';
import { SpecGroupResponseDto } from './dto/spec.dto';

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
 * 菜单控制器：包含分类（categories）和菜品（menu-items）两类资源。
 * 公开接口：GET 列表/详情/规格/热门（顾客浏览无需登录）
 * 受保护接口：POST/PATCH/DELETE（需 Admin 角色）
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

  @Get('menu-items/:id/specs')
  @Public()
  async getMenuItemSpecs(@Param('id') id: string): Promise<ApiResponse<SpecGroupResponseDto[]>> {
    const specs = await this.menuService.getMenuItemSpecs(id);
    return success(specs);
  }

  // ===== 受保护接口（Admin 角色）=====

  @Post('categories')
  @Roles(UserRole.ADMIN, UserRole.MERCHANT)
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
  async updateCategory(
    @Param('id') id: string,
    @Body() dto: Partial<CreateCategoryDto>,
  ): Promise<ApiResponse<CategoryResponseDto>> {
    const category = await this.menuService.updateCategory(id, dto);
    return success(category, '分类更新成功');
  }

  @Delete('categories/:id')
  @Roles(UserRole.ADMIN, UserRole.MERCHANT)
  async deleteCategory(@Param('id') id: string): Promise<ApiResponse<null>> {
    await this.menuService.deleteCategory(id);
    return success(null, '分类删除成功');
  }

  @Post('menu-items')
  @Roles(UserRole.ADMIN, UserRole.MERCHANT)
  @HttpCode(HttpStatus.CREATED)
  async createMenuItem(
    @Body() dto: CreateMenuItemDto,
    @CurrentUser('shopId') userShopId?: string,
  ): Promise<ApiResponse<MenuItemResponseDto>> {
    dto.shopId = resolveAdminShopId(userShopId, dto.shopId);
    const item = await this.menuService.createMenuItem(dto);
    return success(item, '菜品创建成功');
  }

  @Patch('menu-items/:id')
  @Roles(UserRole.ADMIN, UserRole.MERCHANT)
  async updateMenuItem(
    @Param('id') id: string,
    @Body() dto: Partial<CreateMenuItemDto>,
  ): Promise<ApiResponse<MenuItemResponseDto>> {
    const item = await this.menuService.updateMenuItem(id, dto);
    return success(item, '菜品更新成功');
  }

  @Delete('menu-items/:id')
  @Roles(UserRole.ADMIN, UserRole.MERCHANT)
  async deleteMenuItem(@Param('id') id: string): Promise<ApiResponse<null>> {
    await this.menuService.deleteMenuItem(id);
    return success(null, '菜品删除成功');
  }

  // 收藏切换接口已统一到 POST /favorites/toggle，此处不再重复暴露
}
