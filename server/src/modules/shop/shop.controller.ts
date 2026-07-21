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
import { CreateShopDto, UpdateShopDto, ShopResponseDto } from './dto/shop.dto';

@Controller('shops')
export class ShopController {
  constructor(private readonly shopService: ShopService) {}

  // ===== 公开接口（顾客浏览店铺无需登录）=====

  @Get()
  @Public()
  async getAllShops(): Promise<ApiResponse<ShopResponseDto[]>> {
    const shops = await this.shopService.findAll();
    return success(shops);
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
