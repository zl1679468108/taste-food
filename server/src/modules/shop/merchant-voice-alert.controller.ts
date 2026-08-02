import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  ForbiddenException,
} from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { MerchantOnly } from '../../common/decorators/shop-scope.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/constants/enums';
import { success, ApiResponse } from '../../common/interfaces/api-response.interface';
import { ShopService } from './shop.service';
import { UpdateVoiceAlertConfigDto, VoiceAlertConfig } from './dto/voice-alert-config.dto';

/**
 * 商家语音播报配置（T308）。
 * 落在 /api/merchant/shops/:id/voice-alert-config：仅商家后台使用，
 * 与顾客侧公开接口隔离；config 持久化到 tf_shops.voice_alert_config（跨设备/换浏览器不丢失）。
 */
@Controller('merchant/shops/:id/voice-alert-config')
@Roles(UserRole.ADMIN, UserRole.MERCHANT)
@MerchantOnly()
export class MerchantVoiceAlertController {
  constructor(private readonly shopService: ShopService) {}

  /** 商家只能操作自己绑定的店铺 */
  private assertOwnShop(shopId: string, userShopId?: string): void {
    if (userShopId && shopId !== userShopId) {
      throw new ForbiddenException('无权操作其他店铺语音播报配置');
    }
  }

  @Get()
  async getConfig(
    @Param('id') id: string,
    @CurrentUser('shopId') userShopId?: string,
  ): Promise<ApiResponse<VoiceAlertConfig>> {
    this.assertOwnShop(id, userShopId);
    const config = await this.shopService.getVoiceAlertConfig(id);
    return success(config);
  }

  @Put()
  async updateConfig(
    @Param('id') id: string,
    @Body() dto: UpdateVoiceAlertConfigDto,
    @CurrentUser('shopId') userShopId?: string,
  ): Promise<ApiResponse<VoiceAlertConfig>> {
    this.assertOwnShop(id, userShopId);
    const config = await this.shopService.updateVoiceAlertConfig(id, dto);
    return success(config, '语音播报设置已保存');
  }
}
