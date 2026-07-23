import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { JsonStore } from '../src/store.js';

test('creates initial state and persists updates across instances', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'queue-store-'));
  const file = join(directory, 'state.json');
  t.after(() => rm(directory, { recursive: true, force: true }));

  const first = new JsonStore(file, { revision: 0, activeCall: null });
  await first.init();
  await first.update((state) => ({ ...state, revision: 1, activeCall: { queueNumber: '007' } }));

  const second = new JsonStore(file, { revision: 0, activeCall: null });
  await second.init();

  assert.deepEqual(second.get(), { revision: 1, activeCall: { queueNumber: '007' } });
  assert.deepEqual(JSON.parse(await readFile(file, 'utf8')), second.get());
});

test('serializes concurrent updates without losing state', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'queue-store-'));
  const file = join(directory, 'state.json');
  t.after(() => rm(directory, { recursive: true, force: true }));

  const store = new JsonStore(file, { count: 0 });
  await store.init();
  await Promise.all(Array.from({ length: 10 }, () => store.update((state) => ({ count: state.count + 1 }))));

  assert.equal(store.get().count, 10);
});

test('get returns a clone that cannot mutate stored state', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'queue-store-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = new JsonStore(join(directory, 'state.json'), { nested: { value: 1 } });
  await store.init();

  const snapshot = store.get();
  snapshot.nested.value = 99;

  assert.equal(store.get().nested.value, 1);
});
