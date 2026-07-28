import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createQueueServer } from '../src/server.js';
import { createInitialState } from '../src/queue.js';
import { createPinHash } from '../src/security.js';
import { importLegacyJson, SqliteDatabase } from '../src/sqlite-store.js';

export async function fixture(t, {
  configuredOutlets,
  ownerPin = '1234',
  registryPatch,
} = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'queue-server-'));
  const publicDir = join(directory, 'public');
  const dataDir = join(directory, 'data');
  await mkdir(publicDir);
  await mkdir(dataDir);
  for (const [name, html] of [['admin.html', '<h1>Admin</h1>'], ['display.html', '<h1>Display</h1>'], ['owner.html', '<h1>Owner</h1>']]) {
    await writeFile(join(publicDir, name), html);
  }
  await writeFile(join(publicDir, 'owner.js'), 'export const owner = true;');
  await writeFile(join(publicDir, 'partner.html'), '<h1>Partner</h1>');
  await writeFile(join(publicDir, 'partner.js'), 'export const partner = true;');
  await writeFile(join(publicDir, 'partner.css'), '.partner {}');
  await writeFile(join(publicDir, 'native-shell.js'), 'export const nativeShell = true;');
  await writeFile(join(publicDir, 'queue-number.js'), 'export const queueNumberText = () => "satu";');
  await writeFile(join(publicDir, 'sales.js'), 'export const sales = true;');

  const outlets = configuredOutlets ?? [
    { id: 'maucafe-alunalun', name: 'Maucafe Alun-Alun Jepara', address: 'Alun-Alun Jepara', adminPin: '1111' },
    { id: 'maucafe-pik', name: 'Maucafe PIK', address: 'PIK Avenue', adminPin: '2222' },
  ];
  await writeFile(join(dataDir, 'outlets.json'), JSON.stringify(outlets));
  await writeFile(join(dataDir, 'security.json'), JSON.stringify({ ownerPinHash: createPinHash(ownerPin) }, null, 2));

  const initialState = createInitialState({
    products: [{ id: 'latte', name: 'Latte', category: 'Kopi', price: 20000, cost: 8000, active: true }],
  });
  if (registryPatch) {
    const database = await new SqliteDatabase(join(dataDir, 'maucafe.sqlite')).init();
    await importLegacyJson({ database, dataDir, initialState });
    database.writeState('registry', {
      ...database.readState('registry'),
      ...structuredClone(registryPatch),
    });
    database.close();
  }
  const app = await createQueueServer({ dataDir, publicDir, initialState });
  await app.listen(0, '127.0.0.1');
  const address = app.server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  t.after(async () => {
    await app.close();
    await rm(directory, { recursive: true, force: true });
  });
  return { app, baseUrl, dataDir, publicDir, defaultOutletId: outlets[0].id };
}

export function cookiePair(response) {
  return (response.headers.get('set-cookie') ?? '').split(';')[0];
}

export async function jsonRequest(url, method = 'GET', body, headers = {}) {
  const hasBody = body !== undefined && body !== null && method !== 'GET' && method !== 'HEAD';
  const customHeaders = {
    ...(hasBody ? { 'content-type': 'application/json' } : {}),
    ...headers,
  };
  const response = await fetch(url, {
    method,
    headers: customHeaders,
    body: hasBody ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json();
  return { response, payload };
}
