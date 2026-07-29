# MAUCAFE Franchise Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mengubah MVP multi-outlet menjadi sistem operasi franchise satu-server yang mendukung SQLite, Owner, Mitra, Karyawan, outlet dinamis, shift, rekonsiliasi kas, cup, biaya, laporan profit bersih, dan playlist display.

**Architecture:** Pertahankan satu Node.js HTTP server dan fungsi domain murni yang sudah ada. Ganti persistence runtime dari file JSON per outlet menjadi satu SQLite WAL database melalui adapter store yang mempertahankan kontrak `get()`/`update()`, lalu migrasikan JSON lama sekali tanpa menghapus sumbernya. Tambahkan domain operasi franchise sebagai data terstruktur di state outlet dan registry global; authorization tetap diputuskan server-side.

**Tech Stack:** Node.js 24/22+, built-in `node:sqlite`, HTTP/SSE, HTML/CSS/ES modules, Node test runner, Capacitor Android.

---

### Task 1: SQLite persistence dan migrasi JSON

**Files:**
- Create: `src/sqlite-store.js`
- Create: `test/sqlite-store.test.js`
- Modify: `src/server.js`
- Modify: `docs/ARCHITECTURE.md`

- [x] Tulis test yang membuktikan SQLite store membuat schema, meng-clone state, men-serialize update concurrent, menyimpan audit append-only, dan memigrasikan registry/security/outlet JSON tanpa mengubah file lama.
- [x] Jalankan `node --test test/sqlite-store.test.js` dan pastikan gagal karena modul belum ada.
- [x] Implementasikan `SqliteDatabase` dan `SqliteStore` dengan tabel `app_state`, `audit_log`, `schema_migrations`, WAL, foreign keys, busy timeout, serta transaksi sinkron.
- [x] Tambahkan bootstrap `data/maucafe.sqlite`; baca JSON hanya ketika key SQLite belum ada.
- [x] Jalankan test SQLite, lalu `npm test`.

### Task 2: State schema franchise dan rollover hari

**Files:**
- Modify: `src/queue.js`
- Modify: `test/queue.test.js`
- Modify: `data/state.example.json`

- [x] Tulis test gagal untuk migrasi schema baru, expiry pesanan aktif hari sebelumnya, reset nomor ke `1`, pembersihan active call, dan `complete` yang membersihkan panggilan order terkait.
- [x] Implementasikan `rolloverBusinessDay()` dan field state `shifts`, `operationalEntries`, `inventoryMovements`, serta `mediaPlaylist`.
- [x] Tandai order lama `expired` dengan alasan sistem; jangan hapus histori dan jangan reset `nextCallEventId`.
- [x] Jalankan `node --test test/queue.test.js`, lalu `npm test`.

### Task 3: Shift, kas, biaya, dan cup

**Files:**
- Create: `src/operations.js`
- Create: `test/operations.test.js`
- Modify: `src/queue.js`

- [x] Tulis test gagal untuk buka shift, larangan dua shift aktif, shift kedaluwarsa, pencatatan aktor, tutup shift, selisih wajib beralasan, cash in/out/setoran, biaya operasional, dan ledger cup.
- [x] Implementasikan validasi safe integer/range dan fungsi domain murni `openShift`, `closeShift`, `forceCloseShift`, `recordOperationalEntry`, `recordInventoryMovement`, `inventorySummary`.
- [x] Tambahkan `shiftId`, `employeeId`, dan `employeeName` ke order dari konteks server; client tidak boleh menentukan identitas sendiri.
- [x] Jalankan `node --test test/operations.test.js test/queue.test.js`, lalu `npm test`.

### Task 4: Laporan keuangan sampai profit bersih

**Files:**
- Modify: `public/sales.js`
- Modify: `test/sales.test.js`
- Create: `src/report-export.js`
- Create: `test/report-export.test.js`
- Modify: `src/server.js`

- [x] Tulis test gagal agar transaksi cancelled/expired tidak dihitung, filter shift bekerja, HPP snapshot tetap historis, biaya operasional mengurangi laba kotor, dan hasil memiliki `netProfit`.
- [x] Implementasikan ringkasan `Penjualan Bersih`, `Pajak Terkumpul`, `Total Diterima`, `Total HPP`, `Laba Kotor`, `Biaya Operasional`, dan `Profit Bersih`.
- [x] Pindahkan pembentukan XLS ke helper yang dipakai laporan outlet, Mitra, dan Owner tanpa duplikasi label lama `Total Profit`.
- [x] Jalankan test laporan, lalu `npm test`.

### Task 5: Registry Mitra, Karyawan, dan outlet dinamis

**Files:**
- Create: `src/franchise.js`
- Create: `test/franchise.test.js`
- Modify: `src/server.js`
- Modify: `test/server.test.js`

- [x] Tulis test gagal untuk membuat Mitra/Karyawan dengan hash PIN, scope outlet, outlet pending, approval Owner, slug unik, serta penolakan akses lintas Mitra/outlet.
- [x] Implementasikan registry global `partners`, `users`, dan `outlets`; credential hanya menyimpan hash.
- [x] Tambahkan session Mitra dan identitas Karyawan ke session Admin; pertahankan login PIN outlet legacy sebagai akun bootstrap agar deployment lama tidak terkunci.
- [x] Tambahkan API Owner untuk CRUD Mitra/Karyawan terbatas, approval outlet, dan audit log.
- [x] Tambahkan API Mitra untuk dashboard outlet miliknya, pengajuan outlet, Karyawan, shift, cup, biaya, dan media.
- [x] Saat outlet disetujui, buat store SQLite dan channel SSE saat runtime tanpa restart atau HTML baru.
- [x] Jalankan `node --test test/franchise.test.js test/server.test.js`, lalu `npm test`.

