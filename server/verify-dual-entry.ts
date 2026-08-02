import { ForbiddenException } from '@nestjs/common';
import { ShopScopeGuard } from './src/common/guards/shop-scope.guard';
import {
  isPlatformAdmin,
  isShopOperator,
} from './src/common/utils/admin-shop-scope';

let failed = 0;
function check(name: string, cond: boolean) {
  if (cond) {
    console.log('  PASS', name);
  } else {
    failed++;
    console.error('  FAIL', name);
  }
}
function throwsForbidden(name: string, fn: () => void) {
  try {
    fn();
    failed++;
    console.error('  FAIL', name, '(应抛 Forbidden 但未抛)');
  } catch (e) {
    if (e instanceof ForbiddenException) console.log('  PASS', name);
    else {
      failed++;
      console.error('  FAIL', name, '(抛出非 Forbidden:', (e as Error).message, ')');
    }
  }
}

console.log('[helper] 角色判定');
check('平台管理员 = admin 且 shopId 空', isPlatformAdmin({ role: 'admin', shopId: undefined }));
check('admin+shopId 不是平台管理员', !isPlatformAdmin({ role: 'admin', shopId: 's1' }));
check('merchant 是商家', isShopOperator({ role: 'merchant', shopId: 's1' }));
check('admin+shopId 仍算商家(兜底)', isShopOperator({ role: 'admin', shopId: 's1' }));
check('customer 不是商家', !isShopOperator({ role: 'customer' }));

console.log('[guard] 执行上下文模拟');
const mockReflector = (scope: any) => ({ getAllAndOverride: () => scope }) as any;
const ctxWith = (user: any) =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  }) as any;

const guardPlatform = new ShopScopeGuard(mockReflector('platform'));
const guardMerchant = new ShopScopeGuard(mockReflector('merchant'));
const guardNone = new ShopScopeGuard(mockReflector(undefined));

check('@PlatformOnly 放行纯平台 admin', guardPlatform.canActivate(ctxWith({ role: 'admin', shopId: undefined })) === true);
throwsForbidden('@PlatformOnly 拒绝 admin+shopId 二义账号', () =>
  guardPlatform.canActivate(ctxWith({ role: 'admin', shopId: 's1' })),
);
throwsForbidden('@PlatformOnly 拒绝 merchant', () =>
  guardPlatform.canActivate(ctxWith({ role: 'merchant', shopId: 's1' })),
);
check('@MerchantOnly 放行 merchant', guardMerchant.canActivate(ctxWith({ role: 'merchant', shopId: 's1' })) === true);
check('@MerchantOnly 放行 admin+shopId', guardMerchant.canActivate(ctxWith({ role: 'admin', shopId: 's1' })) === true);
throwsForbidden('@MerchantOnly 拒绝纯平台 admin', () =>
  guardMerchant.canActivate(ctxWith({ role: 'admin', shopId: undefined })),
);
check('无 scope 装饰器默认放行(向后兼容)', guardNone.canActivate(ctxWith({ role: 'customer' })) === true);

if (failed > 0) {
  console.error(`\n验证失败：${failed} 项`);
  process.exit(1);
}
console.log('\n全部通过 ✅ 双入口隔离逻辑正确');
