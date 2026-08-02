/**
 * T301 角色-店铺写时不变量回归测试
 *
 * 背景：历史上产生过 role=admin 且 shop_id 非空的「二义账号」，
 * 它同时满足 isPlatformAdmin 的 role 判定和 isShopOperator 的绑店判定，
 * 会让 ShopScopeGuard 的作用域裁决出现歧义，存在越权风险。
 * 存量数据已由 migration v29 归并为 merchant，本测试守住写入路径不再回流。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertRoleShopInvariant,
  normalizeShopIdForRole,
  isPlatformAdmin,
  isShopOperator,
} from '../src/common/utils/admin-shop-scope';
import { UserService } from '../src/modules/user/user.service';

const SHOP_ID = '11111111-1111-1111-1111-111111111111';

/* -------------------------------------------------------------------------- */
/* 不变量本体                                                                  */
/* -------------------------------------------------------------------------- */

test('assertRoleShopInvariant 拒绝 admin + shopId 二义账号', () => {
  assert.throws(
    () => assertRoleShopInvariant('admin', SHOP_ID),
    /平台管理员.*不可绑定店铺/,
  );
  // 空白字符串不算绑定，不应误伤
  assert.doesNotThrow(() => assertRoleShopInvariant('admin', '   '));
});

test('assertRoleShopInvariant 拒绝无店铺的 merchant', () => {
  assert.throws(() => assertRoleShopInvariant('merchant', undefined), /必须绑定店铺/);
  assert.throws(() => assertRoleShopInvariant('merchant', null), /必须绑定店铺/);
  assert.throws(() => assertRoleShopInvariant('merchant', ''), /必须绑定店铺/);
});

test('assertRoleShopInvariant 放行所有合法组合', () => {
  assert.doesNotThrow(() => assertRoleShopInvariant('admin', null));
  assert.doesNotThrow(() => assertRoleShopInvariant('admin', undefined));
  assert.doesNotThrow(() => assertRoleShopInvariant('merchant', SHOP_ID));
  assert.doesNotThrow(() => assertRoleShopInvariant('customer', null));
  assert.doesNotThrow(() => assertRoleShopInvariant('rider', SHOP_ID));
  assert.doesNotThrow(() => assertRoleShopInvariant('rider', null));
});

test('normalizeShopIdForRole 对 admin 一律清空店铺', () => {
  assert.equal(normalizeShopIdForRole('admin', SHOP_ID), null);
  assert.equal(normalizeShopIdForRole('admin', null), null);
  assert.equal(normalizeShopIdForRole('merchant', SHOP_ID), SHOP_ID);
  assert.equal(normalizeShopIdForRole('merchant', `  ${SHOP_ID}  `), SHOP_ID);
  assert.equal(normalizeShopIdForRole('customer', ''), null);
  assert.equal(normalizeShopIdForRole('rider', SHOP_ID), SHOP_ID);
});

/* -------------------------------------------------------------------------- */
/* 与 ShopScopeGuard 判定的一致性                                              */
/* -------------------------------------------------------------------------- */

test('规范化后的账号在作用域判定上不再二义', () => {
  // 二义账号的真实危害：朴素角色判定与作用域判定结论相反。
  // @Roles(UserRole.ADMIN) 及各处 `role === 'admin'` 会把它当平台管理员放行，
  // 而 isPlatformAdmin/isShopOperator 却把它当商家 —— 两套裁决打架。
  const ambiguous = { role: 'admin', shopId: SHOP_ID };
  assert.equal(ambiguous.role === 'admin', true, '朴素角色判定：视为平台管理员');
  assert.equal(isPlatformAdmin(ambiguous), false, '作用域判定：不视为平台管理员');
  assert.equal(isShopOperator(ambiguous), true, '作用域判定：视为商家');

  // 经写时防御后，admin 的 shopId 必为空，两套判定结论一致
  const normalized = {
    role: 'admin',
    shopId: normalizeShopIdForRole('admin', SHOP_ID),
  };
  assert.equal(normalized.role === 'admin', true);
  assert.equal(isPlatformAdmin(normalized), true);
  assert.equal(isShopOperator(normalized), false);

  const merchant = { role: 'merchant', shopId: SHOP_ID };
  assert.equal(isPlatformAdmin(merchant), false);
  assert.equal(isShopOperator(merchant), true);
});

/* -------------------------------------------------------------------------- */
/* UserService.createUser 接入验证                                             */
/* -------------------------------------------------------------------------- */

test('createUser 在落库前就拒绝 admin + shopId', async () => {
  const service = new UserService();
  await assert.rejects(
    () => service.createUser({ nickName: '越权管理员', role: 'admin', shopId: SHOP_ID } as any),
    /平台管理员.*不可绑定店铺/,
  );
});

test('createUser 拒绝无店铺的 merchant', async () => {
  const service = new UserService();
  await assert.rejects(
    () => service.createUser({ nickName: '野商家', role: 'merchant' } as any),
    /必须绑定店铺/,
  );
});

test('createUser 对合法入参放行至数据库阶段（不被不变量拦截）', async () => {
  const service = new UserService();
  // 测试环境无 Supabase：能走到「数据库未配置」即证明不变量已放行
  await assert.rejects(
    () => service.createUser({ nickName: '平台管理员', role: 'admin' } as any),
    /数据库未配置/,
  );
  await assert.rejects(
    () => service.createUser({ nickName: '正常商家', role: 'merchant', shopId: SHOP_ID } as any),
    /数据库未配置/,
  );
});

test('createUser 仍禁止商家账号创建用户', async () => {
  const service = new UserService();
  await assert.rejects(
    () => service.createUser({ nickName: 'x', role: 'customer' } as any, SHOP_ID),
    /仅平台管理员可创建用户账号/,
  );
});
