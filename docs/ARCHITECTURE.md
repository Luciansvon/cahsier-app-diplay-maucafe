# Arsitektur Coffee Queue Display

## Status

Dokumen ini mencatat batas dan rancangan awal. Implementasi aplikasi belum dibuat.

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
```

## Halaman aplikasi

### `/admin`

Panel sentuh untuk kasir. Fungsi minimum:

- menaikkan nomor antrean;
- menurunkan nomor untuk koreksi;
- memanggil ulang;
- menandai pesanan selesai;
- mereset antrean dengan konfirmasi.

### `/display`

Layar 16:9 untuk pelanggan. Nomor aktif harus lebih menonjol daripada iklan atau menu. Layout awal membagi layar menjadi area antrean dan area promo.

## State antrean

State minimum:

- nomor aktif;
- status pesanan;
- waktu perubahan terakhir;
- daftar nomor terakhir;
- status koneksi display.

Refresh browser tidak boleh menghilangkan nomor aktif. Bentuk penyimpanan ditentukan saat implementasi setelah kebutuhan demo diuji.

## Sinkronisasi demo

HP dan display membaca state dari server pada laptop. Perubahan admin harus muncul tanpa refresh manual. Implementasi harus tetap sederhana dan tidak bergantung pada layanan cloud untuk demo lokal.

## Media promo

Versi pertama memakai aset lokal yang diberikan client. Nomor antrean harus tetap terbaca saat gambar atau video berjalan. Jangan memasukkan logo atau materi merek tanpa izin penggunaan.

## Jalur produksi

Kode demo harus dapat dipindahkan ke hosting tanpa menulis ulang halaman admin dan display. Produksi dapat mengganti penyimpanan lokal dengan database hosted. Domain, akun hosting, dan akses publik diputuskan setelah demo disetujui.

## Batas arsitektur

- Tidak ada aplikasi native.
- Tidak ada integrasi POS.
- Tidak ada multi-outlet.
- Tidak ada akun pengguna kompleks.
- Tidak ada mini PC sebagai syarat demo.
- Fitur di luar batas ini memerlukan keputusan scope baru.
