# Local Queue MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membuat demo lokal yang memungkinkan HP/tablet mengelola menu dan pesanan, sementara laptop/Smart TV menampilkan nomor panggilan dan promo secara otomatis.

**Architecture:** Satu proses Node.js melayani halaman `/admin`, `/display`, REST API, dan Server-Sent Events. State disimpan atomik ke satu file JSON agar refresh atau restart server tidak menghilangkan antrean. UI memakai HTML, CSS, dan JavaScript tanpa framework agar dependency dan setup tetap minimum.

**Tech Stack:** Node.js 24, `node:http`, `node:test`, HTML, CSS, JavaScript, Server-Sent Events, JSON file storage.

---

## Struktur file

- `package.json`: perintah start, test, dan build.
- `src/queue.js`: aturan nomor harian, total transaksi, dan perubahan status pesanan.
- `src/store.js`: baca/tulis state JSON secara atomik.
- `src/server.js`: static server, REST API, dan SSE.
- `public/admin.html`: struktur panel admin.
- `public/admin.js`: kasir, pesanan, menu, dan status koneksi.
- `public/display.html`: struktur display pelanggan.
- `public/display.js`: pembaruan state, rotasi promo, dan text-to-speech.
- `public/styles.css`: layout sentuh 360x800 dan display 1920x1080.
- `data/state.example.json`: data awal yang dapat disalin untuk reset demo.
- `scripts/build.js`: validasi file wajib dan salin aset ke `dist`.
- `test/queue.test.js`: aturan domain antrean.
- `test/store.test.js`: persistensi dan pemulihan state.
- `test/server.test.js`: alur API admin ke display.

### Task 1: Aturan antrean dan transaksi

**Files:**
- Create: `package.json`
- Create: `src/queue.js`
- Create: `test/queue.test.js`

- [x] **Step 1: Tulis tes gagal** untuk format nomor `001`, reset berdasarkan tanggal WIB, snapshot harga, total, panggil ulang tanpa order baru, selesai, batal, dan reset.
- [x] **Step 2: Jalankan** `npm test -- test/queue.test.js` dan pastikan gagal karena `src/queue.js` belum tersedia.
- [x] **Step 3: Implementasikan fungsi murni** `createInitialState`, `createOrder`, `callOrder`, `completeOrder`, `cancelOrder`, dan `resetQueue` dengan validasi input.
- [x] **Step 4: Jalankan kembali** `npm test -- test/queue.test.js` dan pastikan seluruh tes lulus.

### Task 2: Persistensi state

**Files:**
- Create: `src/store.js`
- Create: `data/state.example.json`
- Create: `test/store.test.js`

- [x] **Step 1: Tulis tes gagal** yang membuktikan state awal dibuat, perubahan tersimpan, dan instance baru membaca nomor aktif yang sama.
- [x] **Step 2: Jalankan** `npm test -- test/store.test.js` dan pastikan gagal karena store belum tersedia.
- [x] **Step 3: Implementasikan** `JsonStore` dengan antrean penulisan serta pola temporary-file lalu rename.
- [x] **Step 4: Jalankan kembali** tes store dan seluruh suite.

### Task 3: API dan sinkronisasi display

**Files:**
- Create: `src/server.js`
- Create: `test/server.test.js`

- [x] **Step 1: Tulis tes gagal** untuk `GET /api/state`, pembuatan order, panggil, panggil ulang, selesai, batal, reset, CRUD produk, respons input salah, dan route halaman.
- [x] **Step 2: Jalankan** `npm test -- test/server.test.js` dan pastikan gagal karena server belum tersedia.
- [x] **Step 3: Implementasikan** server HTTP, parser JSON berbatas ukuran, pemetaan error, dan endpoint SSE `/api/events`.
- [x] **Step 4: Jalankan kembali** tes API dan seluruh suite.

### Task 4: Panel admin sentuh

**Files:**
- Create: `public/admin.html`
- Create: `public/admin.js`
- Create: `public/styles.css`

- [x] **Step 1: Tambahkan tes kontrak gagal** yang memeriksa elemen kasir, pesanan, menu, indikator koneksi, konfirmasi reset, serta tombol minimal 44px.
- [x] **Step 2: Jalankan** tes kontrak dan pastikan gagal karena aset belum ada.
- [x] **Step 3: Implementasikan** tiga tab admin, keranjang, pembayaran Tunai/QRIS, tindakan pesanan, CRUD menu, disabled-state selama request, dan pesan error terlihat.
- [x] **Step 4: Jalankan kembali** tes kontrak serta seluruh suite.

### Task 5: Display 16:9 dan suara

**Files:**
- Create: `public/display.html`
- Create: `public/display.js`
- Modify: `public/styles.css`

- [x] **Step 1: Tambahkan tes kontrak gagal** untuk area antrean 34%, nomor aktif, area promo, status koneksi, tombol aktivasi suara, dan penggunaan SSE.
- [x] **Step 2: Jalankan** tes kontrak dan pastikan gagal karena display belum tersedia.
- [x] **Step 3: Implementasikan** layout dua kolom, rotasi menu aktif, reconnect SSE, mempertahankan state terakhir, dan text-to-speech Bahasa Indonesia.
- [x] **Step 4: Jalankan kembali** tes kontrak dan seluruh suite.

### Task 6: Build, dokumentasi, dan verifikasi dua layar

**Files:**
- Create: `scripts/build.js`
- Modify: `package.json`
- Modify: `README.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/WORKLOG.md`
- Modify: `docs/ERROR_SOLUTIONS.md` hanya jika error terverifikasi ditemukan.

- [x] **Step 1: Implementasikan build** yang membersihkan `dist`, memvalidasi file wajib, lalu menyalin aset publik.
- [x] **Step 2: Dokumentasikan** setup, alamat lokal, alamat jaringan HP, reset data, dan batas demo versus produksi.
- [x] **Step 3: Jalankan** `npm test` dan `npm run build`; keduanya harus exit code 0 tanpa warning aplikasi.
- [ ] **Step 4: Jalankan server** dan uji `/admin` pada viewport 360x800 serta `/display` pada 1920x1080.
- [x] **Step 5: Buktikan alur** buat order -> panggil -> display berubah -> refresh tetap menyimpan nomor -> selesai -> reset.

## Keputusan scope

- Demo lokal tidak memakai akun, PIN, hosting, payment gateway, printer, stok bahan, atau multi-outlet.
- Produksi hosted dan PIN admin menjadi tahap terpisah setelah demo disetujui.
- Promo versi pertama berasal dari menu aktif; upload gambar/video ditunda sampai aset dan izin client tersedia.
- Tidak ada aset atau logo NESCAFE yang dimasukkan tanpa pemberian client.
