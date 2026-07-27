# Rencana Migrasi MAUCAFE ke APK Android dengan Capacitor

Status: **DEBUG APK TERIMPLEMENTASI / RELEASE SIGNING DAN DEVICE FISIK BELUM**  
Target awal: **Android APK untuk Kasir + Owner**  
Teknologi: **Capacitor 8.4.2**  
Backend: **tetap Node.js di server, tidak dimasukkan ke APK**

---

## Status implementasi 24 Juli 2026

Sudah selesai dan terverifikasi:

- launcher lokal untuk memilih Kasir atau Owner;
- konfigurasi backend HTTPS saat first launch;
- native bearer auth yang outlet-scoped;
- lifecycle, network reconnect, dan tombol Back Android;
- web asset lokal tanpa `server.url`;
- UI Kasir/Owner responsif tanpa horizontal overflow pada smoke test 360 px;
- idempotensi create order untuk retry jaringan;
- receipt data model dari snapshot transaksi;
- 52/52 automated tests;
- web build, Capacitor sync, Android lint, dan debug assemble;
- debug APK di `artifacts/MAUCAFE-Operations-0.1.0-debug.apk`.

Belum dapat dianggap release production:

- keystore release milik Owner belum tersedia;
- APK belum dipasang dan diuji pada perangkat Android fisik;
- endpoint production HTTPS belum diberikan;
- adapter printer belum dipilih karena jenis printer belum ditentukan.

---

## 1. Tujuan

Membuat versi Android dari aplikasi MAUCAFE tanpa rewrite total ke Kotlin/Flutter dan tanpa memecah logic bisnis menjadi dua codebase yang berbeda.

Target utama:

- mempertahankan satu basis UI/web logic sebanyak mungkin;
- membuat APK yang nyaman dipakai di HP/tablet Android;
- Kasir dapat login ke outlet dan menjalankan flow order;
- Owner dapat membuka dashboard multi-outlet;
- backend tetap menjadi source of truth untuk order, laporan, auth, dan data outlet;
- APK dapat dibuild ulang secara reproducible dari source project;
- tidak menurunkan security boundary yang sudah diperbaiki di versi web.

Bukan target fase pertama:

- memindahkan server Node.js ke dalam APK;
- membuat mode offline penuh untuk transaksi;
- publish langsung ke Google Play;
- rewrite frontend ke React/Vue/Flutter;
- membuat aplikasi iOS;
- membuat printer Bluetooth sebelum core APK stabil.

---

## 2. Keputusan Arsitektur

### 2.1 Backend tetap terpisah

Arsitektur target:

```text
┌──────────────────────────────┐
│ MAUCAFE Operations APK       │
│ Capacitor + bundled web UI   │
│                              │
│ - Kasir                      │
│ - Owner                      │
└──────────────┬───────────────┘
               │ HTTPS API
               │ SSE / fallback polling
               ▼
┌──────────────────────────────┐
│ MAUCAFE Node.js Server       │
│                              │
│ - Authentication             │
│ - Authorization              │
│ - Orders                     │
│ - Products                   │
│ - Reports                    │
│ - Media                      │
│ - Outlet state               │
└──────────────┬───────────────┘
               ▼
          Data / Database
```

APK **tidak boleh** menjalankan copy server Node.js sendiri.

Alasannya:

- data multi-outlet harus tetap satu sumber;
- laporan Owner tidak boleh terpecah per HP;
- auth dan authorization harus tetap server-side;
- update logic bisnis cukup dilakukan di satu backend.

---

## 3. Rekomendasi Bentuk Aplikasi

### Fase pertama

Buat satu aplikasi:

```text
MAUCAFE Operations
├── Kasir
└── Owner
```

Display TV tetap menggunakan browser/kiosk web yang sekarang.

Alasan:

- kebutuhan Kasir dan Owner sama-sama mobile/tablet;
- Display TV mempunyai kebutuhan berbeda: fullscreen, auto-start, landscape, audio panggilan, dan kiosk mode;
- memisahkan Display mengurangi risiko APK utama menjadi terlalu rumit.

