# MAUCAFE Operations

Sistem satu server untuk franchise MAUCAFE: Kasir, antrean, display TV, Owner, Mitra, Karyawan, shift, kas, stok cup, biaya operasional, media promo, dan laporan laba bersih.

## Kebutuhan

- Node.js 24 direkomendasikan; minimum sesuai `package.json` adalah Node.js 22 yang memiliki `node:sqlite`.
- Browser modern untuk Kasir, Mitra, Owner, dan display TV.
- Build Android: JDK 21 dan Android SDK Platform 36.

## Menjalankan server kantor

```bash
npm install
npm start
```

Server mendengarkan `0.0.0.0:3000`.

- Launcher: `http://localhost:3000/`
- Kasir: `/outlet/<outlet-id>/admin`
- Display TV: `/outlet/<outlet-id>/display`
- Mitra: `/partner`
- Owner: `/owner`

Perangkat satu jaringan membuka `http://<IP-PC-SERVER>:3000`. Untuk akses dari luar kantor, pakai HTTPS reverse proxy atau VPN; jangan membuka port Node mentah ke internet.

## Role dan alur

### Karyawan/Kasir

1. Login memakai username Karyawan + PIN. PIN Admin outlet lama tetap tersedia sebagai akses bootstrap.
2. Buka shift dan masukkan saldo awal.
3. Buat order Tunai/QRIS. Server menentukan harga, HPP snapshot, total, nomor antrean, shift, dan identitas Karyawan.
4. Panggil/recall/selesaikan order.
5. Catat kas masuk/keluar, setoran, biaya, dan pergerakan cup.
6. Tutup shift memakai kas fisik. Selisih wajib memiliki alasan.

Order ditolak jika tidak ada shift aktif. Pembatalan memerlukan sesi Kasir/Owner dan approval Owner; histori cancelled tidak dihapus.

### Mitra

Mitra hanya melihat outlet miliknya. Panel Mitra mendukung:

- ringkasan gabungan Penjualan Bersih, Total Diterima, HPP, Laba Kotor, Biaya Operasional, dan Profit Bersih dari seluruh outlet miliknya;
- akun Karyawan, aktivasi/nonaktivasi, dan reset PIN;
- force-close shift dengan alasan yang diaudit;
- kas/biaya dan ledger cup;
- upload/hapus playlist display;
- ekspor Excel outlet;
- pengajuan outlet baru dengan status `pending`.

Outlet baru baru tersedia untuk Kasir/Display setelah Owner menyetujuinya.

### Owner

Owner dapat melihat total seluruh jaringan dan kartu ringkasan per Mitra. Setiap kartu menjumlahkan seluruh outlet aktif milik Mitra untuk Total Diterima, Profit Bersih, transaksi, antrean aktif, dan saldo cup. Daftar outlet dapat dibuka dari kartu tanpa kehilangan ringkasan; outlet aktif lama tanpa Mitra tetap muncul dalam kelompok tersendiri.

Owner juga dapat membuat Mitra, menyetujui outlet yang diajukan Mitra, melihat audit, mengelola master menu global, HPP, pemakaian cup, foto produk, media, PIN, laporan, dan operasi berisiko. Outlet lama tidak ditugaskan ke Mitra melalui flow operasional.

Perubahan master menu disimpan satu kali dan disinkronkan ke seluruh outlet aktif/pending dalam transaksi SQLite. Outlet yang dibuat kemudian mewarisi master menu terbaru.

## Display TV

