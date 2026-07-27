import test from 'node:test';
import assert from 'node:assert/strict';

import { createInitialState } from '../src/queue.js';
import {
  closeShift,
  forceCloseShift,
  inventorySummary,
  openShift,
  recordInventoryMovement,
  recordOperationalEntry,
} from '../src/operations.js';

const NOW = '2026-07-27T01:00:00.000Z';

function actor() {
  return {
    employeeId: 'employee-1',
    employeeName: 'Anisa',
  };
}

test('opens one employee shift and blocks overlapping or stale shifts', () => {
  const opened = openShift(createInitialState(), {
    label: 'Pagi',
    openingCash: 100_000,
    ...actor(),
  }, NOW);

  assert.equal(opened.shift.status, 'open');
  assert.equal(opened.shift.businessDate, '2026-07-27');
  assert.equal(opened.shift.openingCash, 100_000);
  assert.equal(opened.shift.employeeName, 'Anisa');
  assert.throws(
    () => openShift(opened.state, { label: 'Siang', openingCash: 0, ...actor() }, NOW),
    /shift aktif/i,
  );

  const staleState = structuredClone(opened.state);
  staleState.shifts[0].businessDate = '2026-07-26';
  assert.throws(
    () => openShift(staleState, { label: 'Pagi', openingCash: 0, ...actor() }, NOW),
    /shift sebelumnya belum ditutup/i,
  );
});

test('closes a shift using cash sales and operational cash movements', () => {
  let { state, shift } = openShift(createInitialState(), {
    label: 'Pagi',
    openingCash: 100_000,
    ...actor(),
  }, NOW);
  state.orders = [
    { id: 'cash-paid', shiftId: shift.id, businessDate: shift.businessDate, paymentStatus: 'paid', paymentMethod: 'cash', status: 'completed', grandTotal: 50_000 },
    { id: 'qris-paid', shiftId: shift.id, businessDate: shift.businessDate, paymentStatus: 'paid', paymentMethod: 'QRIS', status: 'completed', grandTotal: 20_000 },
    { id: 'cash-cancelled', shiftId: shift.id, businessDate: shift.businessDate, paymentStatus: 'void', paymentMethod: 'cash', status: 'cancelled', grandTotal: 10_000 },
  ];
  ({ state } = recordOperationalEntry(state, {
    type: 'cash-in',
    amount: 10_000,
    category: 'Tambahan modal',
    note: 'Uang kecil',
    shiftId: shift.id,
    actorType: 'employee',
    actorId: actor().employeeId,
    actorName: actor().employeeName,
  }, NOW));
  ({ state } = recordOperationalEntry(state, {
    type: 'expense',
    amount: 5_000,
    category: 'Transportasi',
    note: 'Parkir',
    shiftId: shift.id,
    actorType: 'employee',
    actorId: actor().employeeId,
    actorName: actor().employeeName,
  }, NOW));
  ({ state } = recordOperationalEntry(state, {
    type: 'deposit',
    amount: 20_000,
    category: 'Setoran',
    note: 'Setor ke Mitra',
    shiftId: shift.id,
    actorType: 'employee',
    actorId: actor().employeeId,
    actorName: actor().employeeName,
  }, NOW));

  assert.throws(
    () => closeShift(state, shift.id, {
      actualCash: 130_000,
      employeeId: actor().employeeId,
      employeeName: actor().employeeName,
    }, NOW),
    /alasan selisih/i,
  );

  const closed = closeShift(state, shift.id, {
    actualCash: 130_000,
    reason: 'Kurang Rp5.000 saat hitung fisik',
    employeeId: actor().employeeId,
    employeeName: actor().employeeName,
  }, NOW);

  assert.equal(closed.shift.expectedCash, 135_000);
  assert.equal(closed.shift.actualCash, 130_000);
  assert.equal(closed.shift.variance, -5_000);
  assert.equal(closed.shift.cashSales, 50_000);
  assert.equal(closed.shift.status, 'closed');
});

test('force closes a stale shift with Mitra or Owner reason', () => {
  const opened = openShift(createInitialState(), {
    label: 'Siang-Malam',
    openingCash: 50_000,
    ...actor(),
  }, '2026-07-26T08:00:00.000Z');

  assert.throws(
    () => forceCloseShift(opened.state, opened.shift.id, {
      actualCash: 50_000,
      actorType: 'partner',
      actorId: 'partner-1',
      actorName: 'Mitra Jepara',
    }, NOW),
    /alasan override/i,
  );

  const closed = forceCloseShift(opened.state, opened.shift.id, {
    actualCash: 50_000,
    reason: 'Karyawan lupa tutup shift',
    actorType: 'partner',
    actorId: 'partner-1',
    actorName: 'Mitra Jepara',
  }, NOW);
  assert.equal(closed.shift.status, 'forced-closed');
  assert.equal(closed.shift.closedBy.id, 'partner-1');
  assert.equal(closed.shift.closeReason, 'Karyawan lupa tutup shift');
});

test('records cup movements and compares manual use with sales expectation', () => {
  let state = createInitialState();
  state.orders = [{
    id: 'order-1',
    businessDate: '2026-07-27',
    status: 'completed',
    paymentStatus: 'paid',
    items: [
      { productId: 'latte', quantity: 2, cupUsage: 1 },
      { productId: 'snack', quantity: 1, cupUsage: 0 },
    ],
  }];
  const base = {
    actorType: 'employee',
    actorId: actor().employeeId,
    actorName: actor().employeeName,
  };
  ({ state } = recordInventoryMovement(state, { type: 'received', quantity: 100, reason: 'Setoran Owner', ...base }, NOW));
  ({ state } = recordInventoryMovement(state, { type: 'used', quantity: 3, reason: 'Pemakaian shift', ...base }, NOW));
  ({ state } = recordInventoryMovement(state, { type: 'damaged', quantity: 1, reason: 'Cup pecah', ...base }, NOW));

  const summary = inventorySummary(state, '2026-07-27');
  assert.equal(summary.received, 100);
  assert.equal(summary.used, 3);
  assert.equal(summary.damaged, 1);
  assert.equal(summary.balance, 96);
  assert.equal(summary.expectedUsedFromSales, 2);
  assert.equal(summary.usageVariance, 1);
});

test('rejects unsafe operational and inventory values', () => {
  const opened = openShift(createInitialState(), {
    label: 'Pagi',
    openingCash: 0,
    ...actor(),
  }, NOW);
  assert.throws(
    () => recordOperationalEntry(opened.state, {
      type: 'expense',
      amount: -1,
      category: 'Lainnya',
      note: 'Tidak valid',
      shiftId: opened.shift.id,
      actorType: 'employee',
      actorId: actor().employeeId,
      actorName: actor().employeeName,
    }, NOW),
    /nominal/i,
  );
  assert.throws(
    () => recordInventoryMovement(opened.state, {
      type: 'damaged',
      quantity: 1,
      actorType: 'employee',
      actorId: actor().employeeId,
      actorName: actor().employeeName,
    }, NOW),
    /alasan/i,
  );
});
