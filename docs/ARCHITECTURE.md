# Arsitektur Coffee Queue Display

## Status

Prototype lokal sudah diimplementasikan dengan Node.js tanpa dependency eksternal.

## Gambaran sistem

Demo memakai laptop sebagai server lokal. HP atau tablet membuka panel admin, sedangkan laptop atau Smart TV membuka layar pelanggan.

```text
HP/tablet admin
      |
      | Wi-Fi atau hotspot yang sama
      v
Laptop server lokal
      |
      +-- /admin
      +-- /display --> browser laptop atau Smart TV
      +-- REST API
      +-- SSE realtime
```

## Halaman aplikasi

### `/admin`

Panel sentuh untuk kasir. Fungsi minimum:

- menaikkan nomor antrean;
- menurunkan nomor untuk koreksi;
- memanggil ulang;
- menandai pesanan selesai;
- mereset antrean dengan konfirmasi;
- merangkum omzet harian dari pesanan yang sudah dibayar;
- memisahkan pembayaran Tunai dan QRIS;
- mempertahankan transaksi selesai dan batal saat antrean direset.

### `/display`

Layar 16:9 untuk pelanggan. Nomor aktif harus lebih menonjol daripada iklan atau menu. Layout awal membagi layar menjadi area antrean dan area promo.

## State antrean

State tersimpan di `data/state.json`:

- nomor aktif;
- status pesanan;
- waktu perubahan terakhir;
- daftar produk dan snapshot item transaksi;
- daftar pesanan beserta statusnya;
- revisi state dan event panggilan terakhir.

Penulisan memakai temporary file lalu rename agar file utama tidak tersimpan setengah. Refresh browser dan restart server membaca kembali state terakhir.

## Sinkronisasi demo

HP dan display membaca state dari server pada laptop. Admin mengubah state melalui REST API. Server mengirim snapshot terbaru melalui Server-Sent Events sehingga display berubah tanpa refresh manual. Saat SSE terputus, browser mencoba terhubung kembali dan UI menampilkan status koneksi.

## Media promo

Versi pertama merotasi kartu dari daftar menu aktif. Nomor antrean selalu menempati 34 persen layar. Aset gambar/video dan logo hanya ditambahkan setelah client memberikan file serta izin penggunaan.

## Jalur produksi

Kode demo harus dapat dipindahkan ke hosting tanpa menulis ulang halaman admin dan display. Produksi dapat mengganti penyimpanan lokal dengan database hosted. Domain, akun hosting, dan akses publik diputuskan setelah demo disetujui.

## Batas arsitektur

- Tidak ada aplikasi native.
- Tidak ada integrasi POS.
- Tidak ada multi-outlet.
- Tidak ada akun pengguna kompleks.
- Tidak ada mini PC sebagai syarat demo.
- Fitur di luar batas ini memerlukan keputusan scope baru.