### Fase berikutnya, opsional

Buat APK kedua:

```text
MAUCAFE Display
├── pilih / lock outlet
├── antrean fullscreen
├── promo media
├── voice call
└── kiosk behavior
```

Jangan memaksakan Display TV ke APK Operations pada fase awal.

---

## 4. Kondisi Project Saat Ini yang Harus Dipahami Agent

Project saat ini adalah aplikasi Node.js + HTML/CSS/JavaScript tanpa framework frontend besar.

Entry penting:

```text
src/server.js
public/admin.html
public/admin.js
public/owner.html
public/owner.js
public/display.html
public/display.js
public/sales.js
scripts/build.js
dist/
```

Current build:

```bash
npm run build
```

menghasilkan file statis di `dist/`.

### Masalah penting sebelum Capacitor dapat dipasang secara benar

#### A. `dist/` belum memiliki `index.html`

Capacitor membutuhkan entry web asset berupa `index.html` di root `webDir`.

Saat ini terdapat:

```text
dist/admin.html
dist/owner.html
dist/display.html
```

Tetapi belum ada:

```text
dist/index.html
```

Jadi build harus diubah terlebih dahulu.

#### B. Frontend masih mengasumsikan same-origin

Contoh pola saat ini:

```js
fetch('/api/...')
new EventSource('/api/...')
```

Di browser biasa:

```text
Frontend = https://server-maucafe.com
API      = https://server-maucafe.com/api
```

jadi relative URL bekerja.

Di Capacitor production:

```text
Frontend = bundled di WebView lokal
API      = server HTTPS eksternal
```

Relative `/api/...` tidak otomatis menunjuk server MAUCAFE.

Harus dibuat satu konfigurasi API base URL.

#### C. Routing outlet masih membaca `window.location.pathname`

Contoh Admin dan Display membaca outlet dari URL:

```text
/outlet/<outlet-id>/admin
```

APK bundled tidak sebaiknya bergantung pada route server seperti itu.

APK perlu menyimpan outlet yang dipilih/di-lock secara eksplisit.

#### D. `owner.js` masih memakai absolute module import

Contoh:

```js
import { summarizeSales } from '/sales.js';
```

Untuk web bundle lokal Capacitor, absolute path seperti ini harus diaudit dan dibuat kompatibel dengan asset lokal.

Target lebih aman:

```js
import { summarizeSales } from './sales.js';
```

atau hasil build yang mengatur path dengan benar.

#### E. Auth web saat ini berbasis cookie session

Cookie sekarang sengaja diperketat untuk web, termasuk `SameSite=Strict`.

Saat frontend APK berjalan dari origin WebView lokal dan backend berada di origin HTTPS lain, model auth harus ditinjau ulang.

Jangan melemahkan cookie secara sembarangan hanya supaya APK bisa login.

---

# 5. Prinsip Implementasi

Agent yang mengimplementasikan APK wajib mengikuti aturan berikut.

## 5.1 Jangan gunakan `server.url` sebagai arsitektur production

Capacitor mempunyai opsi untuk memuat URL eksternal ke WebView, tetapi itu ditujukan terutama untuk live reload/development.

Production target harus:

```text
bundle frontend ke dalam APK
+
akses backend melalui HTTPS API
```

Bukan:

```text
APK = WebView yang cuma membuka website remote menggunakan server.url
```

Live reload boleh digunakan saat development saja.

---

## 5.2 Jangan aktifkan HTTP cleartext di production

Production API wajib HTTPS.

Jangan mengatasi error koneksi dengan:

```text
cleartext = true
allowMixedContent = true
```

kecuali hanya pada profile development lokal yang jelas terpisah dari release.

---

## 5.3 Backend tetap source of truth

APK tidak boleh menentukan sendiri:

- harga final;
- pajak;
- HPP;
- role;
- izin outlet;
- status transaksi final.

Server tetap menghitung dan memvalidasi.

