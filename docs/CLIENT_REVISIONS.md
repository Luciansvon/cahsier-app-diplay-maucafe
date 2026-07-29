# Log revisi klien

File ini menjadi catatan utama revisi MAUCAFE. Semua permintaan baru masuk ke file ini dan statusnya diperbarui setelah implementasi serta pengujian.

## Arti status

| Status | Arti |
| --- | --- |
| `DONE` | Sudah diimplementasikan dan memiliki bukti pengujian. |
| `SEBAGIAN` | Baru sebagian flow yang tersedia atau masih ada bagian yang belum terbukti. |
| `BELUM` | Baru dicatat dan belum diimplementasikan. |

## Riwayat revisi

| ID | Tanggal | Revisi | Status | Catatan dan bukti |
| --- | --- | --- | --- | --- |
| REV-001 | 22 Juli 2026 | Sistem antrean Kasir dan Display TV dengan penyimpanan data serta reset nomor harian. | `DONE` | Flow order, antrean, panggil, selesai, batal, dan reset tercakup automated test. |
| REV-002 | 22-23 Juli 2026 | Riwayat penjualan Owner dan ringkasan kuantitas harian Kasir. | `DONE` | Kasir hanya menerima jumlah produk/transaksi; nominal finansial dan metode pembayaran tetap terbatas untuk Owner/Mitra. |
| REV-003 | 23 Juli 2026 | Sinkronisasi Display memakai SSE, polling cadangan, dan perlindungan data stale. | `DONE` | Smoke test multi-outlet lulus. Rincian bug ada di `ERR-003`. |
| REV-004 | 23-24 Juli 2026 | Sistem multi-outlet, Dashboard Owner gabungan, dan pembatasan akses per outlet. | `DONE` | Isolasi outlet, sesi Kasir, dan ringkasan Owner tercakup automated test serta smoke test. |
| REV-005 | 24 Juli 2026 | Penguatan keamanan PIN, session, data Display publik, upload media, dan aksi berbahaya Owner. | `DONE` | Credential disimpan sebagai hash dan public state tidak membawa HPP, laporan internal, atau hash credential. |
| REV-006 | 24 Juli 2026 | Tampilan Owner responsif pada HP. | `DONE` | QA terdokumentasi pada viewport 320, 360, 390, 414, 430, dan 768 px. Rincian ada di `ERR-011`. |
| REV-007 | 24 Juli 2026 | Nomor antrean tanpa nol di depan dan suara angka Bahasa Indonesia. | `DONE` | Unit test angka lulus dan asset tersedia pada rute root/nested. Suara pada TV fisik belum diuji langsung. |
| REV-008 | 24-26 Juli 2026 | Aplikasi Android/Capacitor dan perbaikan tombol Bayar melalui HTTP LAN HP. | `DONE` | Kontrak Android dan fallback `requestId` lulus automated test. Rincian checkout ada di `ERR-013`. |
| REV-009 | 27 Juli 2026 | Operasional franchise: SQLite, Owner, Mitra, Karyawan, shift, kas, biaya, cup, laporan, master menu, playlist, backup, dan restore. | `DONE` | Seluruh modul tercakup automated test dan build web. Bug implementasi tercatat di `ERR-014` sampai `ERR-028`. |
| REV-010 | 27 Juli 2026 | PIN harus unik di seluruh akun Owner, Admin, Mitra, dan Karyawan. | `DONE` | Pembuatan/rotasi PIN duplikat ditolak dan collision data lama fail closed. Rincian ada di `ERR-029`. |
| REV-011 | 25 Juli 2026 | Status antrean menampilkan teks "Sedang dibuat/diproses" pada flow Kasir dan Display. | `DONE` | Display menerima seluruh nomor waiting aman, menampilkan enam nomor oldest-first per halaman, berotasi empat detik, dan membersihkannya saat stale. Rincian ada di `ERR-034` dan `ERR-038`. |
| REV-012 | 27 Juli 2026 | Ringkasan gabungan per Mitra dari seluruh outlet yang dikelolanya. | `DONE` | Dashboard Mitra memakai agregat outlet miliknya. Dashboard Owner memiliki kartu Doni/Dedi per Mitra berisi finansial, transaksi, antrean aktif, saldo cup, pending outlet, drill-down outlet, serta kelompok outlet lama tanpa Mitra. Rincian ada di `ERR-032` dan `ERR-037`. |
| REV-013 | 27 Juli 2026 | Mitra terdaftar lebih dulu, lalu Mitra tersebut membuat atau mengajukan outlet baru miliknya. | `DONE` | Flow assignment outlet lama dihapus. Flow aktif: Owner membuat Mitra -> Mitra mengajukan outlet -> Owner menyetujui -> outlet aktif. Rincian ada di `ERR-031`. |
| REV-014 | 27 Juli 2026 | Hapus seluruh perhitungan, pengaturan, label, dan laporan pajak. | `DONE` | Pajak dihapus dari transaksi baru, API, UI, struk, ekspor, serta dokumentasi aktif. Field legacy diabaikan tanpa menghapus histori. Rincian ada di `ERR-033`. |
| REV-015 | 27 Juli 2026 | Rapikan teks dan komponen Shift pada halaman Mitra dan Kasir agar pas di halaman. | `DONE` | Status dipecah menjadi tiga baris, wrap diperketat, tombol mobile utuh, dan QA browser tidak menemukan overflow horizontal. Rincian ada di `ERR-035`. |
| REV-016 | 27 Juli 2026 | Video promo harus tetap berjalan ketika suara panggilan antrean diputar. | `DONE` | Panggilan tidak lagi pause/play video; hanya audio promo dimute sementara dan selalu dipulihkan. Playlist satu video juga berulang otomatis. Rincian ada di `ERR-030` dan `ERR-036`. |
| REV-017 | 27 Juli 2026 | Display iklan tidak perlu fullscreen adaptif; pertahankan split antrean dan maksimalkan area iklan tanpa teks/dekorasi luar. | `DONE` | Display selalu split 34/66. Panel media full-bleed tanpa promo chrome, sedangkan active call dan `Sedang dibuat` tetap terlihat. Rincian ada di `ERR-038`. |
| REV-018 | 29 Juli 2026 | Audit dan penguatan celah logika session, akses per role, order, inventory, impor, restore, dan service production. | `DONE` | Regression test ditambahkan untuk session SSE, batas akses Kasir/Mitra, state order, validasi input, audit log, restore SQLite, dan kontrak UI. Rincian ada di `ERR-039` sampai `ERR-049`. |

## Pemeriksaan terakhir

Tanggal: 29 Juli 2026

* `npm test`: `125/125` lulus.
* `npm run build`: lulus.
* Smoke test multi-outlet dan browser UI terisolasi: lulus.
* Bukti detail ada pada `docs/ERROR_SOLUTIONS.md`.
* Seluruh revisi aktif `REV-001` sampai `REV-018` berstatus `DONE`.
* Detail error teknis tetap disimpan di `docs/ERROR_SOLUTIONS.md`; file ini hanya melacak revisi dan status pengerjaan.

## Urutan revisi berikutnya

Tidak ada revisi terbuka pada catatan ini.
