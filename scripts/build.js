import { cp, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const requiredJavaScript = [
  'src/queue.js',
  'src/store.js',
  'src/server.js',
  'public/sales.js',
  'public/api-client.js',
  'public/app-config.js',
  'public/admin.js',
  'public/display.js',
  'public/launcher.js',
  'public/native-session.js',
  'public/native-shell.js',
  'public/owner.js',
  'public/partner.js',
  'public/queue-number.js',
  'public/receipt-model.js',
];

for (const file of requiredJavaScript) {
  const result = spawnSync(process.execPath, ['--check', join(root, file)], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const output = join(root, 'dist');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(join(root, 'public'), output, { recursive: true });

const targetArg = process.argv.find((value) => value.startsWith('--target='))?.split('=')[1];
const buildTarget = targetArg || process.env.MAUCAFE_BUILD_TARGET || 'web';
const apiBaseUrl = String(process.env.MAUCAFE_API_BASE_URL || '').trim().replace(/\/+$/, '');
if (!['web', 'android'].includes(buildTarget)) throw new Error('Build target harus web atau android');
if (buildTarget === 'android' && apiBaseUrl && new URL(apiBaseUrl).protocol !== 'https:') {
  throw new Error('MAUCAFE_API_BASE_URL untuk Android wajib memakai HTTPS');
}

for (const entry of await readdir(output)) {
  if (entry.includes('.single-outlet.bak.')) await rm(join(output, entry), { force: true });
}
const mediaOutput = join(output, 'media');
for (const entry of await readdir(mediaOutput).catch(() => [])) {
  if (entry.startsWith('uploaded-')) await rm(join(mediaOutput, entry), { force: true });
}
if (buildTarget === 'android') {
  for (const entry of ['display.css', 'display.html', 'display.js', 'media']) {
    await rm(join(output, entry), { recursive: true, force: true });
  }
  await cp(join(root, 'node_modules', '@capacitor', 'core', 'dist', 'capacitor.js'), join(output, 'capacitor.js'));
}
await writeFile(join(output, 'runtime-config.js'), `globalThis.MAUCAFE_CONFIG = Object.freeze(${JSON.stringify({
  buildTarget,
  apiBaseUrl,
}, null, 2)});\n`, 'utf8');
console.log(`Build ${buildTarget} selesai: aset tersedia di dist/`);
