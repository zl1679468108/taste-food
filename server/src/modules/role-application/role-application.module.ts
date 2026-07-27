import { Module } from '@nestjs/common';
import { RoleApplicationService } from './role-application.service';
import { RoleApplicationController } from './role-application.controller';

@Module({
  controllers: [RoleApplicationController],
  providers: [RoleApplicationService],
  exports: [RoleApplicationService],
})
export class RoleApplicationModule {}
