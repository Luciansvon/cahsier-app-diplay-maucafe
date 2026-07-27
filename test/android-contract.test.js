import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readJson = async (path) => JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Capacitor packages and scripts build a local Android shell', async () => {
  const [packageJson, capacitorConfig] = await Promise.all([
    readJson('package.json'),
    readJson('capacitor.config.json'),
  ]);

  assert.equal(capacitorConfig.appId, 'id.maucafe.operations');
  assert.equal(capacitorConfig.appName, 'MAUCAFE Operations');
  assert.equal(capacitorConfig.webDir, 'dist');
  assert.equal('server' in capacitorConfig, false);
  assert.equal(capacitorConfig.android.allowMixedContent, false);
  assert.equal(capacitorConfig.android.webContentsDebuggingEnabled, false);

  assert.match(packageJson.scripts['build:android'], /--target=android/);
  assert.match(packageJson.scripts['android:sync'], /cap sync android/);
  assert.match(packageJson.scripts['android:debug'], /assembleDebug/);
  assert.match(packageJson.dependencies['@capacitor/android'], /^8\.4\.2$/);
  assert.match(packageJson.devDependencies['@capacitor/cli'], /^8\.4\.2$/);
});

test('Android shell is portrait, HTTPS-only, lifecycle-aware, and excludes runtime uploads', async () => {
  const [manifest, gradle, nativeShell, buildScript, gradleRunner, icon] = await Promise.all([
    read('android/app/src/main/AndroidManifest.xml'),
    read('android/app/build.gradle'),
    read('public/native-shell.js'),
    read('scripts/build.js'),
    read('scripts/android-gradle.js'),
    read('android/app/src/main/res/drawable/ic_maucafe.xml'),
  ]);

  assert.match(manifest, /android:screenOrientation="portrait"/);
  assert.match(manifest, /android:usesCleartextTraffic="false"/);
  assert.match(manifest, /android:allowBackup="false"/);
  assert.match(manifest, /android:icon="@drawable\/ic_maucafe"/);
  assert.match(gradle, /versionName "0\.1\.0"/);
  assert.match(nativeShell, /registerPlugin\('App'\)/);
  assert.match(nativeShell, /registerPlugin\('Network'\)/);
  assert.match(nativeShell, /backButton/);
  assert.match(nativeShell, /appStateChange/);
  assert.match(buildScript, /uploaded-/);
  assert.match(buildScript, /capacitor\.js/);
  assert.match(gradleRunner, /JAVA_HOME/);
  assert.match(gradleRunner, /ANDROID_HOME/);
  assert.match(gradleRunner, /jdk21-portable/);
  assert.match(gradleRunner, /gradlew\.bat/);
  assert.match(gradleRunner, /app-debug\.apk/);
  assert.match(gradleRunner, /MAUCAFE-Operations-\$\{version\}-debug\.apk/);
  assert.match(gradleRunner, /copyFileSync/);
  assert.match(gradleRunner, /ComSpec/);
  assert.doesNotMatch(gradleRunner, /shell:\s*true/);
  assert.match(icon, /#C7161E/i);
});