---

# 6. Struktur Target Setelah Migrasi

Rekomendasi struktur:

```text
project-root/
├── android/                  # generated Capacitor Android project
├── public/
├── src/
├── dist/
│   ├── index.html            # app launcher
│   ├── admin.html
│   ├── owner.html
│   ├── display.html
│   ├── *.js
│   └── base.css + role CSS
├── mobile/
│   ├── config.js             # runtime/build environment config
│   ├── api-client.js         # central API wrapper
│   ├── auth-client.js        # native/web auth abstraction
│   └── app-router.js         # launcher/navigation
├── docs/
│   └── PLAN_APK_CAPACITOR.md
├── capacitor.config.*
└── package.json
```

Nama folder boleh disesuaikan, tetapi fungsi harus tetap terpisah dengan jelas.

---

# 7. Fase 0 - Persiapan dan Baseline

Sebelum install Capacitor:

1. Buat branch/backup khusus.
2. Jalankan:

```bash
npm test
npm run build
```

3. Pastikan baseline tetap:

```text
52/52 test PASS
build PASS
```

4. Catat versi:

```bash
node --version
npm --version
```

5. Jangan upgrade dependency lain secara acak pada tahap ini.

---

## 7.1 Node.js requirement

Project web saat ini mendeklarasikan:

```json
"node": ">=22"
```

Capacitor major yang digunakan saat implementasi harus dicek terhadap requirement resmi saat itu.

Per dokumentasi Capacitor v8 yang digunakan saat dokumen ini dibuat, toolchain Capacitor v8 membutuhkan Node.js 22+.

Jika memilih Capacitor v8:

- development/build environment harus Node 22+;
- server runtime dapat dievaluasi terpisah, tetapi lebih sederhana jika project distandardisasi ke Node 22 LTS+ setelah semua test lulus;
- jangan sekadar mengganti `package.json` tanpa benar-benar menguji server.

Acceptance:

```text
npm test PASS di Node target
npm run build PASS di Node target
```

---

# 8. Fase 1 - Buat Build Web yang Siap Dibundle

Ini harus dilakukan **sebelum** `npx cap add android` dianggap selesai.

## 8.1 Tambahkan `dist/index.html`

Buat launcher aplikasi.

Contoh flow:

```text
App Start
   ↓
Apakah ada session / mode tersimpan?
   ├── belum → Landing / pilih Kasir atau Owner
   ├── Kasir → pilih / restore outlet → Admin UI
   └── Owner → Owner Login
```

Jangan langsung hardcode ke outlet BSD.

---

## 8.2 Tentukan navigation model

Rekomendasi fase pertama:

```text
/index.html
    ↓
[Masuk sebagai Kasir]
[Masuk sebagai Owner]
```

Kasir:

```text
Pilih outlet
↓
Masukkan PIN Kasir
↓
Simpan outlet terakhir secara lokal
↓
Buka Admin UI
```

Owner:

```text
Masukkan PIN Owner
↓
Dashboard semua outlet
```

Catatan:

- daftar outlet harus berasal dari endpoint publik yang aman atau config deployment;
- jangan expose informasi finansial saat mengambil daftar outlet;
- kemampuan memilih outlet untuk Kasir harus mengikuti policy bisnis. Jika tablet dikunci ke satu outlet, buat device/outlet binding pada fase lanjutan.

---

# 9. Fase 2 - API Client Abstraction

Saat ini frontend memanggil API secara langsung di banyak tempat.

Harus dibuat satu sumber konfigurasi.

Contoh konsep:

```js
export const APP_CONFIG = {
  apiBaseUrl: 'https://api.example.com',
};
```

Lalu:

```js
apiUrl('/api/owner/login')
apiUrl(`/api/outlet/${outletId}/admin/state`)
```

Jangan melakukan search-replace URL secara buta.

---

## 9.1 Environment

Minimal punya:

```text
development
staging
production
```

Contoh:

```text
Development:
http://192.168.x.x:3000

Staging:
https://staging-api.example.com

Production:
https://api.example.com
```

