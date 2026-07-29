import test from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { backupDatabase } from '../scripts/backup-database.mjs';
import { restoreDatabase } from '../scripts/restore-database.mjs';
import { SqliteDatabase } from '../src/sqlite-store.js';

test('backup is a valid SQLite snapshot and restore preserves the replaced database', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'maucafe-ops-'));
  const databasePath = join(directory, 'data', 'maucafe.sqlite');
  const outputDir = join(directory, 'backups');
  let database = await new SqliteDatabase(databasePath).init();
  database.writeState('registry', { outlets: [{ id: 'one' }] });
  database.writeState('security', { ownerPinHash: { salt: 'x', hash: 'y' } });
  database.writeState('outlet:one', { revision: 7 });
  database.close();

  const backupPath = await backupDatabase({
    databasePath,
    outputDir,
    now: new Date('2026-07-27T01:02:03.000Z'),
  });
  database = await new SqliteDatabase(databasePath).init();
  database.writeState('outlet:one', { revision: 99 });
  database.close();
  await writeFile(`${databasePath}-wal`, 'stale wal');
  await writeFile(`${databasePath}-shm`, 'stale shm');

  const restored = await restoreDatabase({
    sourcePath: backupPath,
    databasePath,
    now: new Date('2026-07-27T02:03:04.000Z'),
  });
  database = await new SqliteDatabase(databasePath).init();
  assert.equal(database.readState('outlet:one').revision, 7);
  database.close();
  assert.equal((await readFile(restored.previousDatabasePath)).length > 0, true);
  assert.equal(await readFile(restored.previousSidecarPaths.wal, 'utf8'), 'stale wal');
  assert.equal(await readFile(restored.previousSidecarPaths.shm, 'utf8'), 'stale shm');
  await assert.rejects(access(`${databasePath}-wal`));
  await assert.rejects(access(`${databasePath}-shm`));
  await rm(directory, { recursive: true, force: true });
});

test('Windows startup task scripts use SYSTEM and never embed an account password', async () => {
  const [install, uninstall] = await Promise.all([
    readFile(new URL('../scripts/install-windows-service.ps1', import.meta.url), 'utf8'),
    readFile(new URL('../scripts/uninstall-windows-service.ps1', import.meta.url), 'utf8'),
  ]);
  assert.match(install, /New-ScheduledTaskPrincipal[\s\S]*SYSTEM/i);
  assert.match(install, /New-ScheduledTaskTrigger\s+-AtStartup/i);
  assert.match(install, /New-ScheduledTaskTrigger\s+-Daily\s+-At\s+'02:00'/i);
  assert.match(install, /-Argument\s+"`"\$serverPath`"\s+--production"/i);
  assert.doesNotMatch(install, /-Password|ConvertTo-SecureString/i);
  assert.match(uninstall, /Unregister-ScheduledTask/i);
});
