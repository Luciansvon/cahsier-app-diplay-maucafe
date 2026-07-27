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
| REV-002 | 22-23 Juli 2026 | Riwayat penjualan dan ringkasan penjualan harian Kasir/Owner. | `DONE` | Perhitungan penjualan dan histori diuji di test sales, queue, dan server. |
| REV-003 | 23 Juli 2026 | Sinkronisasi Display memakai SSE, polling cadangan, dan perlindungan data stale. | `DONE` | Smoke test multi-outlet lulus. Rincian bug ada di `ERR-003`. |
| REV-004 | 23-24 Juli 2026 | Sistem multi-outlet, Dashboard Owner gabungan, dan pembatasan akses per outlet. | `DONE` | Isolasi outlet, sesi Kasir, dan ringkasan Owner tercakup automated test serta smoke test. |
| REV-005 | 24 Juli 2026 | Penguatan keamanan PIN, session, data Display publik, upload media, dan aksi berbahaya Owner. | `DONE` | Credential disimpan sebagai hash dan public state tidak membawa HPP, laporan internal, atau hash credential. |
| REV-006 | 24 Juli 2026 | Tampilan Owner responsif pada HP. | `DONE` | QA terdokumentasi pada viewport 320, 360, 390, 414, 430, dan 768 px. Rincian ada di `ERR-011`. |
| REV-007 | 24 Juli 2026 | Nomor antrean tanpa nol di depan dan suara angka Bahasa Indonesia. | `DONE` | Unit test angka lulus dan asset tersedia pada rute root/nested. Suara pada TV fisik belum diuji langsung. |
| REV-008 | 24-26 Juli 2026 | Aplikasi Android/Capacitor dan perbaikan tombol Bayar melalui HTTP LAN HP. | `DONE` | Kontrak Android dan fallback `requestId` lulus automated test. Rincian checkout ada di `ERR-013`. |
| REV-009 | 27 Juli 2026 | Operasional franchise: SQLite, Owner, Mitra, Karyawan, shift, kas, biaya, cup, laporan, master menu, playlist, backup, dan restore. | `DONE` | Seluruh modul tercakup automated test dan build web. Bug implementasi tercatat di `ERR-014` sampai `ERR-028`. |
| REV-010 | 27 Juli 2026 | PIN harus unik di seluruh akun Owner, Admin, Mitra, dan Karyawan. | `DONE` | Pembuatan/rotasi PIN duplikat ditolak dan collision data lama fail closed. Rincian ada di `ERR-029`. |
| REV-011 | 25 Juli 2026 | Status antrean menampilkan teks "Sedang dibuat/diproses" pada flow Kasir dan Display. | `SEBAGIAN` | Teks "Sedang dibuat" sudah ada di daftar Kasir. Belum ada implementasi dan bukti pada Display. |
| REV-012 | 27 Juli 2026 | Ringkasan gabungan per Mitra dari seluruh outlet yang dikelolanya. | `BELUM` | Dashboard Mitra masih menampilkan ringkasan berdasarkan outlet yang dipilih. |
| REV-013 | 27 Juli 2026 | Mitra terdaftar lebih dulu, lalu Mitra tersebut membuat atau mengajukan outlet baru miliknya. | `BELUM` | Outlet tidak boleh dibuat lebih dulu lalu ditugaskan ke Mitra. Flow yang diminta: Mitra terdaftar -> Mitra mengajukan outlet -> Owner menyetujui -> outlet aktif. Flow penugasan outlet lama ke Mitra tidak dipakai sebagai alur operasional klien. |
| REV-014 | 27 Juli 2026 | Hapus seluruh perhitungan, pengaturan, label, dan laporan pajak. | `BELUM` | Source dan test masih memiliki konfigurasi serta perhitungan pajak. |
| REV-015 | 27 Juli 2026 | Rapikan teks dan komponen Shift pada halaman Mitra dan Kasir agar pas di halaman. | `BELUM` | Dikerjakan terakhir setelah flow utama sistem proper. |
| REV-016 | 27 Juli 2026 | Video promo harus tetap berjalan ketika suara panggilan antrean diputar. | `BELUM` | Browser membuktikan `announce()` memanggil `promoVideo.pause()` saat event panggilan masuk. Video hanya diputar kembali melalui callback suara, sehingga callback yang terlambat atau tidak terpanggil dapat membuat video tetap berhenti. Perbaikan yang dicatat: visual video tetap berjalan, hanya audio promo yang dimute selama suara panggilan, lalu status audio dikembalikan setelah suara selesai atau gagal. Dicatat sebagai `ERR-030`. |

## Pemeriksaan terakhir

Tanggal: 27 Juli 2026

* `npm test`: `88/88` lulus, termasuk smoke test multi-outlet.
* `npm run build`: lulus.
* Status `BELUM` tidak dianggap selesai walaupun test fitur lama tetap lulus.
* Detail error teknis tetap disimpan di `docs/ERROR_SOLUTIONS.md`; file ini hanya melacak revisi dan status pengerjaan.

## Urutan revisi berikutnya

1. REV-013 - benahi flow Mitra membuat/mengajukan outlet baru miliknya.
2. REV-012 - buat ringkasan gabungan seluruh outlet milik Mitra.
3. REV-014 - hapus perhitungan pajak.
4. REV-011 - lengkapi status pesanan sampai Display.
5. REV-016 - pertahankan video tetap berjalan saat suara panggilan.
6. REV-015 - rapikan layout Shift Mitra dan Kasir.