- Layar selalu terbagi 34% panel antrean dan 66% panel media.
- Panel antrean tetap terlihat saat belum ada panggilan dan menampilkan `Belum ada pesanan siap`.
- Antrean waiting tampil oldest-first sebagai `Sedang dibuat`, enam nomor per halaman, lalu berotasi setiap empat detik.
- Satu checkout tetap menghasilkan satu nomor, berapa pun jumlah itemnya. Panggilan berikutnya tidak menghapus order `ready` sebelumnya.
- Foto/video memenuhi seluruh panel kanan tanpa judul promo, harga otomatis, counter, dekorasi, border, atau padding luar.
- Jika belum ada media, panel kanan memakai latar netral.
- Playlist menerima maksimal lima video MP4; tiap video maksimal 120 detik.
- Video pada playlist berulang otomatis, termasuk ketika playlist hanya berisi satu video.
- Foto JPG/PNG/WebP tidak dihitung sebagai video dan memiliki durasi 3–60 detik.
- Video memakai HTTP byte-range, ETag, dan Last-Modified.
- Saat suara panggilan berjalan, visual video tetap berjalan; hanya audio promo yang dimute sementara lalu dikembalikan.
- SSE memberi update cepat; polling lima detik dan batas stale 30 detik mencegah nomor lama dianggap valid.

Browser TV biasanya membutuhkan satu klik untuk mengaktifkan Web Speech.

## Database dan migrasi

Runtime source of truth:

```text
data/maucafe.sqlite
```

SQLite memakai WAL dan menyimpan registry global, credential hash, state tiap outlet, schema migration, serta append-only audit log.

Pada startup pertama, server mengimpor:

```text
data/outlets.json
data/security.json
data/outlet-<id>.json
```

Migrasi hanya berjalan sekali dan tidak menghapus file JSON sumber. `data/outlets.json` tetap ditulis sebagai compatibility mirror registry; state transaksi runtime tidak kembali ke JSON.

PIN tidak disimpan plaintext dan wajib unik secara global untuk Owner, Admin outlet, Mitra, serta Karyawan. Server menolak PIN baru yang sudah dipakai tanpa menyebut pemiliknya. Jika data lama memiliki PIN yang cocok ke lebih dari satu credential, login terkait ditolak sampai Owner merotasi salah satu PIN.

Credential demo `1111`/`1234` hanya untuk data demo dan ditolak saat `NODE_ENV=production`. Ganti PIN sebelum dipakai di jaringan nyata.

## Backup dan restore

Backup konsisten memakai SQLite `VACUUM INTO`:

```bash
npm run db:backup
node scripts/backup-database.mjs --database data/maucafe.sqlite --output-dir D:\MAUCAFE-Backup
```

Restore harus dijalankan saat server berhenti:

```bash
npm run db:restore -- --source D:\MAUCAFE-Backup\maucafe-<timestamp>.sqlite --database data\maucafe.sqlite
```

Restore memeriksa integritas dan schema MAUCAFE, lalu menyimpan database lama sebagai `maucafe.sqlite.before-restore-<timestamp>`.

Rekomendasi operasional:

- backup otomatis harian ke drive lain;
- simpan minimal 30 versi;
- uji restore ke PC terpisah setiap bulan;
- salin backup terenkripsi ke lokasi di luar kantor.

## Startup otomatis Windows

Jalankan PowerShell sebagai Administrator:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-windows-service.ps1
```

Script membuat task server saat startup dan backup SQLite harian pukul 02:00 memakai akun `SYSTEM`, tanpa password plaintext.

Hapus task:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\uninstall-windows-service.ps1
```

## Test dan build

```bash
npm test
npm run build
npm run build:android
npm run android:debug
```

Web build tersedia di `dist/`. Debug APK tersedia di `artifacts/MAUCAFE-Operations-0.1.0-debug.apk`.

APK membundel Launcher, Kasir, Mitra, dan Owner. Backend serta database tetap berada di server kantor. URL backend APK wajib HTTPS.

## Batas deployment

- Arsitektur sengaja satu proses Node + satu SQLite database.
- Session dan limiter login masih in-memory, sehingga login ulang diperlukan setelah restart.
- Jangan menjalankan beberapa instance server terhadap database yang sama.
- Adapter printer fisik belum dipilih; model struk memakai snapshot historis dan sudah tersedia.
- APK release memerlukan keystore Owner dan pengujian perangkat fisik.

## Dokumentasi

- `docs/ARCHITECTURE.md`
- `docs/ERROR_SOLUTIONS.md`
- `docs/WORKLOG.md`
- `docs/superpowers/plans/2026-07-27-maucafe-franchise-operations.md`
