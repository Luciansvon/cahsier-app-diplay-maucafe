import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  importLegacyJson,
  SqliteDatabase,
  SqliteStore,
} from '../src/sqlite-store.js';

async function temporaryDirectory() {
  return mkdtemp(join(tmpdir(), 'maucafe-sqlite-'));
}

test('persists cloned state and serializes concurrent SQLite updates', async (t) => {
  const directory = await temporaryDirectory();
  const database = new SqliteDatabase(join(directory, 'maucafe.sqlite'));
  await database.init();
  let reopenedDatabase;
  t.after(async () => {
    reopenedDatabase?.close();
    database.close();
    await rm(directory, { recursive: true, force: true });
  });

  const store = await new SqliteStore(database, 'outlet:test', { count: 0, nested: { value: 1 } }).init();
  const snapshot = store.get();
  snapshot.nested.value = 99;

  await Promise.all(Array.from({ length: 10 }, () => (
    store.update((state) => ({ ...state, count: state.count + 1 }))
  )));

  assert.deepEqual(store.get(), { count: 10, nested: { value: 1 } });

  reopenedDatabase = new SqliteDatabase(join(directory, 'maucafe.sqlite'));
  await reopenedDatabase.init();
  const reopened = await new SqliteStore(reopenedDatabase, 'outlet:test', {}).init();
  assert.deepEqual(reopened.get(), store.get());
});

test('stores append-only audit events without secrets', async (t) => {
  const directory = await temporaryDirectory();
  const database = new SqliteDatabase(join(directory, 'maucafe.sqlite'));
  await database.init();
  t.after(async () => {
    database.close();
    await rm(directory, { recursive: true, force: true });
  });

  database.appendAudit({
    actorType: 'employee',
    actorId: 'employee-1',
    action: 'shift.open',
    outletId: 'outlet-a',
    metadata: { openingCash: 100_000 },
  });
  database.appendAudit({
    actorType: 'owner',
    actorId: 'owner',
    action: 'outlet.approve',
    outletId: 'outlet-b',
    metadata: { pin: 'must-not-be-stored', token: 'must-not-be-stored', status: 'active' },
  });

  const events = database.listAudit({ limit: 10 });
  assert.equal(events.length, 2);
  assert.equal(events[0].action, 'outlet.approve');
  assert.deepEqual(events[0].metadata, { status: 'active' });
  assert.equal(events[1].action, 'shift.open');
});

test('imports legacy JSON once without modifying source files', async (t) => {
  const directory = await temporaryDirectory();
  const dataDir = join(directory, 'data');
  await mkdir(dataDir);
  const outlets = [{
    id: 'outlet-a',
    name: 'Outlet A',
    address: 'Jepara',
    adminPinHash: { salt: 'aa', hash: 'bb' },
  }];
  const security = { ownerPinHash: { salt: 'cc', hash: 'dd' } };
  const outletState = { products: [{ id: 'kopi', name: 'Kopi', price: 10_000 }], orders: [], revision: 7 };
  await writeFile(join(dataDir, 'outlets.json'), `${JSON.stringify(outlets, null, 2)}\n`);
  await writeFile(join(dataDir, 'security.json'), `${JSON.stringify(security, null, 2)}\n`);
  await writeFile(join(dataDir, 'outlet-outlet-a.json'), `${JSON.stringify(outletState, null, 2)}\n`);
  const before = await Promise.all([
    readFile(join(dataDir, 'outlets.json'), 'utf8'),
    readFile(join(dataDir, 'security.json'), 'utf8'),
    readFile(join(dataDir, 'outlet-outlet-a.json'), 'utf8'),
  ]);

  const database = new SqliteDatabase(join(dataDir, 'maucafe.sqlite'));
  await database.init();
  t.after(async () => {
    database.close();
    await rm(directory, { recursive: true, force: true });
  });
  const imported = await importLegacyJson({
    database,
    dataDir,
    initialState: { products: [], orders: [], revision: 0 },
  });

  assert.equal(imported, true);
  assert.deepEqual(database.readState('registry'), {
    outlets,
    partners: [],
    users: [],
    masterProducts: outletState.products,
    schemaVersion: 1,
  });
  assert.deepEqual(database.readState('security'), security);
  assert.deepEqual(database.readState('outlet:outlet-a'), outletState);

  await writeFile(join(dataDir, 'outlet-outlet-a.json'), '{"revision":999}\n');
  assert.equal(await importLegacyJson({ database, dataDir, initialState: {} }), false);
  assert.equal(database.readState('outlet:outlet-a').revision, 7);

  const after = await Promise.all([
    readFile(join(dataDir, 'outlets.json'), 'utf8'),
    readFile(join(dataDir, 'security.json'), 'utf8'),
  ]);
  assert.deepEqual(after, before.slice(0, 2));
  assert.equal(database.hasMigration('legacy-json-v1'), true);
});

test('legacy import fails closed when global Owner credential is missing', async (t) => {
  const directory = await temporaryDirectory();
  const dataDir = join(directory, 'data');
  await mkdir(dataDir);
  await writeFile(join(dataDir, 'outlets.json'), '[{"id":"a","name":"A","adminPinHash":{"salt":"aa","hash":"bb"}}]\n');

  const database = new SqliteDatabase(join(dataDir, 'maucafe.sqlite'));
  await database.init();
  t.after(async () => {
    database.close();
    await rm(directory, { recursive: true, force: true });
  });

  await assert.rejects(
    importLegacyJson({ database, dataDir, initialState: {} }),
    /security\.json tidak ditemukan/,
  );
  assert.equal(database.hasMigration('legacy-json-v1'), false);
});
