import { Controller, Get, Post, Delete, Param, Body, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { success, ApiResponse } from '../../common/interfaces/api-response.interface';
import { FavoritesService, FavoriteWithMenuItem } from './favorites.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentUserPayload } from '../../common/decorators/current-user.decorator';

@Controller('favorites')
@UseGuards(AuthGuard)
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
    @Body() body: { menuItemId: string; shopId: string },
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
