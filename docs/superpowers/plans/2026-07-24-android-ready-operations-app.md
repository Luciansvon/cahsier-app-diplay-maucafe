# MAUCAFE Android-Ready Operations App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menyelesaikan bug penting, merapikan batas fitur Kasir/Owner/Display, dan menghasilkan APK Android MAUCAFE Operations yang membundle frontend lokal serta terhubung aman ke backend Node.js.

**Architecture:** Backend Node.js tetap menjadi source of truth. Web mempertahankan cookie session dan SSE, sedangkan APK memakai API base terkonfigurasi, bearer session berumur pendek, polling saat native, dan frontend lokal dari `dist/`. Display TV tetap halaman web terpisah.

**Tech Stack:** Node.js 24, HTML/CSS/JavaScript modules, Node test runner, Capacitor 8, Android Gradle.

---

### Task 1: Regression Bugs dan Reliability

**Files:**
- Modify: `test/server.test.js`
- Modify: `test/queue.test.js`
- Modify: `src/server.js`
- Modify: `src/queue.js`

- [ ] **Step 1: Tambah test endpoint purge**

Tambahkan test yang login Owner, memanggil `POST /sales/purge`, dan mengharapkan status `200`.

- [ ] **Step 2: Jalankan test dan pastikan gagal**

Run: `node --test test/server.test.js`

Expected: FAIL karena `body is not defined`.

- [ ] **Step 3: Perbaiki pembacaan body dan validasi retensi**

Simpan hasil `readJson()` ke variabel `body`, validasi `daysToKeep` sebagai safe integer `1..3650`, lalu teruskan ke `purgeOldOrders`.

- [ ] **Step 4: Tambah test order idempotent dan batas total**

Test harus membuktikan `requestId` yang sama tidak membuat order kedua, item maksimal dibatasi, dan total harus safe integer.

- [ ] **Step 5: Implementasi minimal**

Simpan `requestId` pada snapshot order, kembalikan order lama untuk request yang sama, batasi jumlah line item, dan tolak subtotal/total yang tidak safe.

- [ ] **Step 6: Jalankan test**

Run: `node --test test/queue.test.js test/server.test.js`

Expected: PASS.

### Task 2: Native API dan Session

**Files:**
- Create: `public/app-config.js`
- Create: `public/api-client.js`
- Create: `public/native-session.js`
- Modify: `test/server.test.js`
- Modify: `test/ui-contract.test.js`
- Modify: `src/server.js`
- Modify: `public/admin.js`
- Modify: `public/owner.js`

- [ ] **Step 1: Tambah failing tests native auth**

Test login native Admin/Owner, bearer authorization, outlet scope, logout revocation, CORS allowlist, dan penolakan origin asing.

- [ ] **Step 2: Jalankan test**

Run: `node --test test/server.test.js`

Expected: FAIL karena route native belum ada.

- [ ] **Step 3: Implement native session routes**

Tambahkan:

```text
POST /api/native/admin/login
POST /api/native/owner/login
POST /api/native/logout
```

Token dibuat server, mempunyai expiry, role, dan outlet scope. PIN tidak dikirim kembali atau disimpan client.

- [ ] **Step 4: Tambah API client terpusat**

`app-config.js` membentuk URL dari config runtime. `api-client.js` menangani JSON, bearer header, timeout, error, dan download. `native-session.js` hanya memakai penyimpanan sesi sementara.

- [ ] **Step 5: Migrasikan Admin dan Owner**

Semua `fetch` memakai API client. Web tetap cookie/session same-origin. Native memakai bearer dan polling; tidak memasukkan token ke URL SSE.

- [ ] **Step 6: Revoke session setelah rotasi PIN**

Ganti PIN Admin mencabut seluruh sesi Admin outlet terkait. Ganti PIN Owner mencabut seluruh sesi Owner dan UI meminta login ulang.

- [ ] **Step 7: Jalankan test**

Run: `node --test test/server.test.js test/ui-contract.test.js`

Expected: PASS.

### Task 3: Launcher dan Build Web

**Files:**
- Create: `public/index.html`
- Create: `public/launcher.js`
- Create: `public/runtime-config.js`
- Modify: `public/admin.html`
- Modify: `public/owner.html`
- Modify: `public/display.html`
- Modify: `scripts/build.js`
- Modify: `test/ui-contract.test.js`

- [ ] **Step 1: Tambah failing build/UI contract**

Test harus mewajibkan launcher, relative assets, relative module import, API config, outlet query routing, dan `dist/index.html`.

- [ ] **Step 2: Jalankan test**

Run: `node --test test/ui-contract.test.js`

Expected: FAIL karena launcher belum ada.

- [ ] **Step 3: Implement launcher**

Launcher hanya menampilkan dua tujuan: Kasir dan Owner. Kasir memilih outlet dari endpoint publik, menyimpan outlet terakhir non-sensitive, lalu membuka `admin.html?outlet=<id>`.

- [ ] **Step 4: Perbarui build**

