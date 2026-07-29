import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SHOP_ID } from '../src/common/constants/shop';
import { AuthService } from '../src/modules/auth/auth.service';
import { TokenService } from '../src/modules/auth/token.service';

function createAuthService() {
  return new AuthService(new TokenService());
}

test('demo merchant can switch to customer and back to merchant', async () => {
  const service = createAuthService();
  await service.ensureDemoMerchant();

  const login = await service.passwordLogin({
    username: 'merchant',
    password: 'merchant123',
  });
  assert.equal(login.role, 'merchant');
  assert.deepEqual(
    login.roles?.map((item) => item.role).sort(),
    ['customer', 'merchant'],
  );

  const customer = await service.switchRole(login.userId, 'customer');
  assert.equal(customer.role, 'customer');
  assert.equal(customer.shopId, undefined);
  assert.deepEqual(
    customer.roles?.map((item) => item.role).sort(),
    ['customer', 'merchant'],
  );

  const merchant = await service.switchRole(login.userId, 'merchant');
  assert.equal(merchant.role, 'merchant');
  assert.equal(merchant.shopId, DEFAULT_SHOP_ID);
});
