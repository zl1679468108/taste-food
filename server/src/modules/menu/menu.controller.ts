import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/constants/enums';
import { success, ApiResponse } from '../../common/interfaces/api-response.interface';
import { MenuService } from './menu.service';
import { CreateCategoryDto, CategoryResponseDto } from './dto/category.dto';
import { CreateMenuItemDto, MenuItemResponseDto } from './dto/menu-item.dto';
import { SpecGroupResponseDto } from './dto/spec.dto';

const DEFAULT_SHOP_ID = '00000000-0000-0000-0000-000000000001';

@Controller()
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  @Get('categories')
  async getCategories(
    @Query('shop_id') shopId?: string,
  ): Promise<ApiResponse<CategoryResponseDto[]>> {
    const categories = await this.menuService.getAllCategories(shopId);
    return success(categories);
  }

  @Get('menu-items')
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
  async getPopularItems(
    @Query('shop_id') shopId?: string,
    @Query('limit') limit?: string,
    @CurrentUser('userId') userId?: string,
  ): Promise<ApiResponse<MenuItemResponseDto[]>> {
    const parsedLimit = parseInt(limit || '10', 10);
    const items = await this.menuService.getPopularItems(shopId, parsedLimit, userId);
    return success(items);
  }

  @Get('menu-items/:id')
  async getMenuItem(@Param('id') id: string): Promise<ApiResponse<MenuItemResponseDto>> {
    const item = await this.menuService.getMenuItemById(id);
    return success(item);
  }

  @Get('menu-items/:id/specs')
  async getMenuItemSpecs(@Param('id') id: string): Promise<ApiResponse<SpecGroupResponseDto[]>> {
    const specs = await this.menuService.getMenuItemSpecs(id);
    return success(specs);
  }

  @Post('categories')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async createCategory(@Body() dto: CreateCategoryDto): Promise<ApiResponse<CategoryResponseDto>> {
    const category = await this.menuService.createCategory(dto);
    return success(category, '分类创建成功');
  }

  @Patch('categories/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async updateCategory(
    @Param('id') id: string,
    @Body() dto: Partial<CreateCategoryDto>,
  ): Promise<ApiResponse<CategoryResponseDto>> {
    const category = await this.menuService.updateCategory(id, dto);
    return success(category, '分类更新成功');
  }

  @Delete('categories/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async deleteCategory(@Param('id') id: string): Promise<ApiResponse<null>> {
    await this.menuService.deleteCategory(id);
    return success(null, '分类删除成功');
  }

  @Post('menu-items')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async createMenuItem(@Body() dto: CreateMenuItemDto): Promise<ApiResponse<MenuItemResponseDto>> {
    const item = await this.menuService.createMenuItem(dto);
    return success(item, '菜品创建成功');
  }

  @Patch('menu-items/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async updateMenuItem(
    @Param('id') id: string,
    @Body() dto: Partial<CreateMenuItemDto>,
  ): Promise<ApiResponse<MenuItemResponseDto>> {
    const item = await this.menuService.updateMenuItem(id, dto);
    return success(item, '菜品更新成功');
  }

  @Delete('menu-items/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async deleteMenuItem(@Param('id') id: string): Promise<ApiResponse<null>> {
    await this.menuService.deleteMenuItem(id);
    return success(null, '菜品删除成功');
  }

  @Post('menu-items/:id/favorite')
  @UseGuards(AuthGuard)
  async toggleFavorite(
    @Param('id') id: string,
    @CurrentUser('userId') userId: string,
  ): Promise<ApiResponse<{ isFavorite: boolean }>> {
    const isFavorite = await this.menuService.toggleFavorite(id, userId);
    return success({ isFavorite }, isFavorite ? '收藏成功' : '取消收藏成功');
  }
}
