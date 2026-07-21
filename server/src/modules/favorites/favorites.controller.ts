import { Controller, Get, Post, Delete, Param, Body } from '@nestjs/common';
import { success, ApiResponse } from '../../common/interfaces/api-response.interface';
import { FavoritesService, FavoriteWithMenuItem } from './favorites.service';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { ToggleFavoriteDto } from './dto/toggle-favorite.dto';

/**
 * 收藏控制器：统一的收藏资源入口。
 * - GET /favorites         列表
 * - GET /favorites/check/:menuItemId   检查是否已收藏
 * - POST /favorites/toggle 切换收藏状态
 * - DELETE /favorites/:menuItemId      取消收藏
 */
@Controller('favorites')
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Get()
  async getFavorites(
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<ApiResponse<FavoriteWithMenuItem[]>> {
    const favorites = await this.favoritesService.findByUserId(user.userId);
    return success(favorites);
  }

  @Get('check/:menuItemId')
  async checkFavorite(
    @CurrentUser() user: CurrentUserPayload,
    @Param('menuItemId') menuItemId: string,
  ): Promise<ApiResponse<{ isFavorite: boolean }>> {
    const isFavorite = await this.favoritesService.checkFavorite(user.userId, menuItemId);
    return success({ isFavorite });
  }

  @Post('toggle')
  async toggleFavorite(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: ToggleFavoriteDto,
  ): Promise<ApiResponse<{ isFavorite: boolean }>> {
    const result = await this.favoritesService.toggleFavorite(
      user.userId,
      body.menuItemId,
      body.shopId,
    );
    return success(result);
  }

  @Delete(':menuItemId')
  async removeFavorite(
    @CurrentUser() user: CurrentUserPayload,
    @Param('menuItemId') menuItemId: string,
  ): Promise<ApiResponse<null>> {
    await this.favoritesService.removeFavorite(user.userId, menuItemId);
    return success(null, '取消收藏成功');
  }
}
