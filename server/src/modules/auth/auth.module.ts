import { Module, Global } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { AuthGuard } from '../../common/guards/auth.guard';

@Global()
@Module({
  controllers: [AuthController],
  providers: [AuthService, TokenService, AuthGuard],
  exports: [AuthService, TokenService, AuthGuard],
})
export class AuthModule {}
