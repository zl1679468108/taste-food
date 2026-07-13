import { Module, forwardRef } from '@nestjs/common';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { OrderGateway } from './order.gateway';
import { PromotionModule } from '../promotion/promotion.module';
import { ShopModule } from '../shop/shop.module';
import { MenuModule } from '../menu/menu.module';

@Module({
  imports: [PromotionModule, ShopModule, forwardRef(() => MenuModule)],
  controllers: [OrderController],
  providers: [OrderService, OrderGateway],
  exports: [OrderService, OrderGateway],
})
export class OrderModule {}
