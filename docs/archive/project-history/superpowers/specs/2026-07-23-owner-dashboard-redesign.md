# Dashboard owner model pantau cepat

## Tujuan

Halaman `/owner` harus membantu pemilik memeriksa kondisi outlet dari HP tanpa bercampur dengan kontrol kasir. Informasi penjualan tampil lebih dahulu. Reset, pembersihan data, dan penggantian PIN berada di halaman pengaturan agar tidak mudah terpencet.

## Masalah yang ditemukan

* Layar PIN dan dashboard dapat tampil bersamaan karena aturan `display` pada CSS mengalahkan atribut `hidden`.
* Tombol reset dan hapus data mengambil perhatian sebelum ringkasan penjualan.
* PIN pemilik ikut dikirim melalui `/api/state`, sehingga pengguna yang dapat membuka data umum dapat membacanya.
* PIN disimpan sebagai angka mentah di state.
* Status koneksi hanya menyatakan tersambung atau terputus. Pemilik tidak diberi tahu bahwa angka yang terlihat mungkin berasal dari pembaruan terakhir.

## Batas pekerjaan

Perubahan hanya mencakup `/owner`, autentikasi PIN pemilik, data laporan owner, serta dokumentasi dan pengujian yang berhubungan langsung.

Pekerjaan ini tidak menambah akun pengguna, multi-outlet, integrasi POS, aplikasi native, hosting publik, atau perubahan besar pada `/admin` dan `/display`.

## Struktur halaman

### Layar PIN

Layar PIN berdiri sendiri. Dashboard dan modal pengaturan tidak boleh terlihat sebelum PIN diterima server.

Keypad tetap memakai tombol besar. Pesan kesalahan menjelaskan PIN salah atau server tidak dapat dijangkau. Memuat ulang halaman tidak boleh membuka dashboard tanpa sesi owner yang sah.

### Ringkasan hari ini

Urutan informasi pada layar 360 x 800:

1. judul "Ringkasan Hari Ini", status koneksi, dan tombol "Kunci";
2. kartu utama "Total Omzet";
3. kartu Tunai, QRIS, Transaksi, dan Antrean Aktif;
4. petunjuk pencocokan uang laci saat tutup toko;
5. transaksi terbaru;
6. tombol "Laporan & Pengaturan".

Tombol yang dapat disentuh memiliki area minimal 44 x 44 piksel. Nominal uang tidak dipotong atau keluar dari kartu pada lebar 360 piksel.

### Laporan

Laporan memuat:

* ringkasan untuk hari ini, kemarin, atau satu tanggal yang dipilih;
* daftar produk terjual, diurutkan dari jumlah terbanyak;
* daftar transaksi dengan nomor antrean, waktu, metode pembayaran, status, item, dan total.

Filter hanya memengaruhi laporan. Ringkasan "Antrean Aktif" tetap menunjukkan kondisi outlet saat data diterima.

### Pengaturan

Pengaturan memuat:

* ganti PIN;
* reset antrean ke 001;
* bersihkan transaksi yang lebih lama dari 30 hari;
* hapus semua riwayat penjualan.

Reset antrean memakai dialog konfirmasi yang menyebut dampaknya. Hapus semua penjualan berada di bagian "Zona Bahaya" dan baru dapat dijalankan setelah pemilik mengetik `HAPUS`.

Reset antrean tidak menghapus transaksi selesai atau batal. Pembersihan data tidak mengubah nomor antrean.

## Autentikasi owner

Browser mengirim PIN ke endpoint login khusus. Server memeriksa PIN dan, jika benar, membuat sesi owner acak. Browser menerima cookie sesi `HttpOnly` dan `SameSite=Strict`. JavaScript tidak menyimpan PIN atau token sesi.

Endpoint data dan aksi owner menolak permintaan tanpa sesi sah. Tombol "Kunci" menghapus sesi di server dan mengembalikan halaman ke layar PIN.

PIN tidak boleh muncul di `/api/state`, event real-time, respons login, log, atau pesan kesalahan. PIN disimpan sebagai hash dengan salt memakai modul bawaan Node.js. Perubahan format state harus tetap dapat membaca data demo yang sudah ada dan mengganti PIN mentah menjadi hash setelah autentikasi atau penggantian PIN berhasil.

Sesi berlaku selama delapan jam sejak login. Aksi pada Zona Bahaya meminta PIN sekali lagi sebelum server menjalankan perubahan.

## Data owner

Endpoint owner mengirim data minimum:

* tanggal bisnis;
* total omzet, Tunai, QRIS, dan jumlah transaksi untuk tanggal pilihan;
* antrean aktif saat data dikirim;
* produk terjual;
* transaksi untuk tanggal pilihan;
* waktu pembaruan server.

Data laporan dihitung server dari daftar pesanan yang tersimpan. Browser hanya merender hasilnya. Jalur event owner mengirim pembaruan setelah transaksi atau antrean berubah.

## Kondisi koneksi

Saat tersambung, halaman menampilkan "Terhubung" dan waktu pembaruan terakhir.

Saat sambungan terputus:

* angka terakhir tetap terlihat;
* label berubah menjadi "Data belum diperbarui";
* waktu pembaruan terakhir tetap terlihat;
* tombol yang mengubah data dinonaktifkan;
* halaman mencoba menyambung kembali tanpa mengubah angka.

Jika sesi berakhir, halaman kembali ke layar PIN dengan pesan "Sesi berakhir, masukkan PIN lagi."

## Konfirmasi dan pesan hasil

Semua aksi menunggu respons server sebelum menampilkan hasil. Pesan berhasil menyebut tindakan yang selesai. Pesan gagal tidak boleh menyatakan data sudah berubah.

Dialog dan toast memakai satu mekanisme JavaScript. Atribut `hidden` menjadi sumber utama visibilitas agar layar PIN, dashboard, dan modal tidak menumpuk.

## Pengujian

Pengujian otomatis mencakup:

* PIN tidak muncul pada state atau event umum;
* login benar membuat sesi dan login salah ditolak;
* endpoint owner menolak permintaan tanpa sesi;
* logout dan sesi kedaluwarsa menutup akses;
* reset antrean mempertahankan transaksi selesai dan batal;
* penghapusan penjualan memerlukan konfirmasi dan PIN;
* filter tanggal menghasilkan total yang sesuai;
* kontrak HTML memiliki layar PIN, ringkasan, laporan, pengaturan, status pembaruan, dan Zona Bahaya;
* build menyertakan semua aset owner.

Pengujian browser dilakukan pada 360 x 800 dan ukuran laptop. Alur yang diperiksa adalah login, refresh, pembaruan real-time, koneksi terputus, filter laporan, reset antrean, pembersihan data lama, hapus penjualan, ganti PIN, dan logout.

Perintah `npm test` dan `npm run build` harus lulus sebelum pekerjaan dinyatakan selesai.
