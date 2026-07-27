import { DatabaseSync } from 'node:sqlite';
import { copyFile, mkdir, rename, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

function timestamp(value) {
  return value.toISOString().replace(/[:.]/g, '-');
}

function args(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--database') parsed.databasePath = argv[++index];
    else if (argv[index] === '--source') parsed.sourcePath = argv[++index];
  }
  return parsed;
}

function validateBackup(path) {
  const database = new DatabaseSync(path, { readOnly: true });
  try {
    const integrity = database.prepare('PRAGMA integrity_check').get();
    if (integrity.integrity_check !== 'ok') throw new Error('Backup SQLite rusak');
    const table = database.prepare(`
      SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'app_state'
    `).get();
    if (!table) throw new Error('Backup bukan database MAUCAFE');
    for (const key of ['registry', 'security']) {
      if (!database.prepare('SELECT 1 FROM app_state WHERE state_key = ?').get(key)) {
        throw new Error(`Backup tidak memiliki state ${key}`);
      }
    }
  } finally {
    database.close();
  }
}

export async function restoreDatabase({
  sourcePath,
  databasePath,
  now = new Date(),
} = {}) {
  if (!sourcePath || !databasePath) throw new Error('--source dan --database wajib diisi');
  const source = resolve(sourcePath);
  const target = resolve(databasePath);
  if (source === target) throw new Error('Source backup harus berbeda dari database aktif');
  validateBackup(source);
  await mkdir(dirname(target), { recursive: true });
  const temporaryPath = `${target}.restore-${process.pid}.tmp`;
  const previousDatabasePath = `${target}.before-restore-${timestamp(now)}`;
  await copyFile(source, temporaryPath);
  let movedCurrent = false;
  try {
    await rename(target, previousDatabasePath);
    movedCurrent = true;
    await rename(temporaryPath, target);
  } catch (error) {
    await rm(temporaryPath, { force: true });
    if (movedCurrent) await rename(previousDatabasePath, target).catch(() => {});
    throw error;
  }
  return { databasePath: target, previousDatabasePath };
}

async function main() {
  const result = await restoreDatabase(args(process.argv.slice(2)));
  console.log(`Restore selesai: ${result.databasePath}`);
  console.log(`Database sebelumnya: ${result.previousDatabasePath}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
