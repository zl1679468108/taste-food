import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { TableService } from '../src/modules/shop/table.service';

function uniqueShopId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random()}`;
}

test('seed creates default tables and scan paths once per shop', async () => {
  const service = new TableService();
  const shopId = uniqueShopId('shop-table-seed');

  const seeded = await service.seed(shopId);
  const seededAgain = await service.seed(shopId);

  assert.equal(seeded.length, 10);
  assert.equal(seededAgain.length, 10);
  assert.deepEqual(seeded.map((t) => t.tableNo), [
    'A01',
    'A02',
    'A03',
    'A04',
    'A05',
    'A06',
    'A07',
    'A08',
    'A09',
    'A10',
  ]);
  assert.equal(seeded[0].label, 'A01 桌');
  assert.equal(seeded[0].sortOrder, 1);
  assert.equal(seeded[0].active, true);
  assert.match(seeded[0].scanPath, /^pages\/menu\/index\?/);
  assert.match(seeded[0].scanPath, new RegExp(`shopId=${encodeURIComponent(shopId)}`));
  assert.match(seeded[0].scanPath, /tableNo=A01/);
  assert.match(seeded[0].scanPath, /dineIn=1/);
  assert.deepEqual(
    seededAgain.map((t) => t.id).sort(),
    seeded.map((t) => t.id).sort(),
  );
});

test('create trims fields, sorts tables, and filters inactive tables', async () => {
  const service = new TableService();
  const shopId = uniqueShopId('shop-table-create');

  const inactive = await service.create(shopId, {
    tableNo: '  B02  ',
    label: '  靠窗  ',
    sortOrder: 0,
    active: false,
  });
  const active = await service.create(shopId, {
    tableNo: 'B01',
    label: '门口',
    sortOrder: 0,
  });

  const visible = await service.list(shopId);
  const all = await service.list(shopId, { includeInactive: true });

  assert.equal(inactive.tableNo, 'B02');
  assert.equal(inactive.label, '靠窗');
  assert.equal(inactive.active, false);
  assert.equal(active.active, true);
  assert.equal(visible.some((t) => t.id === inactive.id), false);
  assert.equal(visible.some((t) => t.id === active.id), true);
  assert.equal(all.some((t) => t.id === inactive.id), true);
  assert.deepEqual(
    all.filter((t) => t.tableNo.startsWith('B')).map((t) => t.tableNo),
    ['B01', 'B02'],
  );
});

test('create rejects blank and duplicate table numbers within the same shop', async () => {
  const service = new TableService();
  const shopId = uniqueShopId('shop-table-duplicate');
  const otherShopId = uniqueShopId('shop-table-duplicate-other');

  await service.create(shopId, { tableNo: 'C01' });
  await service.create(otherShopId, { tableNo: 'C01' });

  await assert.rejects(
    () => service.create(shopId, { tableNo: '   ' }),
    (error: unknown) =>
      error instanceof BadRequestException &&
      error.message === '桌号不能为空',
  );
  await assert.rejects(
    () => service.create(shopId, { tableNo: 'c01' }),
    (error: unknown) =>
      error instanceof ConflictException &&
      error.message === '桌号已存在',
  );
});

test('update changes table fields and rejects invalid table numbers', async () => {
  const service = new TableService();
  const shopId = uniqueShopId('shop-table-update');
  const first = await service.create(shopId, { tableNo: 'D01', sortOrder: 10 });
  await service.create(shopId, { tableNo: 'D02', sortOrder: 20 });

  const updated = await service.update(shopId, first.id, {
    tableNo: '  D03  ',
    label: '  包间  ',
    sortOrder: 1,
    active: false,
  });

  assert.equal(updated.tableNo, 'D03');
  assert.equal(updated.label, '包间');
  assert.equal(updated.sortOrder, 1);
  assert.equal(updated.active, false);
  assert.match(updated.scanPath, /tableNo=D03/);

  await assert.rejects(
    () => service.update(shopId, first.id, { tableNo: '   ' }),
    (error: unknown) =>
      error instanceof BadRequestException &&
      error.message === '桌号不能为空',
  );
  await assert.rejects(
    () => service.update(shopId, first.id, { tableNo: 'd02' }),
    (error: unknown) =>
      error instanceof ConflictException &&
      error.message === '桌号已存在',
  );
});

test('update and remove enforce shop ownership and deletion semantics', async () => {
  const service = new TableService();
  const shopId = uniqueShopId('shop-table-remove');
  const otherShopId = uniqueShopId('shop-table-remove-other');
  const table = await service.create(shopId, { tableNo: 'E01' });

  await assert.rejects(
    () => service.update(otherShopId, table.id, { label: '越权' }),
    (error: unknown) =>
      error instanceof NotFoundException &&
      error.message === '桌台不存在',
  );
  await assert.rejects(
    () => service.remove(otherShopId, table.id),
    (error: unknown) =>
      error instanceof NotFoundException &&
      error.message === '桌台不存在',
  );

  await service.remove(shopId, table.id);
  const all = await service.list(shopId, { includeInactive: true });

  assert.equal(all.some((t) => t.id === table.id), false);
  await assert.rejects(
    () => service.remove(shopId, table.id),
    (error: unknown) =>
      error instanceof NotFoundException &&
      error.message === '桌台不存在',
  );
});
