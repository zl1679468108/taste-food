import test from 'node:test';
import assert from 'node:assert/strict';
import { AuditService } from '../src/modules/audit/audit.service';

function createAuditInput(overrides: Partial<Parameters<AuditService['record']>[0]> = {}) {
  return {
    shopId: 'shop-audit-default',
    userId: 'admin-audit',
    role: 'admin',
    method: 'POST',
    path: '/api/orders/order-audit/status',
    action: 'POST orders',
    resource: 'orders',
    resourceId: 'order-audit',
    summary: 'POST /api/orders/order-audit/status status=accepted',
    statusCode: 200,
    ip: '127.0.0.1',
    ...overrides,
  };
}

test('record stores audit logs with normalized field lengths and newest-first order', async () => {
  const service = new AuditService();
  const shopId = `shop-audit-trim-${Date.now()}-${Math.random()}`;
  const longPath = `/api/orders/${'p'.repeat(400)}`;
  const longAction = `PATCH ${'a'.repeat(200)}`;
  const longSummary = `summary-${'s'.repeat(700)}`;

  await service.record(createAuditInput({
    shopId,
    method: 'POST',
    path: '/api/orders/first/status',
    action: 'POST first',
    resourceId: 'first',
    summary: 'first log',
  }));
  await service.record(createAuditInput({
    shopId,
    method: 'PATCH',
    path: longPath,
    action: longAction,
    resourceId: 'second',
    summary: longSummary,
    statusCode: 201,
    ip: '10.0.0.8',
  }));

  const result = await service.list({ shopId, page: 1, pageSize: 10 });

  assert.equal(result.total, 2);
  assert.equal(result.items[0].resourceId, 'second');
  assert.equal(result.items[0].method, 'PATCH');
  assert.equal(result.items[0].path.length, 300);
  assert.equal(result.items[0].action.length, 120);
  assert.equal(result.items[0].summary.length, 500);
  assert.equal(result.items[0].statusCode, 201);
  assert.equal(result.items[0].ip, '10.0.0.8');
  assert.equal(result.items[1].resourceId, 'first');
});

test('list filters by shop, method, and action with pagination', async () => {
  const service = new AuditService();
  const shopId = `shop-audit-filter-${Date.now()}-${Math.random()}`;
  const otherShopId = `${shopId}-other`;

  await service.record(createAuditInput({
    shopId,
    method: 'POST',
    action: 'POST orders',
    resourceId: 'order-create',
    summary: 'create order',
  }));
  await service.record(createAuditInput({
    shopId,
    method: 'PATCH',
    action: 'PATCH orders',
    resourceId: 'order-status',
    summary: 'update order',
  }));
  await service.record(createAuditInput({
    shopId,
    method: 'DELETE',
    action: 'DELETE menu-items',
    resource: 'menu-items',
    resourceId: 'menu-delete',
    summary: 'delete menu item',
  }));
  await service.record(createAuditInput({
    shopId: otherShopId,
    method: 'PATCH',
    action: 'PATCH orders',
    resourceId: 'other-shop-order',
    summary: 'other shop update',
  }));

  const filtered = await service.list({
    shopId,
    method: 'patch',
    action: 'orders',
    page: 1,
    pageSize: 1,
  });
  const secondPage = await service.list({
    shopId,
    action: 'orders',
    page: 2,
    pageSize: 1,
  });

  assert.equal(filtered.total, 1);
  assert.equal(filtered.page, 1);
  assert.equal(filtered.pageSize, 1);
  assert.equal(filtered.items.length, 1);
  assert.equal(filtered.items[0].resourceId, 'order-status');
  assert.equal(secondPage.total, 2);
  assert.equal(secondPage.items.length, 1);
  assert.equal(secondPage.items[0].shopId, shopId);
  assert.match(secondPage.items[0].action, /orders/i);
});

test('list clamps invalid page and pageSize inputs', async () => {
  const service = new AuditService();
  const shopId = `shop-audit-page-${Date.now()}-${Math.random()}`;

  await service.record(createAuditInput({
    shopId,
    method: 'POST',
    action: 'POST shops',
    resource: 'shops',
    resourceId: 'shop-update',
    summary: 'shop update',
  }));

  const result = await service.list({ shopId, page: -10, pageSize: 500 });

  assert.equal(result.page, 1);
  assert.equal(result.pageSize, 100);
  assert.equal(result.total, 1);
  assert.equal(result.items.length, 1);
});

test('record caps in-memory audit logs at the newest 2000 entries', async () => {
  const service = new AuditService();
  const shopId = `shop-audit-cap-${Date.now()}-${Math.random()}`;

  for (let i = 0; i < 2005; i += 1) {
    await service.record(createAuditInput({
      shopId,
      method: 'POST',
      action: 'POST capacity-check',
      resource: 'capacity-check',
      resourceId: `audit-${i}`,
      summary: `capacity ${i}`,
    }));
  }

  const firstPage = await service.list({ shopId, action: 'capacity-check', page: 1, pageSize: 100 });
  const lastPage = await service.list({ shopId, action: 'capacity-check', page: 20, pageSize: 100 });

  assert.equal(firstPage.total, 2000);
  assert.equal(firstPage.items[0].resourceId, 'audit-2004');
  assert.equal(firstPage.items[99].resourceId, 'audit-1905');
  assert.equal(lastPage.items.length, 100);
  assert.equal(lastPage.items[99].resourceId, 'audit-5');
});