HTTP LAN hanya untuk development.

Release production wajib HTTPS.

---

## 9.2 API wrapper

Buat helper sentral untuk:

- base URL;
- JSON parsing;
- error normalization;
- auth header/cookie strategy;
- timeout jika diperlukan;
- connectivity handling.

Jangan duplikasi logic fetch di setiap page jika migrasi sudah dimulai.

---

# 10. Fase 3 - Authentication untuk APK

Ini bagian yang **tidak boleh ditebak**.

Current web auth menggunakan session cookie.

Untuk native/bundled frontend, tentukan auth strategy yang stabil.

## Opsi yang direkomendasikan

Tambahkan mode token/session API khusus native yang tetap divalidasi server.

Concept:

```text
POST /api/native/admin/login
PIN + outlet
↓
server validates
↓
short-lived access token
+
refresh/session mechanism
```

Owner serupa:

```text
POST /api/native/owner/login
```

Token harus:

- dibuat server;
- memiliki role;
- memiliki outlet scope untuk Kasir;
- expiry;
- dapat direvoke;
- tidak berisi PIN;
- tidak memberikan Owner scope kepada Kasir.

---

## 10.1 Jangan menyimpan PIN

APK tidak boleh menyimpan:

```text
1111
1234
PIN user
```

untuk auto-login.

Jika ingin "ingat login", simpan credential session/token yang aman, bukan PIN mentah.

---

## 10.2 Storage credential

Jangan anggap `localStorage` sebagai secure credential store.

Jika persistent auth token benar-benar diperlukan:

- gunakan mekanisme secure storage/keystore yang sesuai;
- evaluasi plugin terlebih dahulu;
- jangan menambah plugin random tanpa audit maintenance/security.

Fase MVP dapat memilih session pendek dan meminta login ulang jika secure storage belum ditentukan.

---

# 11. Fase 4 - SSE / Realtime

Current app menggunakan:

```text
EventSource (SSE)
+
polling fallback
```

Ini boleh dipertahankan jika bekerja stabil dalam Android WebView.

Agent wajib test:

```text
Wi-Fi stabil
Wi-Fi putus
Wi-Fi reconnect
app background 30 detik
app background beberapa menit
screen lock/unlock
switch jaringan Wi-Fi → mobile data
```

Jika SSE mati setelah resume:

```text
App resume
↓
close stale EventSource
↓
reload state
↓
reconnect EventSource
```

Jangan langsung mengganti seluruh sistem ke WebSocket tanpa bukti SSE tidak cukup.

---

# 12. Fase 5 - Install Capacitor

Lakukan setelah Fase 1-4 foundation jelas.

Perintah dasar, sesuaikan major version yang dipilih:

```bash
npm install @capacitor/core
npm install -D @capacitor/cli
npm install @capacitor/android
```

Initialize:

```bash
npx cap init
```

Config minimal concept:

```text
appName: MAUCAFE Operations
appId: harus memakai reverse-domain ID yang benar-benar dipilih pemilik project
webDir: dist
```

Jangan memakai contoh app ID palsu sebagai final release.

Contoh placeholder saja:

```text
com.company.maucafe.operations
```

Setelah config benar:

```bash
npx cap add android
npm run build
npx cap sync android
```

Open native project:

```bash
npx cap open android
```

---

# 13. Fase 6 - Android Native Shell

Atur minimal:

- application name;
- app icon;
- adaptive icon;
- splash screen;
- orientation policy;
- status/navigation/system bars;
- theme;
- versionCode/versionName;
- package/application ID.

---

## 13.1 Orientation

MAUCAFE Operations:

Rekomendasi:

```text
phone: portrait primary
large tablet: responsive
```

Jangan paksa landscape kecuali hasil test operasional membuktikan lebih baik.

Display TV nanti berbeda dan kemungkinan landscape-only.

---

## 13.2 Safe area

Test perangkat:

- punch hole;
- notch;
- gesture navigation;
- 3-button navigation;
- status bar tinggi berbeda.

