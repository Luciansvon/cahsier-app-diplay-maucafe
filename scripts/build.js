import { cp, mkdir, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const requiredJavaScript = [
  'src/queue.js',
  'src/store.js',
  'src/server.js',
  'public/sales.js',
  'public/admin.js',
  'public/display.js',
  'public/owner.js',
];

for (const file of requiredJavaScript) {
  const result = spawnSync(process.execPath, ['--check', join(root, file)], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const output = join(root, 'dist');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(join(root, 'public'), output, { recursive: true });
console.log('Build selesai: aset tervalidasi dan tersedia di dist/');
