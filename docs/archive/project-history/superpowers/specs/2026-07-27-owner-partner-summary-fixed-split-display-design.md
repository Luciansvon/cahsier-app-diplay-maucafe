# Ringkasan Owner per Mitra dan Display Split Permanen

Tanggal: 27 Juli 2026

## Tujuan

1. Owner dapat membandingkan pendapatan setiap Mitra sebagai gabungan seluruh outlet aktif milik Mitra tersebut.
2. Display TV selalu memperlihatkan informasi antrean tanpa menghilangkan iklan.
3. Area iklan memakai seluruh panel kanan tanpa teks, ornamen, atau ruang luar media yang tidak diperlukan.
4. Banyak order tetap memiliki status yang jelas dan tidak saling menimpa.

## Dashboard Owner

Ringkasan jaringan paling atas tetap menghitung seluruh outlet aktif.

Di bawah ringkasan jaringan, Owner melihat satu kartu untuk setiap Mitra aktif. Contoh:

```text
Doni - 3 outlet aktif
Total Diterima       Rp ...
Profit Bersih        Rp ...
Transaksi            ...
Antrean Aktif        ...
Saldo Cup            ...

Dedi - 2 outlet aktif
Total Diterima       Rp ...
Profit Bersih        Rp ...
Transaksi            ...
Antrean Aktif        ...
Saldo Cup            ...
```

Nilai kartu Mitra adalah hasil penjumlahan seluruh outlet aktif dengan `partnerId` milik Mitra tersebut:

- Penjualan Bersih;
- Total Diterima;
- HPP;
- Laba Kotor;
- Biaya Operasional;
- Profit Bersih;
- transaksi;
- penerimaan Tunai dan QRIS;
- antrean aktif;
- saldo cup gabungan.

Outlet `pending` tidak ikut nilai finansial. Jumlah outlet pending ditampilkan terpisah pada kartu Mitra.

Outlet aktif lama yang belum memiliki `partnerId` tetap dihitung pada total jaringan dan ditampilkan dalam kelompok `Outlet tanpa Mitra`. Data outlet tersebut tidak boleh hilang dari dashboard.

Saat kartu Mitra dipilih, Owner melihat daftar outlet milik Mitra tersebut. Tombol outlet memakai flow detail yang sudah ada untuk membuka laporan dan pengelolaan satu outlet.

### Kontrak API Owner

Endpoint `GET /api/owner/multi-summary` tetap mengirim:

- `summaries`: ringkasan per outlet;
- `grandTotals`: gabungan seluruh outlet aktif.

Endpoint ditambah:

- `partnerSummaries`: ringkasan gabungan per Mitra;
- `unassignedSummary`: ringkasan gabungan outlet aktif tanpa Mitra jika ada.

Agregasi dilakukan server-side agar frontend tidak menjadi source of truth laporan.
Setiap ringkasan membawa `inventory.balance` sebagai saldo cup gabungan outlet yang masuk kelompok tersebut.

## Aturan Order dan Antrean

Satu checkout menghasilkan satu order dan satu nomor antrean, berapa pun jumlah itemnya.

Contoh:

```text
Buyer A membeli 1 kopi  -> nomor 1
Buyer B membeli 3 kopi  -> nomor 2
```

Urutan status:

1. Order baru berstatus `waiting` dan masuk daftar `Sedang dibuat`.
2. Saat dipanggil, order berubah menjadi `ready`, nomor tampil besar sebagai `Pesanan siap`, dan hilang dari `Sedang dibuat`.
3. Memanggil order berikutnya mengganti nomor besar terbaru, tetapi tidak menghapus atau menimpa order sebelumnya.
4. Order baru ditutup setelah Kasir menekan `Selesai` atau menjalankan pembatalan yang sah.

Daftar `Sedang dibuat` diurutkan dari order paling lama. Display memperlihatkan enam nomor per halaman dan berpindah halaman otomatis setiap empat detik jika jumlah waiting lebih dari enam.

## Display TV

Display memakai split permanen:

```text
┌────────────── 34% ANTREAN ──────────────┬──────────── 66% IKLAN ────────────┐
│ PESANAN SIAP                            │                                  │
│                 2                       │      FOTO / VIDEO FULL-BLEED      │
│                                         │                                  │
│ SEDANG DIBUAT                           │                                  │
│ 3, 4, 5, 6                              │                                  │
└─────────────────────────────────────────┴──────────────────────────────────┘
```

Panel antrean 34% selalu terlihat, termasuk saat belum ada active call. Jika belum ada nomor siap, panel menampilkan `Belum ada pesanan siap`.

Panel iklan 66%:

- selalu terlihat;
- media memenuhi seluruh panel;
- default `object-fit: cover`;
- opsi `contain` tetap tersedia untuk media yang tidak boleh terpotong;
- tidak memiliki teks `PROMO OUTLET`, penghitung slide, harga/menu otomatis, dekorasi, border, atau padding luar media;
- video tidak dijeda saat suara panggilan; hanya audio promo yang dimute sementara.

Jika belum ada media aktif, panel memakai latar netral tanpa mengambil data menu atau menampilkan harga.

## Keamanan dan Data

- Public Display hanya menerima nomor antrean, active call, media publik, outlet info, dan metadata freshness.
- Order ID, item, pembayaran, HPP, credential, dan histori tidak dikirim ke Display.
- Ringkasan per Mitra hanya tersedia melalui sesi Owner.
- Perhitungan finansial tetap dilakukan server-side dari snapshot order.

## Pengujian

Automated test harus membuktikan:

1. Doni dengan tiga outlet menerima satu `partnerSummary` yang menjumlahkan finansial dan saldo cup ketiga outlet.
2. Dedi dengan dua outlet menerima agregat finansial dan saldo cup yang terpisah.
3. Outlet pending tidak masuk nilai finansial.
4. Outlet aktif tanpa Mitra tetap muncul pada `unassignedSummary` dan total jaringan.
5. Buyer A satu item mendapat nomor 1 dan Buyer B tiga item mendapat nomor 2.
6. Banyak order waiting menghasilkan daftar nomor oldest-first tanpa duplikasi.
7. Daftar waiting lebih dari enam memiliki kontrak rotasi halaman.
8. Display selalu split 34/66 dan panel iklan tidak memuat teks/dekorasi lama.
9. Panggilan baru tidak menghapus order ready sebelumnya.
10. `npm test`, `npm run build`, dan smoke test browser flow terkait lulus.

## Batas Implementasi

- Tidak mengubah arsitektur satu Node server dan SQLite.
- Tidak membuat role atau endpoint publik baru.
- Tidak mengubah satu checkout menjadi beberapa nomor berdasarkan jumlah item.
- Tidak menghapus histori order atau outlet lama.
- Tidak mengubah reset nomor harian dan event ID suara monotonik.
