import { randomUUID } from 'node:crypto';

const ENTRY_TYPES = new Set(['cash-in', 'cash-out', 'deposit', 'expense']);
const INVENTORY_TYPES = new Set(['received', 'used', 'damaged', 'lost', 'returned', 'adjustment']);
const REASON_REQUIRED_TYPES = new Set(['damaged', 'lost', 'adjustment']);
const MAX_MONEY = 1_000_000_000_000;
const MAX_QUANTITY = 1_000_000;

function clone(value) {
  return structuredClone(value);
}

function jakartaDate(now) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(now));
}

function text(value, label, maxLength = 200) {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw new Error(`${label} wajib diisi`);
  if (normalized.length > maxLength) throw new Error(`${label} maksimal ${maxLength} karakter`);
  return normalized;
}

function optionalText(value, label, maxLength = 300) {
  if (value === undefined || value === null || String(value).trim() === '') return '';
  return text(value, label, maxLength);
}

function money(value, label) {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_MONEY) {
    throw new Error(`${label} harus nominal bulat antara 0 dan ${MAX_MONEY}`);
  }
  return value;
}

function quantity(value, { allowNegative = false } = {}) {
  const minimum = allowNegative ? -MAX_QUANTITY : 1;
  if (!Number.isSafeInteger(value) || value < minimum || value > MAX_QUANTITY || value === 0) {
    throw new Error(`Jumlah cup harus bilangan bulat ${allowNegative ? 'bukan nol ' : ''}dalam batas aman`);
  }
  return value;
}

function changed(state) {
  state.revision = (state.revision ?? 0) + 1;
  return state;
}

function findShift(state, shiftId) {
  const shift = (state.shifts ?? []).find((candidate) => candidate.id === shiftId);
  if (!shift) throw new Error('Shift tidak ditemukan');
  return shift;
}

function paidCashSales(state, shiftId) {
  return (state.orders ?? [])
    .filter((order) => (
      order.shiftId === shiftId
      && order.paymentMethod === 'cash'
      && order.paymentStatus !== 'void'
      && order.status !== 'cancelled'
    ))
    .reduce((sum, order) => sum + (order.grandTotal ?? order.total ?? 0), 0);
}

function shiftCashMovements(state, shiftId) {
  return (state.operationalEntries ?? [])
    .filter((entry) => entry.shiftId === shiftId)
    .reduce((summary, entry) => {
      if (entry.type === 'cash-in') summary.cashIn += entry.amount;
      if (entry.type === 'cash-out') summary.cashOut += entry.amount;
      if (entry.type === 'deposit') summary.deposits += entry.amount;
      if (entry.type === 'expense') summary.expenses += entry.amount;
      return summary;
    }, { cashIn: 0, cashOut: 0, deposits: 0, expenses: 0 });
}

function closeShiftInternal(currentState, shiftId, input, now, forced) {
  const state = clone(currentState);
  const shift = findShift(state, shiftId);
  if (shift.status !== 'open') throw new Error('Shift ini sudah ditutup');

  const actualCash = money(input?.actualCash, 'Kas fisik');
  const reason = optionalText(input?.reason, forced ? 'Alasan override' : 'Alasan selisih');
  if (forced && !reason) throw new Error('Alasan override wajib diisi');
  if (!forced && String(input?.employeeId ?? '') !== shift.employeeId) {
    throw new Error('Karyawan hanya boleh menutup shift miliknya sendiri');
  }

  const cashSales = paidCashSales(state, shift.id);
  const movements = shiftCashMovements(state, shift.id);
  const expectedCash = shift.openingCash
    + cashSales
    + movements.cashIn
    - movements.cashOut
    - movements.expenses
    - movements.deposits;
  const variance = actualCash - expectedCash;
  if (variance !== 0 && !reason) throw new Error('Alasan selisih wajib diisi');

  const closedBy = forced
    ? {
        type: text(input?.actorType, 'Tipe aktor', 30),
        id: text(input?.actorId, 'ID aktor', 100),
        name: text(input?.actorName, 'Nama aktor', 120),
      }
    : {
        type: 'employee',
        id: shift.employeeId,
        name: shift.employeeName,
      };
  Object.assign(shift, {
    status: forced ? 'forced-closed' : 'closed',
    closedAt: now,
    actualCash,
    expectedCash,
    variance,
    cashSales,
    cashIn: movements.cashIn,
    cashOut: movements.cashOut,
    deposits: movements.deposits,
    expenses: movements.expenses,
    closeReason: reason,
    closedBy,
  });
  return { state: changed(state), shift };
}

