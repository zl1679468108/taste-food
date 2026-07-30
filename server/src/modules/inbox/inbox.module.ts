import { Module, Global } from '@nestjs/common';
import { InboxService } from './inbox.service';
import { InboxController } from './inbox.controller';
import { OrderModule } from '../order/order.module';

@Global()
@Module({
  imports: [OrderModule],
  controllers: [InboxController],
  providers: [InboxService],
  exports: [InboxService],
})
export class InboxModule {}
