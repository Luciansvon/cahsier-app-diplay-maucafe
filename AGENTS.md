# AGENTS.md

## Tujuan proyek

Bangun aplikasi antrean dan digital signage untuk outlet kopi. Tablet/HP dipakai sebagai panel admin, sedangkan laptop atau Smart TV menampilkan nomor antrean bersama iklan/menu.

## Batas produk

- Versi demo harus berjalan lewat jaringan lokal tanpa hosting.
- Halaman utama hanya `/admin` dan `/display`.
- `/admin` wajib nyaman disentuh dari layar kecil, memakai tombol besar, dan mencegah salah tekan.
- `/display` wajib 16:9, terbaca dari jarak 2-3 meter, dan memprioritaskan nomor antrean dibanding dekorasi.
- Tampilan pelanggan membagi layar menjadi area antrean dan area promo/menu.
- Jangan membuat aplikasi native, integrasi POS, multi-outlet, atau fitur akun kompleks sebelum diminta.
- Jangan menganggap logo atau materi NESCAFE bebas digunakan; pakai hanya aset yang diberikan atau diizinkan client.

## Prinsip teknis

- Pilih solusi web paling sederhana yang memenuhi kebutuhan.
- Demo: HP dan laptop berada pada Wi-Fi/hotspot yang sama; laptop menjalankan server lokal.
- Produksi: tetap dapat dipasang ke hosting tanpa menulis ulang aplikasi.
- Hindari dependency, abstraction, dan service tambahan yang belum diperlukan.
- Jangan hardcode password, token, atau credential.
- Data contoh harus mudah di-reset sebelum presentasi.

## Perilaku antrean minimum

- Admin dapat menaikkan nomor, menurunkan nomor untuk koreksi, memanggil ulang, menandai selesai, dan reset antrean.
- Display memperbarui nomor tanpa refresh manual.
- Nomor aktif tetap terlihat jelas ketika promo berupa gambar atau video berjalan.
- Kegagalan koneksi harus terlihat pada admin, bukan mengubah nomor secara diam-diam.

## Verifikasi wajib

- Jalankan build proyek dan perbaiki semua error sebelum menyatakan selesai.
- Uji alur HP admin -> layar display pada jaringan lokal.
- Uji ukuran admin minimal 360 x 800 dan display 1920 x 1080.
- Pastikan refresh halaman tidak merusak nomor aktif.

## Cara kerja repo

- Pertahankan perubahan user yang tidak berkaitan.
- Buat perubahan sekecil mungkin dan jangan melakukan refactor tanpa kebutuhan.
- Dokumentasikan cara menjalankan demo di `README.md` ketika aplikasinya mulai dibuat.
- Jangan publish atau membuka akses publik tanpa persetujuan Bima.

## Dokumentasi

Baca dan perbarui dokumen sesuai perubahan:

1. `AGENTS.md` untuk aturan kerja repo.
2. `README.md` untuk setup, penggunaan, dan perintah aktual.
3. `docs/ARCHITECTURE.md` untuk alur sistem, state, storage, atau deployment.
4. `docs/ERROR_SOLUTIONS.md` setelah penyebab dan solusi error terverifikasi.
5. `docs/WORKLOG.md` untuk checkpoint pekerjaan penting atau pekerjaan yang belum selesai.
