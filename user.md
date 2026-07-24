# Catatan Karakteristik Klien (Mas Bima)

- Mas Bima membuat sistem ini untuk **orang awam** (pemilik kedai kopi).
- **Klien tidak mengerti coding**. Jangan pernah menyarankan solusi teknis kepada klien seperti "edit file JSON", "ubah kode", atau "buka terminal".
- Semua fitur manajemen sistem (seperti ubah harga, tambah menu, ganti PIN, ubah pajak) **harus ada tombol dan tampilannya (UI)** yang mudah ditekan di layar HP.
- Jelaskan sesuatu dengan analogi sehari-hari dan gunakan bahasa Indonesia yang sederhana. Hindari istilah teknis (seperti refactor, routing, JSON, DOM) jika memungkinkan.

# Profil & Catatan Pengguna (Bima)

## Profil Ringkas

- **Nama**: Bima
- **Latar Belakang**: Lebih fokus pada fungsi bisnis, alur kerja outlet (kasir, nomor antrean, tampilan TV), dan kemudahan operasional. Belum/tidak mendalami fundamental coding.

## Kebutuhan & Perangkat Klien

- **Perangkat**: Klien kemungkinan besar **TIDAK memiliki laptop di outlet**, hanya ada **Tablet/HP Kasir + TV Display**.
- **Opsi Hosting**: Perlu menyediakan skenario **Cloud Hosting** (~Rp50rb–75rb/bulan) agar sistem bisa langsung diakses dari Smart TV / Android TV Box & Tablet Kasir tanpa perlu ada laptop di toko.

## Preference & Gaya Desain

- **Identitas Visual Outlet**: Menyukai tema booth/kiosk **MAUCAFE** yang identik dengan **dominasi warna merah ikonik yang kuat**, dikombinasikan dengan warna kontras hitam/kopi gelap, putih, serta krem yang bersih dan modern.
- **Media Display TV**: Berminat dengan dukungan **video promosi (iklan produk/outlet)** yang dapat berputar otomatis di area promo layar TV antrean.
- **Pengaturan Video Promosi**: Menginginkan cara mengganti media promosi yang paling mudah untuk orang awam (via tombol unggah dari galeri HP/Tablet). Menanyakan apakah media promo bisa berbentuk **video maupun foto/gambar**. Diputuskan fitur ini mendukung **video & foto** dan tersedia di kedua halaman (Admin & Owner).
- **Keterbacaan Nomor Antrean**: Angka antrean (terutama angka 3, 7, 9) wajib memiliki jarak vertikal yang cukup dan bersih agar **tidak menabrak/tumpang tindih** dengan teks "Silakan ambil pesanan di counter" di bawahnya.
- **Manajemen Riwayat Penjualan**: Khawatir catatan transaksi menumpuk berbulan-bulan; memerlukan tampilan otomatis per hari ini serta opsi pembersihan/arsip catatan lama agar aplikasi tetap cepat.
- **Keamanan Bisnis & Pencegahan Kecurangan**: Sangat memperhatikan pencegahan manipulasi/korupsi oleh kasir; akses reset antrean, pembatalan, atau pembersihan riwayat wajib dilindungi PIN Pemilik toko.
- **Kebutuhan Rekapan Penjualan**: Sangat membutuhkan kejelasan alur pencocokan kas (Uang Tunai laci vs QRIS bank) serta kemudahan melihat ringkasan omzet harian saat tutup toko.
- **Monitoring Pemilik (Owner Monitoring)**: Memerlukan kemampuan bagi pemilik toko untuk memantau (*monitoring*) omzet harian, transaksi aktif, dan aktivitas penjualan secara langsung (real-time) dari HP pemilik.
- **Perhitungan Modal & Margin (HPP & Laba)**: Klien meminta adanya pencatatan harga modal (HPP) per produk dan perhitungan margin keuntungan bersih di dashboard Pemilik agar bisa memantau keuntungan bersih selain omzet kotor.
- **Referensi Laporan Penjualan**: Klien (Nizar) menginginkan rekapan/laporan penjualan per produk yang berjalan otomatis (memuat: Nama Produk, Kategori, Harga, Qty Terjual, Total Revenue/Omset, Jumlah Transaksi, Rata-rata Qty per Transaksi, dan Total Profit/Margin Keuntungan Bersih).
- **Koneksi Terputus**: Mengalami kendala "Koneksi terputus" di halaman Admin/Display saat aplikasi server di laptop belum dinyalakan. Perlu penjelasan sederhana untuk menyalakan server lokal.
- **Skalabilitas Multi-Outlet**: Klien menyampaikan bahwa aplikasi ini berpotensi digunakan untuk **banyak outlet (multi-outlet)**. Diputuskan untuk prototipe ada **5 outlet demo** (BSD, PIK, Bintaro, Kemang, Depok) yang bisa dipantau langsung dari 1 Dashboard Owner.
- **Keamanan PIN Admin**: Kasir tiap outlet dilindungi **PIN Admin Outlet** (default `1111`) agar tidak sembarang orang bisa memasukkan pesanan dari luar.
- **Keamanan Backup**: Menginginkan file single-outlet lama tetap aman di-backup (`*.single-outlet.bak.*`) agar sewaktu-waktu bisa digunakan jika diperlukan.
- **Rencana Bertemu Client**: Memiliki jadwal bertemu dengan klien 2 hari lagi untuk mendiskusikan implementasi multi-outlet dan hosting.
- **Pratinjau Dokumen PDF**: Bima berinteraksi dengan AI melalui antarmuka obrolan dan sempat mengklik link PDF yang menampilkan teks kode mentah. Berikan penjelasan sederhana bahwa link obrolan AI mencoba menampilkan teks biasa, sehingga file PDF visual perlu dibuka lewat File Explorer atau browser (`.html`).
- **Minat Keamanan Siber (Cybersecurity)**: Tertarik mempelajari repositori GitHub terkait keamanan AI (AI Security) dan pengujian keamanan web (Web Pentest). Penjelasan wajib menggunakan analogi sederhana (seperti satpam digital, tes ketahanan, atau kumpulan kunci uji coba).

## Cara Penyampaian Informasi (Pedoman Komunikasi)

1. **Bahasa**: Gunakan selalu Bahasa Indonesia yang sederhana, ramah, dan mudah dipahami.
2. **Tanpa Istilah Teknis Rumit**: Hindari istilah koding/arsitektur yang membingungkan (seperti state mutation, SSE, JSON persistence, callback, HTTP endpoints). Ganti meggunakan bahasa alur kerja (misal: "data otomatis tersimpan saat HP dimatikan", "layar TV langsung update tanpa harus di-refresh").
3. **Fokus pada Manfaat Praktis**: Jelaskan fitur dari sudut pandang kasir dan pelanggan yang melihat layar display.
4. **Alur Kerja Jelas**: Berikan petunjuk atau penjelas langkah demi langkah yang langsung bisa dicoba di HP dan layar laptop/TV.
5. **Langsung ke Hasil (Praktis)**: Bima lebih menyukai perbaikan langsung yang bisa diuji dibanding pembahasan dokumen atau teori yang bertele-tele.
