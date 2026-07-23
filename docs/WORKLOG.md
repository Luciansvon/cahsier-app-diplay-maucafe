# Work log

## Pekerjaan aktif - 2026-07-22

Target berikutnya adalah membuat prototype lokal dengan HP sebagai panel admin dan laptop sebagai server sekaligus layar pelanggan.

Status:

- workspace proyek sudah dibuat;
- Git sudah diinisialisasi;
- aturan repo sudah dibuat;
- struktur dokumentasi sudah dibuat;
- implementasi aplikasi belum dimulai.

## Checkpoint - 2026-07-22 21:45 WIB

Keputusan yang sudah disepakati:

- produk berupa web app;
- demo tidak memakai hosting;
- perangkat demo memakai laptop dan HP pada jaringan yang sama;
- produksi ditujukan untuk tablet admin dan Smart TV;
- mini PC bukan bagian dari rancangan awal;
- fitur awal mencakup nomor antrean dan area iklan/menu.

Langkah berikutnya:

1. Tentukan perilaku nomor antrean dan status pesanan.
2. Buat halaman `/admin` dan `/display`.
3. Uji sinkronisasi HP ke laptop melalui jaringan lokal.
4. Uji layout display 16:9.

## Checkpoint - 2026-07-23

Prototype lokal sudah mencakup:

- kasir dengan keranjang dan pembayaran Tunai/QRIS manual;
- nomor antrean harian tiga digit;
- daftar pesanan Menunggu, Siap, Selesai, dan Batal;
- panggil ulang dan reset dengan konfirmasi;
- tambah, edit, aktifkan, dan nonaktifkan menu;
- sinkronisasi display melalui Server-Sent Events;
- text-to-speech setelah suara diaktifkan pengguna;
- penyimpanan JSON yang bertahan setelah refresh/restart;
- layout admin 360x800 dan display dua kolom 16:9.

Pekerjaan verifikasi tersisa:

1. Uji dari HP nyata melalui jaringan lokal sebelum presentasi client.
2. Uji display fisik 1920x1080; browser QA saat ini membatasi render ke 1280x720 dengan rasio 16:9 yang sama.

Verifikasi yang sudah dilakukan:

- 17 tes otomatis lulus;
- build aset lulus;
- admin 360x800 tidak memiliki overflow horizontal;
- display 1280x720 menunjukkan pembagian antrean tepat 34 persen;
- alur buat pesanan `001`, panggil, tampil realtime, dan refresh persisten lulus;
- tidak ada error console pada admin atau display;
- API dapat diakses melalui alamat jaringan laptop dengan HTTP 200.

## Perbaikan proporsi display - 2026-07-23

- nomor antrean kini mengikuti batas lebar dan tinggi layar, bukan hanya lebar viewport;
- nomor `001` tidak lagi melewati panel merah pada pemeriksaan browser;
- tes regresi UI ditambahkan untuk menjaga aturan ukuran tersebut.

## Catatan penjualan admin - 2026-07-23

- tab Penjualan menampilkan omzet, jumlah transaksi, Tunai, QRIS, produk terjual, dan rincian transaksi;
- transaksi dihitung saat tombol Sudah Dibayar ditekan;
- transaksi batal tetap terlihat tetapi dikeluarkan dari ringkasan;
- reset antrean membatalkan pesanan aktif tanpa menghapus riwayat selesai;
- pembaruan transaksi dan reset teruji melalui SSE tanpa refresh halaman;
- 19 tes otomatis dan build aset lulus;
- permintaan viewport 360x800 menghasilkan area CSS 288x640 karena skala Windows 125 persen; fallback di bawah 320 px tetap satu kolom tanpa overflow horizontal;
- uji browser menunjukkan omzet berubah dari Rp51.000 menjadi Rp36.000 setelah reset, satu transaksi selesai tetap dihitung, dan dua transaksi batal tetap terlihat;
- tidak ada error atau warning console pada pemeriksaan akhir.
