import { Module } from '@nestjs/common';
import { ShopController } from './shop.controller';
import { MerchantTableController } from './merchant-table.controller';
import { MerchantVoiceAlertController } from './merchant-voice-alert.controller';
import { TableService } from './table.service';
import { ShopService } from './shop.service';

@Module({
  controllers: [ShopController, MerchantTableController, MerchantVoiceAlertController],
  providers: [ShopService, TableService],
  exports: [ShopService, TableService],
})
export class ShopModule {}