### Task 6: API shift dan dashboard harian Kasir

**Files:**
- Modify: `src/server.js`
- Modify: `test/server.test.js`
- Modify: `scripts/test-live-flow.js`

- [x] Tulis test gagal bahwa order ditolak tanpa shift aktif, aktor tidak dapat dipalsukan, Kasir hanya melihat outlet sendiri, dan daily summary berisi produk, Tunai, QRIS, serta pendapatan hari itu tanpa HPP/profit.
- [x] Tambahkan endpoint buka/tutup shift, force-close Mitra/Owner, operational entry, inventory movement, dan ringkasan dengan authorization server-side.
- [x] Jalankan server test dan smoke multi-outlet.

### Task 7: Master menu Owner dan foto produk

**Files:**
- Modify: `src/queue.js`
- Modify: `src/server.js`
- Modify: `test/server.test.js`
- Modify: `public/admin.js`
- Modify: `public/admin.css`
- Modify: `public/owner.html`
- Modify: `public/owner.js`

- [x] Tulis test gagal bahwa perubahan produk Owner berlaku ke seluruh outlet dan outlet baru, Mitra/Karyawan ditolak, foto hanya menerima signature gambar valid, dan hash/HPP tidak bocor ke public/Kasir.
- [x] Jadikan katalog Owner sebagai master yang disinkronkan transaksi-safe ke semua outlet.
- [x] Tambahkan `imageUrl` dan `cupUsage` pada produk; upload gambar memakai nama generated, size limit, signature, cleanup, dan audit.
- [x] Tampilkan foto/fallback pada kartu produk Kasir dan pengelolaan menu Owner tanpa `innerHTML` dinamis.
- [x] Jalankan server dan UI contract test.

### Task 8: Playlist media dan display fullscreen adaptif

**Files:**
- Create: `src/media.js`
- Create: `test/media.test.js`
- Modify: `src/queue.js`
- Modify: `src/server.js`
- Modify: `public/display.html`
- Modify: `public/display.js`
- Modify: `public/display.css`
- Modify: `test/ui-contract.test.js`

- [x] Tulis test gagal untuk parser durasi MP4, maksimal lima video, durasi video maksimal 120 detik, durasi foto, urutan playlist, penghapusan item, serta Range request.
- [x] Implementasikan playlist per outlet; gambar tidak masuk limit video, video non-MP4 atau durasi tak terbaca ditolak.
- [x] Layani media dengan byte-range, ETag/Last-Modified, dan cache publik; jangan baca video penuh ke RAM.
- [x] Display fullscreen saat idle, split hanya ketika ada active call, pause/mute iklan saat suara panggilan, lalu lanjutkan item dari posisi terakhir.
- [x] Selesai order menghapus active call sehingga display kembali fullscreen.
- [x] Jalankan media, server, dan UI test.

### Task 9: UI Mitra dan integrasi role

**Files:**
- Create: `public/partner.html`
- Create: `public/partner.js`
- Create: `public/partner.css`
- Modify: `public/index.html`
- Modify: `public/admin.html`
- Modify: `public/admin.js`
- Modify: `public/admin.css`
- Modify: `public/owner.html`
- Modify: `public/owner.js`
- Modify: `public/owner.css`
- Modify: `scripts/build.js`
- Modify: `test/ui-contract.test.js`

- [x] Tulis contract test gagal untuk halaman Mitra, login Karyawan bernama, shift, ringkasan harian, outlet pending, approval Owner, Karyawan, cup, biaya, dan playlist.
- [x] Implementasikan UI fungsional memakai tema merah/krem saat ini dan DOM API aman.
- [x] Pastikan satu `admin.html`/`display.html` tetap dipakai semua outlet dinamis.
- [x] Jalankan UI contract, build web, dan build Android.

### Task 10: Backup, restore, dan service server kantor

**Files:**
- Create: `scripts/backup-database.mjs`
- Create: `scripts/restore-database.mjs`
- Create: `scripts/install-windows-service.ps1`
- Create: `scripts/uninstall-windows-service.ps1`
- Create: `test/local-server-ops.test.js`
- Modify: `package.json`
- Modify: `README.md`
- Modify: `docs/ARCHITECTURE.md`

- [x] Tulis test gagal untuk backup konsisten SQLite, restore dengan validasi schema, dan kontrak Scheduled Task Windows tanpa credential plaintext.
- [x] Implementasikan backup memakai SQLite `VACUUM INTO`, restore atomik dengan backup file lama, dan service startup memakai Task Scheduler.
- [x] Dokumentasikan LAN/HTTPS/VPN, lokasi database, backup harian, restore drill, dan penghapusan opsi hosting publik.
- [x] Jalankan ops test, `npm test`, dan `npm run build`.

### Task 11: Bug log, migrasi runtime, dan verifikasi akhir

**Files:**
- Modify: `docs/ERROR_SOLUTIONS.md`
- Modify: `docs/WORKLOG.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `README.md`

- [x] Catat setiap bug aktual yang ditemukan dengan gejala, root cause, solusi, dan bukti verifikasi.
- [x] Jalankan migrasi terhadap salinan data aktual dan buktikan JSON sumber tidak berubah.
- [x] Jalankan `npm test`.
- [x] Jalankan `npm run build`.
- [x] Jalankan `npm run build:android`.
- [x] Jalankan smoke test HTTP terhadap root, Owner, Mitra, outlet Admin/Display, asset nested, auth, shift, order, rollover, laporan, playlist, dan Range media.
- [x] Periksa `git diff -- docs/ERROR_SOLUTIONS.md`, `git diff --check`, credential plaintext, dynamic `innerHTML`, dan status git.
- [x] Cocokkan seluruh requirement sesi dengan implementasi dan laporkan batas verifikasi perangkat fisik secara jujur.
