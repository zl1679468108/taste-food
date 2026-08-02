import { Module } from '@nestjs/common';
import { ExportController } from './export.controller';
import { ExportService } from './export.service';
import { ExportRunnerService } from './export-runner.service';
import { OrderModule } from '../order/order.module';
import { StorageModule } from '../storage/storage.module';
// InboxModule 为 @Global()，InboxService 全局可用，无需在此导入

@Module({
  imports: [OrderModule, StorageModule],
  controllers: [ExportController],
  providers: [ExportService, ExportRunnerService],
  exports: [ExportService],
})
export class ExportModule {}
