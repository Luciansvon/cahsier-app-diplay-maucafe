# Coffee Queue Display

Demo lokal sistem kasir ringan, antrean, dan digital signage untuk outlet kopi.

## Menjalankan demo

Syarat: Node.js 20 atau lebih baru.

```powershell
npm start
```

Buka di laptop:

- Admin: `http://localhost:3000/admin`
- Display: `http://localhost:3000/display`

Untuk membuka admin dari HP, pastikan HP dan laptop memakai Wi-Fi/hotspot yang sama. Jalankan `ipconfig`, cari alamat `IPv4 Address` laptop, lalu buka `http://ALAMAT-IP:3000/admin` dari HP. Jika Windows Firewall meminta izin, izinkan hanya jaringan privat.

## Alur penggunaan

1. Buka `/display` pada laptop atau Smart TV dan tekan **Aktifkan suara** sekali.
2. Buka `/admin` pada HP/tablet.
3. Pilih menu, tentukan Tunai/QRIS, lalu tekan **Sudah Dibayar**.
4. Buka tab Pesanan dan tekan **Panggil**.
5. Nomor tampil serta dibacakan pada display tanpa refresh.
6. Tekan **Selesai** setelah pesanan diambil.

## Data dan reset

State aktif tersimpan di `data/state.json` dan tetap ada setelah refresh atau restart. Tombol **Reset** pada tab Pesanan menghapus antrean aktif dan mengembalikan nomor berikutnya ke `001`. Menu tidak ikut terhapus.

Untuk mengembalikan seluruh data contoh, hentikan server, hapus `data/state.json`, lalu jalankan `npm start` kembali.

## Pemeriksaan proyek

```powershell
npm test
npm run build
```

Build menghasilkan aset statis tervalidasi di `dist/`. Hosting, PIN admin, dan upload materi promo adalah tahap produksi terpisah dan belum diaktifkan.

## Dokumentasi

- [Aturan repo](AGENTS.md)
- [Arsitektur](docs/ARCHITECTURE.md)
- [Solusi error](docs/ERROR_SOLUTIONS.md)
- [Worklog](docs/WORKLOG.md)
