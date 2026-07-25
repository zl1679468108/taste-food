import { Module } from '@nestjs/common';
import { ShopController } from './shop.controller';
import { TableService } from './table.service';
import { ShopService } from './shop.service';

@Module({
  controllers: [ShopController],
  providers: [ShopService, TableService],
  exports: [ShopService, TableService],
})
export class ShopModule {}
