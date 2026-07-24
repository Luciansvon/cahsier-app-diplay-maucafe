# Coffee Queue Display

Demo lokal sistem kasir ringan, antrean, dan digital signage untuk outlet kopi.

## Menjalankan demo

Syarat: Node.js 20 atau lebih baru.

```powershell
npm start
```

Buka di laptop/HP:

- Admin: `http://localhost:3000/admin`
- Display: `http://localhost:3000/display`
- Dashboard Pemilik: `http://localhost:3000/owner`

Untuk membuka halaman dari HP, pastikan HP dan laptop memakai Wi-Fi/hotspot yang sama. Jalankan `ipconfig`, cari alamat `IPv4 Address` laptop, lalu buka `http://ALAMAT-IP:3000/owner` dari HP Pemilik. Jika Windows Firewall meminta izin, izinkan hanya jaringan privat.

## Alur penggunaan

1. Buka `/display` pada laptop atau Smart TV dan tekan **Aktifkan suara** sekali.
2. Buka `/admin` pada HP/tablet.
3. Pilih menu, tentukan Tunai/QRIS, lalu tekan **Sudah Dibayar**.
4. Buka tab Pesanan dan tekan **Panggil**.
5. Nomor tampil serta dibacakan pada display tanpa refresh.
6. Tekan **Selesai** setelah pesanan diambil.
7. Buka tab **Penjualan** untuk melihat omzet, metode bayar, produk terjual, dan riwayat transaksi hari ini.

### Dashboard pemilik

1. Buka `/owner` dan masukkan PIN Pemilik. PIN awal untuk data demo baru adalah `1234`.
2. Halaman pertama menampilkan omzet, Tunai, QRIS, transaksi, antrean aktif, dan transaksi terbaru.
3. Tekan **Buka Laporan & Pengaturan** untuk memilih tanggal laporan, membersihkan data lama, mengganti PIN, atau membuka Zona Bahaya.
4. Tekan **Kunci** setelah selesai. Memuat ulang halaman hanya mempertahankan akses selama sesi owner masih berlaku.

Reset antrean meminta PIN dan tidak menghapus transaksi selesai. Penghapusan seluruh penjualan meminta teks `HAPUS` serta PIN Pemilik.

## Data dan reset

State aktif tersimpan di `data/state.json` dan tetap ada setelah refresh atau restart. Tombol **Reset** pada tab Pesanan membatalkan pesanan yang masih aktif, mengosongkan panggilan, dan mengembalikan nomor berikutnya ke `001`. Riwayat transaksi tetap tersimpan. Pesanan batal terlihat di tab Penjualan tetapi tidak dihitung sebagai omzet.

Untuk mengembalikan seluruh data contoh, hentikan server, hapus `data/state.json`, lalu jalankan `npm start` kembali.

## Pemeriksaan proyek

```powershell
npm test
npm run build

## Data dan reset

State aktif tersimpan di `data/state.json` dan tetap ada setelah refresh atau restart. Tombol **Reset** pada tab Pesanan membatalkan pesanan yang masih aktif, mengosongkan panggilan, dan mengembalikan nomor berikutnya ke `001`. Riwayat transaksi tetap tersimpan. Pesanan batal terlihat di tab Penjualan tetapi tidak dihitung sebagai omzet.

Untuk mengembalikan seluruh data contoh, hentikan server, hapus `data/state.json`, lalu jalankan `npm start` kembali.

## Pemeriksaan proyek

```powershell
npm test
npm run build
```

Build menghasilkan aset statis tervalidasi di `dist/`. Hosting, PIN admin, dan upload materi promo adalah tahap produksi terpisah dan belum diaktifkan.

## Dokumentasi

- [Modul Panduan Demo](docs/MODUL_PANDUAN_DEMO.md)
- [Aturan repo](AGENTS.md)
- [Arsitektur](docs/ARCHITECTURE.md)
- [Solusi error](docs/ERROR_SOLUTIONS.md)
- [Worklog](docs/WORKLOG.md)
