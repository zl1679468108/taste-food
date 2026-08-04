import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { CustomerController } from './customer.controller';
import { CustomerService } from './customer.service';
import { MessageController } from './message.controller';
import { MessageService } from './message.service';

@Module({
  controllers: [UserController, CustomerController, MessageController],
  providers: [UserService, CustomerService, MessageService],
  exports: [UserService, CustomerService, MessageService],
})
export class UserModule {}
