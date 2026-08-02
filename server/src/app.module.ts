import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { AuthGuard } from './common/guards/auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { ShopScopeGuard } from './common/guards/shop-scope.guard';
import { ShopModule } from './modules/shop/shop.module';
import { MenuModule } from './modules/menu/menu.module';
import { OrderModule } from './modules/order/order.module';
import { PaymentModule } from './modules/payment/payment.module';
import { AuthModule } from './modules/auth/auth.module';
import { StorageModule } from './modules/storage/storage.module';
import { UserModule } from './modules/user/user.module';
import { FavoritesModule } from './modules/favorites/favorites.module';
import { AddressModule } from './modules/address/address.module';
import { HealthModule } from './modules/health/health.module';
import { ReviewModule } from './modules/review/review.module';
import { AuditModule } from './modules/audit/audit.module';
import { RoleApplicationModule } from './modules/role-application/role-application.module';
import { InboxModule } from './modules/inbox/inbox.module';
import { ExportModule } from './modules/export/export.module';

@Module({
  imports: [
    AuthModule, ShopModule, MenuModule, OrderModule,
    PaymentModule, StorageModule, UserModule,
    FavoritesModule, AddressModule, HealthModule, ReviewModule, AuditModule, RoleApplicationModule, InboxModule, ExportModule,
  ],
  controllers: [],
  providers: [
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    // 全局 ValidationPipe（替代 main.ts 中的 useGlobalPipes，便于单元测试）
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    },
    // 全局 AuthGuard：所有未标 @Public() 的接口都需认证
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    // 全局 ShopScopeGuard：双入口隔离骨架（deny-by-default，仅 @PlatformOnly/@MerchantOnly 标记的接口受限）
    { provide: APP_GUARD, useClass: ShopScopeGuard },
  ],
})
export class AppModule {}
