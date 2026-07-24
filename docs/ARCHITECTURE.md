# Arsitektur Coffee Queue Display (Multi-Outlet)

## Status

Prototype multi-outlet (5 outlet demo) sudah diimplementasikan dengan Node.js tanpa dependency eksternal.

## Gambaran sistem

Satu server dapat dijalankan di laptop (lokal) atau dipasang di hosting. Server melayani 5 outlet sekaligus (`maucafe-bsd`, `maucafe-pik`, `maucafe-bintaro`, `maucafe-kemang`, `maucafe-depok`).

```text
HP/Tablet Kasir per Outlet            Laptop / Smart TV per Outlet             HP/Laptop Pemilik
(/outlet/:id/admin - PIN 1111)        (/outlet/:id/display - sign 16:9)       (/owner - PIN 1234)
               |                                     |                                |
               +-------------------------------------+--------------------------------+
                                                     |
                                                     v
                                      Server Multi-Outlet (Node.js)
                                                     |
                                      +--------------+--------------+
                                      |                             |
                             data/outlets.json            data/outlet-<id>.json
                             (Registry 5 Outlet)          (State Per Outlet)
```

## Halaman aplikasi

### `/outlet/:id/admin`
Panel sentuh kasir terisolasi per outlet. Dilindungi PIN Admin Outlet (default `1111`).
Fungsi utama:
- Buat pesanan baru & pilih metode bayar (Tunai/QRIS);
- Panggil / panggil ulang nomor antrean;
- Tandai pesanan selesai atau batal;
- Ganti media promo TV outlet tersebut.

### `/outlet/:id/display`
Layar TV antrean 16:9 terisolasi per outlet.
- Kolom kiri (34%): Nomor antrean aktif dipanggil + Web Speech suara panggilan.
- Kolom kanan (66%): Video/Foto promo outlet atau slideshow menu.

### `/owner`
Dashboard terpadu pemilik (Owner) untuk memantau semua outlet dalam 1 tempat. Dilindungi PIN Pemilik (`1234`).
- Ringkasan gabungan (Total Omzet, Profit, Transaksi, Antrean Aktif 5 Outlet).
- Grid kartu monitoring 5 outlet.
- Drilldown ke detail outlet mana saja untuk laporan per produk, ekspor Excel, kelola menu, dan ganti PIN.

## Keamanan & Penguncian

1. **PIN Admin Outlet**: Mencegah salah tekan atau akses tidak sah ke panel kasir.
2. **PIN Pemilik Global**: Dilengkapi scrypt hash & salt, cookie `HttpOnly`, `SameSite=Strict`.
3. **Backup Legacy**: Seluruh halaman single-outlet lama di-backup di `*.single-outlet.bak.*`.

## Jalur Produksi & Hosting

Aplikasi siap dipasang di hosting (Node.js hosted). `data/outlets.json` dan file state JSON per outlet dapat dengan mudah diganti ke database (SQLite/PostgreSQL) untuk produksi jangka panjang.