UI tidak boleh tertutup system bar.

---

# 14. Fase 7 - Mobile UX Khusus APK

Web responsive yang ada adalah baseline, bukan akhir.

Audit ulang:

```text
320 px
360 px
390 px
414 px
430 px
small tablet
large tablet
```

APK-specific checks:

- keyboard membuka input PIN tanpa menutup tombol submit;
- sticky cart tidak tertutup keyboard/navigation bar;
- modal tidak keluar layar;
- back button Android tidak langsung menutup app saat modal terbuka;
- scroll position tidak rusak setelah rotate/resume;
- tap target cukup besar.

---

# 15. Android Back Button Policy

Definisikan jelas:

```text
Jika modal terbuka
→ tutup modal

Jika berada di subview
→ kembali ke view sebelumnya

Jika berada di root app
→ Android default/back-to-background policy
```

Jangan membuat tombol Back selalu menutup APK.

---

# 16. Connectivity UX

APK harus punya state jelas:

```text
ONLINE
CONNECTING
OFFLINE
SESSION EXPIRED
SERVER ERROR
```

Kasir tidak boleh melihat toast "berhasil" sebelum server benar-benar menyimpan order.

Saat offline:

```text
Create order
→ BLOCK
→ tampilkan pesan "Koneksi terputus. Pesanan belum tersimpan."
```

Jangan membuat offline transaction queue pada MVP kecuali dirancang dengan idempotency dan conflict resolution.

---

# 17. Upload Media di APK

Owner dapat memiliki kebutuhan upload image/video dari HP.

Test:

- pilih file dari storage;
- Android permission behavior;
- file terlalu besar;
- format tidak didukung;
- upload terputus;
- progress state;
- retry.

Backend security existing tetap berlaku:

- auth;
- role;
- max size;
- signature validation;
- generated filename;
- cleanup.

Jangan bypass validation hanya karena request berasal dari APK.

---

# 18. Fitur Native yang Boleh Ditambahkan Setelah Core Stabil

Prioritas rasional:

## P1

- app icon + splash;
- network status integration;
- haptic ringan untuk success/error penting;
- keep-awake hanya jika dibutuhkan mode tertentu.

## P2

- push notification penting untuk Owner;
- biometric unlock sebagai convenience layer setelah auth yang benar;
- share/export laporan melalui Android share sheet.

## P3

- printer thermal Bluetooth;
- QR/barcode scanner;
- dedicated kiosk/display APK.

Jangan install semua plugin pada hari pertama.

---

# 19. Printer Thermal, Fase Terpisah

Jangan campur implementasi printer dengan migrasi Capacitor pertama.

Printer membutuhkan keputusan sendiri:

```text
USB?
Bluetooth Classic?
BLE?
LAN?
ESC/POS?
model printer apa?
```

Baru pilih library/plugin setelah hardware target diketahui.

Acceptance printer nanti:

- test device fisik;
- reconnect;
- duplicate print protection;
- print failure tidak mengubah order menjadi gagal jika transaksi sudah tersimpan.

---

# 20. Security Checklist APK

Sebelum release internal:

```text
[ ] API production HTTPS
[ ] tidak ada production cleartext
[ ] tidak ada hardcoded PIN
[ ] tidak ada hardcoded production secret di JS/APK
[ ] Kasir tetap outlet-scoped
[ ] Owner endpoint tetap Owner-only
[ ] token/session expire dengan benar
[ ] logout revoke/clear session lokal
[ ] file upload tetap divalidasi server
[ ] CSP/web security tidak dilemahkan tanpa alasan
[ ] WebView debugging off di release
[ ] release build tidak log credential/token
[ ] APK signed dengan keystore release
[ ] keystore tidak masuk Git
```

Catatan:

Semua JavaScript/assets yang dibundel dalam APK pada akhirnya dapat diekstrak oleh pihak yang memiliki file APK.

Karena itu:

```text
JANGAN simpan secret server di frontend.
```

