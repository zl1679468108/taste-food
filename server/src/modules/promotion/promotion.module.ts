import { Module } from '@nestjs/common';
import {
  PromotionController,
  MerchantPromotionController,
} from './promotion.controller';
import { PromotionService } from './promotion.service';

@Module({
  imports: [],
  controllers: [PromotionController, MerchantPromotionController],
  providers: [PromotionService],
  exports: [PromotionService],
})
export class PromotionModule {}
