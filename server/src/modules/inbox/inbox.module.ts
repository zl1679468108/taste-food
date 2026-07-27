import { Module, Global } from '@nestjs/common';
import { InboxService } from './inbox.service';
import { InboxController } from './inbox.controller';

@Global()
@Module({
  controllers: [InboxController],
  providers: [InboxService],
  exports: [InboxService],
})
export class InboxModule {}