---

# 21. Build Pipeline

Target command development:

```bash
npm test
npm run build
npx cap sync android
```

Kemudian Android Studio / Gradle untuk run debug.

Sebelum release:

```text
1. test
2. build web
3. cap sync
4. native test
5. signed release build
6. install APK pada device fisik
7. smoke test production/staging API
```

Jangan build APK dari asset `dist/` lama.

Setiap perubahan frontend sebelum native build wajib:

```bash
npm run build
npx cap sync android
```

---

# 22. Output Build

Untuk distribusi internal/manual:

```text
APK
```

Untuk Google Play jika nanti diperlukan:

```text
AAB release
```

Signing key harus disimpan aman.

Jangan kehilangan release keystore karena update aplikasi berikutnya bergantung pada signing identity yang konsisten.

---

# 23. Testing Matrix

## 23.1 Device class

Minimal:

```text
Android phone kecil
Android phone modern
Android tablet
```

Tidak cukup emulator saja.

---

## 23.2 Flow Kasir

```text
[ ] pilih outlet
[ ] login kasir
[ ] reload/restart app
[ ] buat order cash
[ ] buat order QRIS
[ ] call
[ ] recall
[ ] complete
[ ] cancel + Owner approval
[ ] offline saat submit
[ ] reconnect
[ ] session expired
```

---

## 23.3 Flow Owner

```text
[ ] login owner
[ ] semua outlet
[ ] pilih outlet
[ ] laporan
[ ] filter tanggal
[ ] product CRUD
[ ] ganti PIN
[ ] upload media
[ ] danger zone confirmation
[ ] logout
```

---

## 23.4 Lifecycle Android

```text
[ ] cold start
[ ] background → foreground
[ ] screen lock → unlock
[ ] process killed Android → reopen
[ ] orientation behavior
[ ] low/no internet
[ ] Wi-Fi change
```

---

# 24. Automated Test yang Harus Tetap Lulus

Existing backend/web tests tidak boleh dikorbankan.

Baseline terverifikasi setelah implementasi:

```text
52/52 automated tests PASS
```

Tambah test baru untuk:

- API base URL helper;
- native auth session behavior;
- outlet selection persistence non-sensitive;
- route/launcher logic;
- environment config validation.

Jangan menghapus security test untuk membuat APK lebih mudah terhubung.

---

# 25. Deployment Strategy

## Development lokal

```text
Android device
↓ Wi-Fi LAN
Development Node server
```

Boleh menggunakan HTTP lokal hanya pada profile development jika memang diperlukan dan dikonfigurasi khusus.

Jangan membawa konfigurasi cleartext development ke release.

---

## Staging

```text
APK staging
↓ HTTPS
staging server
↓
test data
```

Gunakan staging untuk test sebelum production.

---

## Production

```text
Signed APK / AAB
↓ HTTPS
Production API
```

Production endpoint jangan dapat diubah sembarang user dari UI biasa.

---

# 26. Versioning

Pisahkan versi web/app dengan jelas.

Contoh:

```text
Web/backend: 0.2.0
Android app: 0.1.0
```

Atau satu release version jika deploy selalu bersamaan.

Setiap Android release:

```text
versionName naik
versionCode naik
```

Catat compatibility backend minimum jika suatu saat API berubah.

---

# 27. API Compatibility

Sebelum app dipakai banyak outlet, pertimbangkan endpoint:

```text
GET /api/version
```

Response concept:

```json
{
  "apiVersion": 1,
  "minimumAppVersion": "0.1.0"
}
```

Tujuan:

mencegah APK lama diam-diam rusak ketika backend berubah besar.

Jangan implement auto-block tanpa desain UX yang jelas.

---

# 28. Rencana Eksekusi Prioritas

## P0 - Foundation

```text
1. Upgrade/test Node toolchain jika Capacitor major membutuhkan.
2. Tambah dist/index.html launcher.
3. Audit absolute path asset/import.
4. Buat API base abstraction.
5. Tentukan auth native yang benar.
6. Pastikan backend HTTPS/CORS/auth siap.
```

