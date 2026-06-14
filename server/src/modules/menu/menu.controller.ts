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
import { UserRole } from '../../common/constants/enums';
import { success, ApiResponse } from '../../common/interfaces/api-response.interface';
import { MenuService } from './menu.service';
import { CreateCategoryDto, CategoryResponseDto } from './dto/category.dto';
import { CreateMenuItemDto, MenuItemResponseDto } from './dto/menu-item.dto';

@Controller()
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  // ========== 公开/用户端 API ==========

  @Get('categories')
  @UseGuards(AuthGuard)
  async getCategories(
    @Query('shop_id') shopId: string,
  ): Promise<ApiResponse<CategoryResponseDto[]>> {
    const categories = await this.menuService.getCategories(shopId);
    return success(categories);
  }

  @Get('menu-items')
  @UseGuards(AuthGuard)
  async getMenuItems(
    @Query('shop_id') shopId: string,
    @Query('category_id') categoryId?: string,
  ): Promise<ApiResponse<MenuItemResponseDto[]>> {
    const items = await this.menuService.getMenuItems(shopId, categoryId);
    return success(items);
  }

  @Get('menu-items/:id')
  @UseGuards(AuthGuard)
  async getMenuItem(
    @Param('id') id: string,
  ): Promise<ApiResponse<MenuItemResponseDto>> {
    const item = await this.menuService.getMenuItemById(id);
    return success(item);
  }

  // ========== Admin API ==========

  @Post('categories')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async createCategory(
    @Body() dto: CreateCategoryDto,
  ): Promise<ApiResponse<CategoryResponseDto>> {
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
  async deleteCategory(
    @Param('id') id: string,
  ): Promise<ApiResponse<null>> {
    await this.menuService.deleteCategory(id);
    return success(null, '分类删除成功');
  }

  @Post('menu-items')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async createMenuItem(
    @Body() dto: CreateMenuItemDto,
  ): Promise<ApiResponse<MenuItemResponseDto>> {
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
  async deleteMenuItem(
    @Param('id') id: string,
  ): Promise<ApiResponse<null>> {
    await this.menuService.deleteMenuItem(id);
    return success(null, '菜品删除成功');
  }
}
