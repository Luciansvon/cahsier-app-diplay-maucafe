# Coffee queue MVP design

## Tujuan

MVP ini menggabungkan kasir sederhana, pengelolaan menu, antrean pesanan, dan layar panggilan. Tahap pertama berupa demo lokal melalui laptop dan HP pada jaringan yang sama. Setelah demo disetujui, kode dapat dipindahkan ke hosting untuk penggunaan tablet dan Smart TV di outlet.

## Perangkat dan akses

Pada demo, laptop menjalankan server serta display. HP/tablet membuka halaman admin memakai alamat IP lokal laptop. Demo tidak memerlukan internet atau hosting.

Pada produksi, tablet dan Smart TV membuka URL hosted. Hosting, PIN admin, database hosted, dan kode outlet dikerjakan sebagai tahap terpisah setelah demo diterima.

## Halaman

### Kasir

Kasir menampilkan menu aktif berdasarkan kategori. Pegawai dapat menambah produk ke keranjang, mengubah jumlah, dan menghapus item. Pembayaran hanya mencatat Tunai atau QRIS manual.

Tombol "Sudah Dibayar" menyimpan transaksi dan membuat nomor antrean. Nomor memakai tiga digit dan dimulai dari `001` setiap hari berdasarkan zona waktu Asia/Jakarta.

### Pesanan

Pesanan yang sudah dibayar masuk ke daftar Menunggu. Setiap kartu memuat nomor antrean, waktu transaksi, dan ringkasan item.

Tindakan yang tersedia:

* Panggil mengubah status menjadi Siap, memperbarui display, dan membuat event suara.
* Panggil ulang membuat event suara baru tanpa membuat transaksi baru.
* Selesai mengubah status menjadi Selesai dan menghapus pesanan dari daftar aktif.
* Batal memerlukan konfirmasi dan menyimpan status Batal.

### Menu

Pegawai dapat menambah dan mengubah nama, kategori, serta harga produk. Produk dapat dinonaktifkan ketika habis. Produk yang sudah pernah dipakai transaksi tidak dihapus permanen agar riwayat transaksi tetap utuh.

MVP tidak menyediakan upload foto produk. Area promo display memakai kartu menu aktif dengan warna dan tipografi aplikasi.

### Display

Display memakai layout dua kolom 16:9. Area kiri selebar sekitar 34 persen menampilkan label "Pesanan Siap", nomor aktif, dan petunjuk pengambilan. Area kanan menampilkan promo atau daftar menu aktif secara bergantian.

Display memeriksa event panggilan setiap satu sampai dua detik. Event baru mengganti nomor aktif dan menjalankan text-to-speech Bahasa Indonesia. Pengguna menekan tombol "Aktifkan Suara" sekali saat display pertama dibuka agar browser mengizinkan audio.

## Alur utama

```text
Pilih menu
  -> keranjang
  -> pilih Tunai atau QRIS
  -> Sudah Dibayar
  -> nomor harian dibuat
  -> pesanan Menunggu
  -> Panggil
  -> display dan suara
  -> Selesai
```

## Penyimpanan

Demo menyimpan state ke file JSON pada laptop. Model data logis minimum:

* `products`: id, name, category, price, active, created_at, updated_at.
* `orders`: id, queue_number, business_date, payment_method, total, status, created_at, updated_at.
* `order_items`: id, order_id, product_id, product_name, unit_price, quantity, subtotal.
* `display_events`: id, order_id, queue_number, event_type, created_at.
* `settings`: key dan value untuk nama outlet serta konfigurasi display.

Nomor antrean dibuat dalam transaksi database berdasarkan `business_date`. Dua pembayaran yang terjadi hampir bersamaan tidak boleh mendapat nomor yang sama.

## Akses admin

Demo lokal tidak memakai login. Pada tahap produksi, PIN admin disimpan sebagai nilai rahasia hosting, tidak ditulis di source code, dan menghasilkan session cookie berumur terbatas. Route display tidak meminta PIN agar Smart TV dapat kembali membuka layar setelah restart.

## Kondisi gagal

Tablet menampilkan status offline jika request gagal. Tombol pembayaran tidak boleh menampilkan transaksi berhasil sebelum server mengonfirmasi penyimpanan. Tombol tindakan dinonaktifkan selama request berjalan untuk mencegah ketukan ganda.

Display mempertahankan nomor terakhir jika polling gagal dan menampilkan indikator koneksi kecil. Setelah koneksi kembali, display mengambil event terbaru. Text-to-speech yang gagal tidak membatalkan perubahan status pesanan.

## Batas MVP

MVP tidak mencakup stok bahan, printer struk, diskon, pajak kompleks, laporan akuntansi, payment gateway, multi-outlet, akun pegawai terpisah, upload materi iklan, atau integrasi aplikasi kasir lain.

## Pengujian

Pengujian otomatis mencakup:

* pembuatan nomor harian dan reset tanggal;
* perhitungan total dan snapshot harga item;
* perubahan status Menunggu, Siap, Selesai, dan Batal;
* panggil ulang tanpa transaksi duplikat;
* tambah, ubah, dan nonaktifkan produk;
* penolakan route admin tanpa session valid.

Pengujian manual memakai ukuran 360 x 800 untuk tablet/HP dan 1920 x 1080 untuk display. Alur pembayaran sampai suara panggilan diuji melalui dua browser terpisah.

## Kriteria selesai

Demo MVP selesai ketika pegawai dapat mengelola menu, membuat transaksi Tunai atau QRIS, memperoleh nomor harian, memanggil pesanan, dan menyelesaikannya dari HP/tablet. Display harus memperbarui nomor tanpa refresh manual dan mencoba mengucapkan nomor panggilan. Build, test otomatis, dan pengujian alur dua browser harus lulus. Publikasi memerlukan persetujuan terpisah.
