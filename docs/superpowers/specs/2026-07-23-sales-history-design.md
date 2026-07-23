# Catatan penjualan admin

## Tujuan

Menambahkan catatan penjualan harian ke halaman `/admin` tanpa membuat penyimpanan atau layanan baru. Kasir dapat melihat omzet, metode pembayaran, produk terjual, dan rincian transaksi dari data pesanan yang sudah tersimpan.

## Aturan pencatatan

* Transaksi mulai dihitung ketika kasir menekan **Sudah Dibayar**.
* Status `waiting`, `ready`, dan `completed` masuk ke omzet karena pembayarannya sudah diterima.
* Status `cancelled` tetap terlihat sebagai catatan audit, tetapi tidak masuk ke omzet, jumlah transaksi, atau jumlah produk terjual.
* Ringkasan utama hanya memakai transaksi dengan `businessDate` yang sama dengan tanggal usaha aktif.
* Harga dan nama produk memakai snapshot pada transaksi, sehingga perubahan menu tidak mengubah catatan penjualan.

## Tampilan admin

Navigasi admin memiliki empat tab: Kasir, Pesanan, Penjualan, dan Menu. Tab Penjualan memuat:

* omzet hari ini;
* jumlah transaksi yang tidak batal;
* total pembayaran Tunai dan QRIS;
* rekap jumlah tiap produk yang terjual;
* daftar transaksi terbaru di atas, berisi waktu, nomor antrean, item, metode bayar, total, dan status.

Pesanan batal memakai label yang jelas dan totalnya tidak ditambahkan ke kartu ringkasan. Keadaan kosong menjelaskan bahwa belum ada transaksi pada tanggal usaha tersebut.

## Data dan alur

Browser menghitung ringkasan dari snapshot state yang sudah dikirim melalui REST dan Server-Sent Events. Tidak ada endpoint laporan atau struktur penyimpanan tambahan. Setiap perubahan status memicu render ulang sehingga pembatalan langsung mengurangi angka ringkasan.

Perhitungan ditempatkan dalam helper murni yang dapat dipakai halaman admin dan diuji tanpa browser. Helper menerima daftar pesanan serta tanggal usaha, lalu mengembalikan total omzet, jumlah transaksi, pembagian metode bayar, dan rekap produk.

Tombol Reset Antrean tidak menghapus riwayat. Saat reset:

* pesanan aktif berstatus `waiting` atau `ready` diubah menjadi `cancelled`;
* pesanan yang sudah `completed` atau `cancelled` dipertahankan;
* panggilan aktif dikosongkan;
* nomor antrean berikutnya kembali ke `001`.

Nomor antrean dapat berulang setelah reset manual. Waktu transaksi dan ID transaksi tetap membedakan catatan tersebut.

Dialog konfirmasi reset menjelaskan bahwa pesanan aktif akan dibatalkan dan riwayat penjualan tetap disimpan.

## Penanganan kegagalan

Catatan penjualan mengikuti status koneksi admin yang sudah ada. Jika pembaruan state gagal, banner error tetap terlihat dan angka penjualan terakhir tidak diubah secara diam-diam. Data transaksi tetap dibaca dari `data/state.json` setelah refresh atau restart server.

## Pengujian

* Unit test helper ringkasan membuktikan transaksi dibayar masuk omzet dan transaksi batal dikeluarkan.
* Unit test reset membuktikan pesanan aktif menjadi batal tanpa menghapus riwayat selesai.
* Tes kontrak UI memeriksa tab, kartu ringkasan, rekap produk, dan daftar transaksi.
* Tes server membuktikan hasil reset tetap tersimpan setelah state dibaca ulang.
* Pemeriksaan browser memakai ukuran 360 x 800 dan memastikan tidak ada overflow horizontal.

## Batas versi ini

Versi ini tidak mencakup filter rentang tanggal, ekspor CSV/PDF, laba bersih, diskon, pajak, refund parsial, atau sinkronisasi ke POS.
