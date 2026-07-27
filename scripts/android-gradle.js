import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const portableRoot = join(process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'), 'MAUCAFE', 'jdk21-portable');
const portableCandidates = existsSync(portableRoot)
  ? readdirSync(portableRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => join(portableRoot, entry.name))
  : [];
const candidates = [
  process.env.JAVA_HOME,
  ...portableCandidates,
  join(process.env.ProgramFiles || 'C:\\Program Files', 'Android', 'Android Studio', 'jbr'),
].filter(Boolean);

function supportedJdk(candidate) {
  const java = join(candidate, 'bin', process.platform === 'win32' ? 'java.exe' : 'java');
  if (!existsSync(java)) return false;
  const result = spawnSync(java, ['-version'], { encoding: 'utf8' });
  const versionText = `${result.stdout}\n${result.stderr}`;
  const major = Number(versionText.match(/version "(\d+)/)?.[1]);
  return result.status === 0 && major >= 17;
}

const javaHome = candidates.find(supportedJdk);
if (!javaHome) {
  console.error('JDK 17+ tidak ditemukan. Install Android Studio atau Temurin JDK 21.');
  process.exit(1);
}

const androidHome = [
  process.env.ANDROID_HOME,
  process.env.ANDROID_SDK_ROOT,
  join(process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'), 'Android', 'Sdk'),
].find((candidate) => candidate && existsSync(candidate));
if (!androidHome) {
  console.error('Android SDK tidak ditemukan. Install Android Studio beserta Android SDK.');
  process.exit(1);
}

const gradleTasks = process.argv.slice(2);
if (gradleTasks.length === 0 || gradleTasks.some((task) => !/^[A-Za-z0-9:_.-]+$/.test(task))) {
  console.error('Task Gradle kosong atau tidak aman.');
  process.exit(1);
}

const androidDir = join(root, 'android');
const wrapper = join(androidDir, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew');
const command = process.platform === 'win32' ? (process.env.ComSpec || 'cmd.exe') : wrapper;
const commandArgs = process.platform === 'win32'
  ? ['/d', '/c', 'call', wrapper, ...gradleTasks]
  : gradleTasks;
const result = spawnSync(command, commandArgs, {
  cwd: androidDir,
  env: {
    ...process.env,
    JAVA_HOME: javaHome,
    ANDROID_HOME: androidHome,
    ANDROID_SDK_ROOT: androidHome,
    Path: `${join(javaHome, 'bin')};${process.env.Path || ''}`,
  },
  stdio: 'inherit',
});
if (result.error) console.error(result.error.message);
if (result.status !== 0) process.exit(result.status ?? 1);

if (gradleTasks.includes('assembleDebug')) {
  const sourceApk = join(root, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
  if (!existsSync(sourceApk)) {
    console.error(`APK debug tidak ditemukan setelah build: ${sourceApk}`);
    process.exit(1);
  }
  const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const artifactsDir = join(root, 'artifacts');
  const artifactApk = join(artifactsDir, `MAUCAFE-Operations-${version}-debug.apk`);
  mkdirSync(artifactsDir, { recursive: true });
  copyFileSync(sourceApk, artifactApk);
  console.log(`Debug APK tersedia: ${artifactApk}`);
}