Build memvalidasi semua module, menyalin `public/`, dan menghasilkan `dist/runtime-config.js` berdasarkan:

```text
MAUCAFE_BUILD_TARGET
MAUCAFE_API_BASE_URL
```

Production native build wajib HTTPS.

- [ ] **Step 5: Jalankan build**

Run: `npm run build`

Expected: `dist/index.html` dan seluruh asset lokal tersedia.

### Task 4: Penyederhanaan UI

**Files:**
- Create: `public/base.css`
- Create: `public/admin.css`
- Create: `public/owner.css`
- Create: `public/display.css`
- Create: `public/launcher.css`
- Delete: `public/styles.css`
- Modify: `public/admin.html`
- Modify: `public/owner.html`
- Modify: `public/display.html`
- Modify: `test/ui-contract.test.js`

- [ ] **Step 1: Tambah contract untuk stylesheet role**

Test memastikan setiap halaman memakai `base.css` plus satu stylesheet role dan tidak memakai stylesheet monolitik.

- [ ] **Step 2: Jalankan test**

Run: `node --test test/ui-contract.test.js`

Expected: FAIL.

- [ ] **Step 3: Pecah design system**

`base.css` hanya token, typography, button, form, connection, modal, toast, dan safe-area. Setiap stylesheet role hanya mengatur layout role tersebut.

- [ ] **Step 4: Hilangkan tumpang tindih**

Kasir hanya berisi Kasir, Pesanan, Media TV. Owner hanya berisi Ringkasan, Laporan, Kelola, Zona Bahaya. Display hanya antrean dan promo. Tidak ada komponen Owner di Kasir atau sebaliknya.

- [ ] **Step 5: Bersihkan copy**

Gunakan label operasional singkat dan konsisten. Hilangkan emoji dekoratif, komentar visual berlebihan, teks Inggris campur Indonesia, dan shadow/gradient yang tidak membantu hierarki.

- [ ] **Step 6: Verifikasi responsif**

Audit 320, 360, 390, 414, 430, tablet, dan desktop. Tidak boleh ada horizontal overflow; CTA kasir dan modal harus tetap terlihat.

### Task 5: Capacitor Android

**Files:**
- Modify: `package.json`
- Create: `package-lock.json`
- Create: `capacitor.config.json`
- Create: `android/`
- Modify: `.gitignore`

- [ ] **Step 1: Install dependency resmi**

Run:

```bash
npm install @capacitor/core@8.4.2 @capacitor/android@8.4.2 @capacitor/app@8.1.1
npm install -D @capacitor/cli@8.4.2
```

- [ ] **Step 2: Buat config**

Gunakan:

```text
appId: id.maucafe.operations
appName: MAUCAFE Operations
webDir: dist
```

Tidak memakai `server.url`, cleartext production, atau secret frontend.

- [ ] **Step 3: Tambah Android**

Run:

```bash
npm run build:android
npx cap add android
npx cap sync android
```

- [ ] **Step 4: Atur native shell**

Set portrait, app label, safe area, back-button policy, resume refresh, version `0.1.0`, dan release WebView debugging off.

- [ ] **Step 5: Build APK debug**

Run:

```bash
android/gradlew.bat assembleDebug
```

Expected: `android/app/build/outputs/apk/debug/app-debug.apk`.

### Task 6: Printer Readiness

**Files:**
- Create: `public/receipt-model.js`
- Create: `test/receipt-model.test.js`
- Modify: `docs/PLAN_APK_CAPACITOR.md`

- [ ] **Step 1: Tambah failing receipt model test**

Test snapshot struk dari order historis tanpa membaca harga produk saat ini.

- [ ] **Step 2: Implement pure receipt model**

Model mencakup outlet, queue number, timestamp, item snapshot, subtotal, pajak, total diterima, dan metode pembayaran. Tidak ada UI print atau plugin printer.

- [ ] **Step 3: Dokumentasikan extension point**

Printer Bluetooth/USB/LAN tetap fase terpisah setelah model hardware dipilih. Kegagalan print tidak boleh mengubah status transaksi.

### Task 7: Verification dan Completion Audit

**Files:**
- Modify: `README.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/PLAN_APK_CAPACITOR.md`

- [ ] **Step 1: Jalankan seluruh automated test**

Run: `npm test`

Expected: seluruh test PASS.

- [ ] **Step 2: Jalankan build web dan sync**

Run:

```bash
npm run build
npm run build:android
npx cap sync android
```

- [ ] **Step 3: Jalankan Android lint dan APK build**

Run:

```bash
android/gradlew.bat lintDebug assembleDebug
```

- [ ] **Step 4: Smoke test browser**

Verifikasi launcher, Kasir, Owner, Display, order cash/QRIS, call/recall/complete/cancel, laporan, upload validation, logout, offline block, dan reconnect.

- [ ] **Step 5: Audit artifact**

Pastikan APK tersedia, tidak ada PIN/secret/keystore di bundle, tidak ada `server.url`, dan tidak ada HTTP production endpoint.