export function openShift(currentState, input, now = new Date().toISOString()) {
  const state = clone(currentState);
  state.shifts ??= [];
  const active = state.shifts.find((shift) => shift.status === 'open');
  if (active) {
    if (active.businessDate !== jakartaDate(now)) throw new Error('Shift sebelumnya belum ditutup');
    throw new Error('Masih ada shift aktif');
  }

  const shift = {
    id: randomUUID(),
    label: text(input?.label, 'Nama shift', 60),
    businessDate: jakartaDate(now),
    openingCash: money(input?.openingCash, 'Saldo awal'),
    employeeId: text(input?.employeeId, 'ID karyawan', 100),
    employeeName: text(input?.employeeName, 'Nama karyawan', 120),
    status: 'open',
    openedAt: now,
  };
  state.shifts.push(shift);
  return { state: changed(state), shift };
}

export function closeShift(currentState, shiftId, input, now = new Date().toISOString()) {
  return closeShiftInternal(currentState, shiftId, input, now, false);
}

export function forceCloseShift(currentState, shiftId, input, now = new Date().toISOString()) {
  return closeShiftInternal(currentState, shiftId, input, now, true);
}

export function recordOperationalEntry(currentState, input, now = new Date().toISOString()) {
  const state = clone(currentState);
  state.operationalEntries ??= [];
  const type = String(input?.type ?? '');
  if (!ENTRY_TYPES.has(type)) throw new Error('Tipe transaksi operasional tidak valid');
  const shift = findShift(state, text(input?.shiftId, 'Shift', 100));
  if (shift.status !== 'open') throw new Error('Transaksi operasional hanya bisa dicatat pada shift aktif');
  const entry = {
    id: randomUUID(),
    type,
    amount: money(input?.amount, 'Nominal'),
    category: text(input?.category, 'Kategori', 80),
    note: text(input?.note, 'Keterangan', 300),
    shiftId: shift.id,
    businessDate: shift.businessDate,
    actor: {
      type: text(input?.actorType, 'Tipe aktor', 30),
      id: text(input?.actorId, 'ID aktor', 100),
      name: text(input?.actorName, 'Nama aktor', 120),
    },
    createdAt: now,
  };
  state.operationalEntries.push(entry);
  return { state: changed(state), entry };
}

export function recordInventoryMovement(currentState, input, now = new Date().toISOString()) {
  const state = clone(currentState);
  state.inventoryMovements ??= [];
  const type = String(input?.type ?? '');
  if (!INVENTORY_TYPES.has(type)) throw new Error('Tipe pergerakan cup tidak valid');
  const reason = optionalText(input?.reason, 'Alasan', 300);
  if (REASON_REQUIRED_TYPES.has(type) && !reason) throw new Error('Alasan wajib diisi');
  const shiftId = input?.shiftId ? text(input.shiftId, 'Shift', 100) : null;
  if (shiftId) findShift(state, shiftId);
  const movement = {
    id: randomUUID(),
    type,
    quantity: quantity(input?.quantity, { allowNegative: type === 'adjustment' }),
    reason,
    businessDate: jakartaDate(now),
    shiftId,
    actor: {
      type: text(input?.actorType, 'Tipe aktor', 30),
      id: text(input?.actorId, 'ID aktor', 100),
      name: text(input?.actorName, 'Nama aktor', 120),
    },
    createdAt: now,
  };
  state.inventoryMovements.push(movement);
  return { state: changed(state), movement };
}

export function inventorySummary(state, businessDate = jakartaDate(new Date().toISOString())) {
  const period = (state.inventoryMovements ?? []).filter((movement) => movement.businessDate === businessDate);
  const totals = {
    received: 0,
    used: 0,
    damaged: 0,
    lost: 0,
    returned: 0,
    adjustments: 0,
  };
  for (const movement of period) {
    if (movement.type === 'adjustment') totals.adjustments += movement.quantity;
    else if (movement.type in totals) totals[movement.type] += movement.quantity;
  }
  const balance = (state.inventoryMovements ?? []).reduce((sum, movement) => {
    if (movement.type === 'received') return sum + movement.quantity;
    if (movement.type === 'adjustment') return sum + movement.quantity;
    return sum - movement.quantity;
  }, 0);
  const expectedUsedFromSales = (state.orders ?? [])
    .filter((order) => (
      order.businessDate === businessDate
      && order.paymentStatus !== 'void'
      && order.status !== 'cancelled'
    ))
    .flatMap((order) => order.items ?? [])
    .reduce((sum, item) => sum + (item.cupUsage ?? 0) * (item.quantity ?? 0), 0);
  return {
    ...totals,
    balance,
    expectedUsedFromSales,
    usageVariance: totals.used - expectedUsedFromSales,
  };
}
