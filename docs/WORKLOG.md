# Catatan Pekerjaan & Dokumentasi Tugas (WORKLOG)

Dokumen ini adalah **sumber dokumentasi tunggal** yang mencatat secara lengkap seluruh tugas, alur kerja, perbaikan bug, penguatan keamanan, hingga rencana pengembangan sistem antrean MAUCAFE beserta **tanggal, jam, dan menit pengerjaannya**.

---

## 📌 [2026-07-24 02:15 WIB] TUGAS 1: Implementasi Sistem Multi-Outlet (5 Outlet Demo)

### Waktu Pengerjaan: 24 Juli 2026, Pukul 02:15 WIB

### 1. Tujuan & Latar Belakang
- Mengembangkan sistem dari 1 outlet menjadi **5 Outlet Demo**:
  1. MAUCAFE Alun-Alun Jepara (`maucafe-alunalun`)
  2. MAUCAFE Tahunan (`maucafe-tahunan`)
  3. MAUCAFE Pantai Bandengan (`maucafe-bandengan`)
  4. MAUCAFE Pantai Kartini (`maucafe-kartini`)
  5. MAUCAFE Pecangaan (`maucafe-pecangaan`)
- Memungkinkan Pemilik Toko memantau 5 cabang sekaligus dalam 1 Dashboard Pemilik (`/owner`), sementara Kasir tiap cabang hanya bisa mengoperasikan antrean cabang masing-masing.

### 2. Hak Akses & Keamanan
- **Kasir Cabang (/admin)**: Wajib memasukkan **PIN Admin Outlet** (default `1111`). Terisolasi penuh hanya untuk cabang yang dipilih.
- **Pemilik Toko (/owner)**: Wajib memasukkan **PIN Pemilik** (`1234`). Dapat melihat omzet gabungan 5 toko, mengubah PIN Admin cabang, serta mengunduh laporan ke Excel.

### 3. Detail Hasil Pengerjaan
- Dashboard Pemilik dibuat dengan 4 Tab Rapi: **Ringkasan**, **Laporan**, **Pengaturan**, dan **Zona Bahaya**.
- Pembersihan data riwayat penjualan dapat dilakukan per outlet atau semua outlet sekaligus.
- Kode single-outlet versi awal tetap diarsip aman di file `*.single-outlet.bak.*`.

---

## 📌 [2026-07-24 03:00 WIB] TUGAS 2: Penguatan Keamanan, Stabilitas Suara TV & UX Kasir

### Waktu Pengerjaan: 24 Juli 2026, Pukul 03:00 WIB

### 1. Keamanan & Proteksi Data Bisnis
- **Enkripsi PIN Kasir**: PIN Admin Kasir diacak aman (*scrypt hash*) agar tidak bocor.
- **Penyembunyian Data Sensitif**: Layar TV Display publik hanya menerima nomor antrean dan media promo. Data modal (HPP), total omzet rupiah, dan metode pembayaran tidak dikirim ke TV.
- **Pembersihan Celah Frontend**: Bebas dari `innerHTML` dinamis untuk mencegah celah manipulasi kode (XSS).
- **Upload Media Promo**: Pengunggahan foto/video promo divalidasi jenis file (JPG/PNG/MP4/WEBM) dan dibatasi maksimal 25 MB.

### 2. Stabilitas Suara Panggilan Antrean TV
- ID panggilan suara (`nextCallEventId`) dibuat bertambah secara independen (*monotonik*) dan tidak ikut terhapus saat antrean di-reset.
- Dipastikan panggilan suara di layar TV Display selalu berbunyi jernih saat Kasir menekan tombol panggil/panggil ulang.

### 3. Alur Tampilan Kasir & TV Display
- **Kasir (/admin)**: Tampilan split (katalog menu + keranjang belanja), pencarian menu otomatis, filter kategori, serta pemisahan antrean *Waiting* (oldest-first) vs *Ready*. Pembatalan pesanan wajib menyertakan alasan dan persetujuan PIN Pemilik.
- **TV Display (/display)**: Indikator proteksi koneksi terputus (*stale-state protection* 30 detik) dan pengaturan kecocokan media promo (*Cover* / *Contain*).

---

## 📌 [2026-07-24 03:20 WIB] TUGAS 3: Perbaikan Tampilan Layar HP Responsif (Mobile QA)

### Waktu Pengerjaan: 24 Juli 2026, Pukul 03:20 WIB

