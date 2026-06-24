import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/constants/enums';
import { success, ApiResponse } from '../../common/interfaces/api-response.interface';
import { ShopService } from './shop.service';
import { CreateShopDto, UpdateShopDto, ShopResponseDto } from './dto/shop.dto';

@Controller('shops')
export class ShopController {
  constructor(private readonly shopService: ShopService) {}

  @Get()
  async getAllShops(): Promise<ApiResponse<ShopResponseDto[]>> {
    const shops = await this.shopService.findAll();
    return success(shops);
  }

  @Get(':id')
  async getShop(@Param('id') id: string): Promise<ApiResponse<ShopResponseDto>> {
    const shop = await this.shopService.findById(id);
    return success(shop);
  }

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async createShop(@Body() dto: CreateShopDto): Promise<ApiResponse<ShopResponseDto>> {
    const shop = await this.shopService.create(dto);
    return success(shop, '店铺创建成功');
  }

  @Patch(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async updateShop(
    @Param('id') id: string,
    @Body() dto: UpdateShopDto,
  ): Promise<ApiResponse<ShopResponseDto>> {
    const shop = await this.shopService.update(id, dto);
    return success(shop, '店铺更新成功');
  }

  @Patch(':id/status')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async toggleShopStatus(
    @Param('id') id: string,
  ): Promise<ApiResponse<ShopResponseDto>> {
    const shop = await this.shopService.toggleStatus(id);
    return success(shop, '营业状态已更新');
  }

  @Delete(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async deleteShop(@Param('id') id: string): Promise<ApiResponse<null>> {
    await this.shopService.delete(id);
    return success(null, '店铺删除成功');
  }
}
