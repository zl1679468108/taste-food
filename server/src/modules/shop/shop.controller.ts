import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { success, ApiResponse } from '../../common/interfaces/api-response.interface';
import { ShopService } from './shop.service';
import { ShopResponseDto } from './dto/shop.dto';

@Controller('shops')
export class ShopController {
  constructor(private readonly shopService: ShopService) {}

  @Get(':id')
  @UseGuards(AuthGuard)
  async getShop(@Param('id') id: string): Promise<ApiResponse<ShopResponseDto>> {
    const shop = await this.shopService.findById(id);
    return success(shop);
  }

  @Get()
  @UseGuards(AuthGuard)
  async getAllShops(): Promise<ApiResponse<ShopResponseDto[]>> {
    const shops = await this.shopService.findAll();
    return success(shops);
  }
}