### 1. Masalah Sebelum Perbaikan
- Tampilan Dashboard Pemilik (`/owner`) pada HP layar kecil (320px – 430px) sempat bisa digeser ke samping (*horizontal overflow*) dan tombol menu memotong layar.

### 2. Solusi & Hasil Perbaikan
- Container dibuat pas 100% dengan lebar layar HP tanpa ada geseran ke samping.
- Tombol navigasi 4 Tab Pemilik disesuaikan menjadi ringkas: **Ringkasan**, **Laporan**, **Kelola**, dan **Bahaya**.
- Kartu omzet (*metric cards*) dan selector outlet dibuat fleksibel mengikuti lebar HP.
- Pengujian tampilan sukses dilakukan di berbagai ukuran viewport HP: **320px**, **360px**, **390px**, **414px**, **430px**, hingga Tablet **768px**.

---

## 📌 [2026-07-24 10:30 WIB] TUGAS 4: Perencanaan & Pengarsipan Rencana APK Android (Capacitor)

### Waktu Pengerjaan: 24 Juli 2026, Pukul 10:30 WIB

### 1. Latar Belakang & Status Rencana
- Menindaklanjuti info kemungkinan tampilan Kasir (`/admin`) dan Pemilik (`/owner`) diubah menjadi aplikasi Android (`.apk`).
- Dibuatkan dokumen rencana terperinci di **[PLAN_APK_CAPACITOR.md](file:///c:/Users/shint/Documents/Codex/2026-07-22/eh/nescafe-queue-display/docs/PLAN_APK_CAPACITOR.md)**.

### 2. Skenario Teknis
- Pembungkusan UI Kasir & Pemilik menggunakan *Capacitor*.
- Layar TV Display tetap menggunakan browser Smart TV / TV Box agar suara panggilan dan pemutaran video promo tetap optimal.
- Seluruh aplikasi HP Kasir & Pemilik tetap terhubung ke 1 server pusat (laptop toko / server online) agar data omzet multi-outlet terpusat.
- Status rencana ini diarsipkan sebagai dokumen persiapan dan tidak mengganggu fitur sistem utama yang sedang aktif saat ini.

---

## 📊 STATUS VERIFIKASI & PENGUJIANKU TERAKHIR

- **Waktu Verifikasi Selesai**: 24 Juli 2026, Pukul 10:35 WIB
- **Automated Unit & Integration Tests**: 39 / 39 PASS (100% Lulus)
- **Build Production**: `npm run build` PASS
- **Keamanan & Stabilitas**: Terverifikasi bebas syntax error, tanpa plaintext PIN, dan aman dipakai.
# 2026-07-27 - Franchise Operations V1

- Runtime dipindahkan dari JSON store ke SQLite WAL dengan migrasi satu kali dan audit append-only.
- Ditambahkan role Owner, Mitra, Karyawan, outlet pending/approval, scope outlet, session web/native, dan outlet dinamis tanpa restart.
- Ditambahkan shift, rekonsiliasi kas, cash in/out, setoran, biaya, ledger cup, pemakaian cup per produk, dan atribusi order ke Karyawan.
- Rollover Jakarta meng-expire antrean lama, me-void pembayaran, mereset nomor, dan mempertahankan event ID suara.
- Laporan sekarang membedakan Penjualan Bersih, Pajak, Total Diterima, HPP, Laba Kotor, Biaya Operasional, dan Profit Bersih.
- Master menu global, foto produk, playlist media, parser durasi MP4, byte-range streaming, serta display fullscreen/split adaptif selesai.
- UI Kasir, Mitra, dan Owner tersambung ke API operasional baru tanpa dynamic `innerHTML`.
- Backup/restore SQLite serta Scheduled Task Windows ditambahkan.
- Bug aktual selama implementasi dicatat sebagai ERR-014 sampai ERR-028 dan semuanya sudah diperbaiki.
- Verifikasi final: `82/82` automated test lulus, build web lulus, build/lint Android lulus, APK artifact identik dengan output Gradle, serta smoke HTTP lima outlet lulus.
- Migrasi data aktual diuji pada salinan 9 file JSON; SQLite terbentuk dan hash seluruh JSON sumber tetap sama.
- QA browser memeriksa Kasir desktop/mobile, login Mitra/Owner, dashboard Owner, dan display idle fullscreen; console final Mitra/Owner bersih.
