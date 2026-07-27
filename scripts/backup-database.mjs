import { DatabaseSync } from 'node:sqlite';
import { mkdir, readdir, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const PROJECT_DIR = dirname(dirname(fileURLToPath(import.meta.url)));

function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function timestamp(value) {
  return value.toISOString().replace(/[:.]/g, '-');
}

function args(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--database') parsed.databasePath = argv[++index];
    else if (argv[index] === '--output-dir') parsed.outputDir = argv[++index];
    else if (argv[index] === '--keep') parsed.retentionCount = Number(argv[++index]);
  }
  return parsed;
}

export async function backupDatabase({
  databasePath = join(PROJECT_DIR, 'data', 'maucafe.sqlite'),
  outputDir = join(PROJECT_DIR, 'backups'),
  retentionCount = 30,
  now = new Date(),
} = {}) {
  if (!Number.isSafeInteger(retentionCount) || retentionCount < 1 || retentionCount > 365) {
    throw new Error('Jumlah retensi backup harus 1-365');
  }
  const source = resolve(databasePath);
  const destinationDir = resolve(outputDir);
  await mkdir(destinationDir, { recursive: true });
  const destination = join(destinationDir, `maucafe-${timestamp(now)}.sqlite`);
  const database = new DatabaseSync(source);
  try {
    database.exec('PRAGMA wal_checkpoint(PASSIVE)');
    database.exec(`VACUUM INTO ${sqlString(destination)}`);
  } finally {
    database.close();
  }
  const backups = (await readdir(destinationDir))
    .filter((name) => /^maucafe-\d{4}-\d{2}-\d{2}T.+Z\.sqlite$/.test(name))
    .sort()
    .reverse();
  for (const name of backups.slice(retentionCount)) {
    await rm(join(destinationDir, name), { force: true });
  }
  return destination;
}

async function main() {
  const options = args(process.argv.slice(2));
  const path = await backupDatabase(options);
  console.log(`Backup selesai: ${path}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
