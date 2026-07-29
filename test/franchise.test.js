import test from 'node:test';
import assert from 'node:assert/strict';

import {
  approveOutlet,
  authenticateUser,
  createEmployee,
  createPartner,
  normalizeRegistry,
  partnerOwnsOutlet,
  proposeOutlet,
  safeRegistry,
  updateEmployee,
} from '../src/franchise.js';
import { verifyPinHash } from '../src/security.js';

const NOW = '2026-07-27T01:00:00.000Z';

function baseRegistry() {
  return normalizeRegistry({
    outlets: [
      { id: 'maucafe-tahunan', name: 'Maucafe Tahunan', address: 'Jepara', adminPinHash: { salt: 'aa', hash: 'bb' } },
    ],
    partners: [],
    users: [],
    masterProducts: [],
  });
}

test('creates a Partner account with a hashed PIN and safe public registry', () => {
  const created = createPartner(baseRegistry(), {
    name: 'Mitra Jepara',
    username: 'mitra.jepara',
    pin: '5678',
  }, NOW);

  assert.equal(created.partner.name, 'Mitra Jepara');
  assert.equal(created.user.role, 'partner');
  assert.equal(created.user.username, 'mitra.jepara');
  assert.equal('pin' in created.user, false);
  assert.equal(verifyPinHash(created.user.pinHash, '5678'), true);
  assert.equal(authenticateUser(created.registry, {
    username: 'mitra.jepara',
    pin: '5678',
    role: 'partner',
  }).id, created.user.id);
  assert.equal(authenticateUser(created.registry, {
    username: 'mitra.jepara',
    pin: '0000',
    role: 'partner',
  }), null);
  assert.doesNotMatch(JSON.stringify(safeRegistry(created.registry)), /pinHash|salt|hash/);
});

test('Partner proposes unique pending outlets and Owner approval activates one', () => {
  const partnerCreated = createPartner(baseRegistry(), {
    name: 'Mitra Jepara',
    username: 'mitra.jepara',
    pin: '5678',
  }, NOW);
  const first = proposeOutlet(partnerCreated.registry, {
    partnerId: partnerCreated.partner.id,
    name: 'MAUCAFE Jepara Kota',
    address: 'Jl. Pemuda',
  }, NOW);
  const second = proposeOutlet(first.registry, {
    partnerId: partnerCreated.partner.id,
    name: 'MAUCAFE Jepara Kota',
    address: 'Jl. Kartini',
  }, NOW);

  assert.equal(first.outlet.id, 'maucafe-jepara-kota');
  assert.equal(second.outlet.id, 'maucafe-jepara-kota-2');
  assert.equal(first.outlet.status, 'pending');
  assert.equal(partnerOwnsOutlet(second.registry, partnerCreated.partner.id, first.outlet.id), true);

  const approved = approveOutlet(second.registry, first.outlet.id, {
    approvedBy: 'owner',
  }, NOW);
  assert.equal(approved.outlet.status, 'active');
  assert.equal(approved.outlet.approvedAt, NOW);
  assert.throws(
    () => approveOutlet(approved.registry, first.outlet.id, { approvedBy: 'owner' }, NOW),
    /sudah aktif/i,
  );
});

test('Partner can create scoped Employee accounts after its outlet is approved', () => {
  const partnerCreated = createPartner(baseRegistry(), {
    name: 'Mitra Jepara',
    username: 'mitra.jepara',
    pin: '5678',
  }, NOW);
  const proposed = proposeOutlet(partnerCreated.registry, {
    partnerId: partnerCreated.partner.id,
    name: 'MAUCAFE Jepara Kota',
    address: 'Jl. Pemuda',
  }, NOW);
  const approved = approveOutlet(proposed.registry, proposed.outlet.id, { approvedBy: 'owner' }, NOW);
  const employee = createEmployee(approved.registry, {
    partnerId: partnerCreated.partner.id,
    outletId: proposed.outlet.id,
    name: 'Kasir Pagi',
    username: 'kasir.pagi',
    pin: '2468',
  }, NOW);

  assert.equal(employee.user.role, 'employee');
  assert.deepEqual(employee.user.outletIds, [proposed.outlet.id]);
  assert.equal(verifyPinHash(employee.user.pinHash, '2468'), true);
  assert.equal(authenticateUser(employee.registry, {
    username: 'kasir.pagi',
    pin: '2468',
    role: 'employee',
    outletId: proposed.outlet.id,
  }).id, employee.user.id);
  assert.equal(authenticateUser(employee.registry, {
    username: 'kasir.pagi',
    pin: '2468',
    role: 'employee',
    outletId: 'outlet-lain',
  }), null);
});

test('rejects duplicate usernames and cross-Partner employee assignment', () => {
  const first = createPartner(baseRegistry(), {
    name: 'Mitra Satu',
    username: 'mitra.satu',
    pin: '1112',
  }, NOW);
  const second = createPartner(first.registry, {
    name: 'Mitra Dua',
    username: 'mitra.dua',
    pin: '2223',
  }, NOW);
  const proposed = proposeOutlet(second.registry, {
    partnerId: first.partner.id,
    name: 'MAUCAFE Mitra Satu',
    address: 'Jl. Mitra Satu',
  }, NOW);

  assert.throws(
    () => createPartner(proposed.registry, {
      name: 'Duplikat',
      username: 'MITRA.SATU',
      pin: '9999',
    }, NOW),
    /username sudah dipakai/i,
  );
  assert.throws(
    () => createEmployee(proposed.registry, {
      partnerId: second.partner.id,
      outletId: proposed.outlet.id,
      name: 'Penyusup',
      username: 'penyusup',
      pin: '3334',
    }, NOW),
    /bukan milik Mitra/i,
  );
});

test('Mitra can update only its own Employee and PIN remains hashed', () => {
  let registry = normalizeRegistry({ outlets: [], partners: [], users: [] });
  const first = createPartner(registry, { name: 'Satu', username: 'mitra.satu', pin: '1234' });
  registry = first.registry;
  const second = createPartner(registry, { name: 'Dua', username: 'mitra.dua', pin: '5678' });
  registry = second.registry;
  const proposed = proposeOutlet(registry, {
    partnerId: first.partner.id,
    name: 'MAUCAFE Satu',
    address: 'Jalan Satu',
  });
  registry = approveOutlet(proposed.registry, proposed.outlet.id, { approvedBy: 'owner' }).registry;
  const employee = createEmployee(registry, {
    partnerId: first.partner.id,
    outletId: proposed.outlet.id,
    name: 'Kasir',
    username: 'kasir.satu',
    pin: '2468',
  });

  const updated = updateEmployee(employee.registry, employee.user.id, {
    partnerId: first.partner.id,
    active: false,
    pin: '1357',
  });
  assert.equal(updated.user.active, false);
  assert.equal('pin' in updated.user, false);
  assert.equal(typeof updated.user.pinHash.hash, 'string');
  assert.throws(() => updateEmployee(employee.registry, employee.user.id, {
    partnerId: first.partner.id,
    active: 'false',
  }), /boolean/i);
  assert.throws(() => updateEmployee(updated.registry, employee.user.id, {
    partnerId: second.partner.id,
    active: true,
  }), /tidak ditemukan/i);
});
