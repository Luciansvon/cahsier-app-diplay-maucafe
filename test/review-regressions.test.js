import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  approveOutlet,
  normalizeRegistry,
  proposeOutlet,
} from '../src/franchise.js';
import { addMediaItem } from '../src/media.js';
import { createInitialState, createOrder, resetQueue, rolloverBusinessDay } from '../src/queue.js';
import { summarizeSales } from '../public/sales.js';

const NOW = '2026-07-27T01:00:00.000Z';

function registryBase() {
  return normalizeRegistry({
    outlets: [{
      id: 'maucafe-lama',
      name: 'MAUCAFE Lama',
      address: 'Jepara',
      status: 'active',
      partnerId: null,
      adminPinHash: { algorithm: 'scrypt', salt: '00', hash: '00' },
    }],
    partners: [],
    users: [],
    masterProducts: [],
  });
}

test('pending and approved outlets always carry a non-plaintext Admin credential', () => {
  const partner = { id: 'partner-1', active: true };
  const regWithPartner = { ...registryBase(), partners: [partner] };
  const proposed = proposeOutlet(regWithPartner, {
    partnerId: partner.id,
    name: 'MAUCAFE Baru',
    address: 'Jepara',
  }, NOW);

  assert.equal(typeof proposed.outlet.adminPinHash.hash, 'string');
  assert.equal(proposed.outlet.legacyAdminDisabled, true);
  const approved = approveOutlet(proposed.registry, proposed.outlet.id, { approvedBy: 'owner' }, NOW);
  assert.equal(approved.outlet.status, 'active');
  assert.equal(typeof approved.outlet.adminPinHash.hash, 'string');
});

test('paid orders remain financial sales after rollover and queue reset', () => {
  const base = createInitialState({
    products: [{
      id: 'kopi',
      name: 'Kopi',
      category: 'Kopi',
      price: 20_000,
      cost: 8_000,
      cupUsage: 1,
      active: true,
    }],
  });
  const created = createOrder(base, {
    items: [{ productId: 'kopi', quantity: 1 }],
    paymentMethod: 'cash',
  }, '2026-07-27T15:59:00.000Z');

  const rolled = rolloverBusinessDay(created.state, '2026-07-27T17:01:00.000Z');
  assert.equal(rolled.orders[0].status, 'expired');
  assert.equal(rolled.orders[0].paymentStatus, 'paid');

  const summary = summarizeSales(rolled.orders, created.order.businessDate);
  assert.equal(summary.revenue, 20_000);
  assert.equal(summary.paymentTotals.cash, 20_000);

  const reset = resetQueue(created.state, '2026-07-27T16:00:00.000Z');
  assert.equal(reset.orders[0].status, 'expired');
  assert.equal(reset.orders[0].paymentStatus, 'paid');
  assert.equal(summarizeSales(reset.orders, created.order.businessDate).revenue, 20_000);
});

test('playlist has bounded total item and image counts', () => {
  let state = { ...createInitialState(), mediaPlaylist: [] };
  for (let index = 0; index < 15; index += 1) {
    state = addMediaItem(state, {
      type: 'image',
      url: `/media/photo-${index}.png`,
      filename: `photo-${index}.png`,
      imageDurationSeconds: 8,
    }).state;
  }
  assert.throws(() => addMediaItem(state, {
    type: 'image',
    url: '/media/photo-over.png',
    filename: 'photo-over.png',
    imageDurationSeconds: 8,
  }), /maksimal 15 foto/i);
});

test('server contract includes session revalidation, PIN collision, and storage quota', async () => {
  const source = await readFile(new URL('../src/server.js', import.meta.url), 'utf8');
  assert.match(source, /candidate\.partnerId === currentOutlet\?\.partnerId/);
  assert.match(source, /hasPinCollision\(body\.ownerPin\)/);
  assert.match(source, /MAX_MEDIA_STORAGE_BYTES/);
  assert.match(source, /productImageCommitted/);
  assert.match(source, /mediaCommitted/);
  assert.match(source, /legacyAdminDisabled/);
});