Tidak boleh lompat ke build release sebelum P0 selesai.

---

## P1 - Capacitor Android Skeleton

```text
1. Install Capacitor packages.
2. cap init.
3. Set webDir=dist.
4. cap add android.
5. cap sync.
6. Android Studio debug build.
7. Test launcher → Kasir/Owner.
```

---

## P2 - Device Behavior

```text
1. Safe area.
2. Keyboard.
3. Android Back.
4. Resume/reconnect SSE.
5. Network state.
6. Upload media.
7. session expiry.
```

---

## P3 - Branding & Release Internal

```text
1. icon.
2. splash.
3. app name/package ID final.
4. signing keystore.
5. signed APK.
6. test 2-3 device fisik.
7. pilot outlet.
```

---

## P4 - Enhancement

```text
notification
biometric convenience
share/export
printer
scanner
separate Display APK
Play Store/AAB
```

---

# 29. Definition of Done - APK MVP

APK MVP dianggap selesai hanya jika:

```text
[ ] install di Android tanpa dev server frontend
[x] frontend assets dibundle lokal
[x] backend diakses via configured HTTPS API
[x] login Kasir bekerja pada browser smoke test dan API native test
[x] outlet scope aman
[x] login Owner bekerja pada browser smoke test dan API native test
[x] create order bekerja
[x] call/complete/cancel bekerja
[x] dashboard Owner bekerja
[ ] upload media bekerja atau sengaja ditunda dan didokumentasikan
[x] reconnect setelah background diimplementasikan
[x] offline/retry tidak menciptakan order duplikat
[x] tidak ada horizontal overflow mobile pada browser smoke test
[ ] keyboard tidak menutupi critical CTA
[x] existing 52 tests tetap pass
[ ] APK release signed
[ ] smoke test device fisik pass
```

---

# 30. Hal yang Dilarang untuk Agent

Agent tidak boleh:

- menggunakan `server.url` remote sebagai solusi production permanen;
- menyalakan cleartext/mixed content production hanya karena API gagal;
- menghapus `SameSite`/security protection tanpa mengganti auth architecture dengan benar;
- hardcode PIN/API secret ke APK;
- memasukkan backend Node ke APK sebagai shortcut;
- mengubah seluruh frontend ke framework baru hanya untuk memakai Capacitor;
- menambah 10 plugin native sebelum core flow stabil;
- menganggap emulator = cukup untuk release;
- menurunkan security test agar build native lolos;
- membuat offline order sync tanpa idempotency/conflict design;
- commit keystore/password signing ke repository.

---

# 31. Rekomendasi Final

Untuk project ini, jalur yang disarankan adalah:

```text
CURRENT WEB APP
      ↓
rapikan build agar Capacitor-ready
      ↓
API base + native auth abstraction
      ↓
bundle Kasir + Owner ke MAUCAFE Operations APK
      ↓
backend tetap Node.js HTTPS
      ↓
pilot internal
      ↓
baru tambah fitur native
```

Jangan mulai dari "buat APK dulu".

Mulai dari membuat **frontend dan auth architecture siap hidup di origin yang berbeda dari backend**.

Itu bagian paling penting dalam migrasi ini.

---

# 32. Referensi Teknis Saat Dokumen Dibuat

Dokumen ini disusun dengan acuan dokumentasi resmi Capacitor v8 yang tersedia saat penulisan.

Referensi utama:

- Capacitor - Environment Setup: https://capacitorjs.com/docs/getting-started/environment-setup
- Capacitor - Installing Capacitor: https://capacitorjs.com/docs/getting-started
- Capacitor - Configuration: https://capacitorjs.com/docs/config
- Capacitor - Android: https://capacitorjs.com/docs/android

Sebelum implementasi aktual, cek kembali versi Capacitor terbaru dan requirement toolchain. Jangan upgrade major version secara otomatis hanya karena `latest` tersedia.

---

END OF PLAN
