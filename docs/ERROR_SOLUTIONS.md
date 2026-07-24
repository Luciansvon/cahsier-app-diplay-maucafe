# Error solutions

Dokumen ini hanya menyimpan error yang pernah muncul, penyebabnya sudah ditemukan, dan solusinya sudah diuji. Jangan menambahkan dugaan.

## Format catatan

```text
## ERR-001 - Gejala singkat

Kondisi:
Pesan error atau perilaku yang terlihat.

Penyebab:
Penyebab yang sudah dibuktikan.

Solusi:
Langkah perbaikan yang berhasil.

Verifikasi:
Pemeriksaan yang membuktikan error selesai.
```

## ERR-001 - Nomor antrean melewati panel display

Kondisi:
Nomor tiga digit terpotong di sisi kanan panel antrean pada layar lebar dengan tinggi terbatas.

Penyebab:
Ukuran nomor memakai `18vw`, sehingga mengikuti lebar seluruh viewport meskipun panel antrean hanya selebar 34 persen.

Solusi:
Ukuran nomor dibatasi oleh nilai terkecil antara lebar dan tinggi viewport dengan batas maksimum 260 px.

Verifikasi:
Tes kontrak UI lulus dan pemeriksaan browser memastikan nomor `001` tetap berada di dalam area panel pada viewport yang tersedia.

## ERR-002 - Tab Penjualan tidak berjalan

Kondisi:
Markup tab Penjualan tampil, tetapi status admin berhenti di `Menghubungkan...` dan tombol tab tidak mengubah panel.

Penyebab:
`admin.js` mengimpor `/sales.js`, tetapi file tersebut belum didaftarkan pada daftar aset statis di server. Permintaan `/sales.js` mendapat HTTP 404 sehingga modul admin tidak dijalankan.

Solusi:
Daftarkan `/sales.js` pada pemetaan aset statis server dan tambahkan tes endpoint agar file selalu mendapat HTTP 200.

Verifikasi:
Tes server lulus, admin berstatus `Terhubung`, tab Penjualan dapat dibuka, dan console browser tidak mencatat error.

## ERR-003 - Nomor display tertinggal meski berstatus terhubung

Kondisi:
Admin sudah memanggil nomor `001`, tetapi display masih menampilkan nomor `002`. Kedua halaman menampilkan status `Terhubung`.

Penyebab:
Display hanya mengandalkan Server-Sent Events setelah pengambilan state pertama. Tunnel demo dapat menahan stream tanpa menutup koneksi, sehingga handler error tidak berjalan dan indikator tetap menunjukkan koneksi terakhir yang berhasil.

Solusi:
Pertahankan Server-Sent Events untuk pembaruan cepat dan tambahkan pengambilan `/api/state` setiap dua detik sebagai sinkronisasi cadangan.

Verifikasi:
Tes kontrak UI membuktikan polling cadangan aktif bersama Server-Sent Events. Pengambilan state memakai `no-store`, sehingga nomor display kembali mengikuti state server paling lambat dua detik setelah stream tertahan.

## ERR-004 - Rute `/owner` menghasilkan `Route tidak ditemukan`

Kondisi:
Pengguna membuka `http://localhost:3000/owner` dan mendapat respons `{"error":"Route tidak ditemukan"}`.

Penyebab:
Proses server lokal Node.js masih menjalankan kode versi lama yang dinyalakan sebelum rute `/owner` ditambahkan ke `src/server.js`.

Solusi:
Hentikan proses server lama pada port 3000, lalu jalankan ulang server (`npm start`) agar rute baru dimuat oleh server.

Verifikasi:
Permintaan ke `http://localhost:3000/owner` mengembalikan HTTP 200 OK dan menyajikan tampilan HTML `owner.html`.

## ERR-005 - Tombol Reset / Pembersihan Data Pemilik tidak bereaksi dan riwayat penjualan tidak terhapus

Kondisi:
Saat tombol Reset atau Bersihkan Data ditekan di halaman `/owner`, tidak ada perubahan pada tampilan, dan riwayat penjualan hari ini tidak terhapus.

Penyebab:
1. Kode sebelumnya menggunakan `window.confirm` bawaan browser yang sering terblokir pada browser HP, sehingga fungsi pemanggilan API tidak pernah dieksekusi.
2. Fungsi pembersihan lama (`purgeOldOrders`) hanya menghapus transaksi yang berumur lebih dari 30 hari, sehingga transaksi uji coba hari ini tetap tersimpan.

Solusi:
1. Hapus dialog `window.confirm` dari handler tombol di `owner.js` agar API langsung dipanggil saat tombol ditekan (keamanan tetap terjaga karena halaman `/owner` sudah dikunci PIN di awal).
2. Tambahkan fungsi `clearAllOrders` dan rute API `POST /api/sales/clear` serta tombol *"Kosongkan Riwayat Penjualan (Reset ke Rp0)"* untuk menghapus seluruh riwayat pesanan dan mengembalikan omzet ke Rp0.

Verifikasi:
Tes unit `clearAllOrders` lulus di `test/queue.test.js`, API `/api/sales/clear` merespons HTTP 200 OK dengan PIN `1234`, dan riwayat omzet berhasil kembali ke Rp0.

## ERR-006 - Layar PIN dan dashboard owner tampil menumpuk

Kondisi:
Halaman `/owner` menampilkan keypad PIN, dashboard, atau modal secara bersamaan. Pada HP, halaman menjadi sangat panjang dan ringkasan penjualan sulit ditemukan.

Penyebab:
Class `.lock-screen` dan `.modal-overlay` menetapkan `display: grid`. Aturan tersebut mengalahkan tampilan bawaan atribut `hidden`, sehingga JavaScript sudah mengubah state tetapi elemen tetap dirender.

Solusi:
Tambahkan aturan global `[hidden] { display: none !important; }` dan gunakan atribut `hidden` sebagai satu-satunya kendali untuk layar login, ringkasan, detail, serta modal.

Verifikasi:
Tes kontrak UI memeriksa aturan `hidden` dan keberadaan view owner yang terpisah. Pemeriksaan browser 360 x 800 memastikan hanya satu view terlihat pada satu waktu.

## ERR-007 - Tombol Kelola Menu dan Ganti PIN Pemilik tidak bereaksi di Dashboard Owner

Kondisi:
Klik tombol "Kelola Menu Kedai" atau "Ganti PIN Pemilik" di halaman `/owner` tidak memunculkan modal pop-up sama sekali.

Penyebab:
Event listener untuk `#open-change-pin-modal` tidak terpasang di `owner.js`, dan handler `#open-menu-mgmt-modal` tidak me-render daftar produk jika state outlet belum dimuat.

Solusi:
Daftarkan handler event listener untuk modal Ganti PIN Pemilik (`changePinModal.hidden = false`) dan perbaiki fungsi `openMenuMgmt()` untuk me-render daftar produk dari outlet aktif.

Verifikasi:
Tombol dapat diklik dan memunculkan modal pop-up dengan benar, serta pengujian otomatis 26/26 unit test lulus 100%.

## ERR-008 - Tombol "Hapus Penjualan Outlet" tetap disabled walau sudah mengetik "HAPUS"

Kondisi:
Pemilik mengetik `HAPUS` pada kotak konfirmasi di Zona Bahaya Outlet, namun tombol "Hapus penjualan outlet" tetap berwarna abu-abu (disabled) dan tidak dapat diklik.

Penyebab:
Fungsi `syncSingleOutletState()` tidak memanggil `setConnection(true)` setelah melakukan fetching data outlet, sehingga variabel global `isConnected` bernilai `false`. Akibatnya `updateMutatingButtons()` menonaktifkan seluruh tombol mutasi (`button.disabled = !isConnected || ...`).

Solusi:
Tambahkan pemanggilan `setConnection(true, payload.updatedAt)` di dalam `syncSingleOutletState()` agar status koneksi aktif saat berpindah ke detail outlet.

Verifikasi:
Tombol "Hapus penjualan outlet" langsung aktif begitu kata `HAPUS` diketik, dan proses penghapusan berhasil merespons HTTP 200 OK.

## ERR-009 - Laporan Penjualan kosong atau tanggal input tidak terisi otomatis

Kondisi:
Buka Tab Laporan Penjualan pada outlet baru atau saat belum ada transaksi hari ini, tabel laporan kosong atau input tanggal berstatus kosong tanpa pesan.

Penyebab:
Nilai `reportDate` bernilai `null` jika `state.businessDate` belum di-set, sehingga fungsi `renderReport()` berhenti (`if (!reportDate) return`). Selain itu, input `<input id="report-date" type="date">` tidak di-sync saat berpindah tab/outlet.

Solusi:
1. Buat fungsi helper `todayJakartaDate()` untuk memberikan fallback tanggal hari ini secara otomatis (`YYYY-MM-DD`).
2. Selalu set `$('#report-date').value = reportDate` saat `renderReport()` dipanggil.
3. Tambahkan dukungan laporan penjualan & ekspor Excel gabungan 5 outlet di rute `/api/owner/export-sales-all` dan `/api/owner/all-orders`.

Verifikasi:
Membuka Tab Laporan Penjualan langsung menampilkan tanggal hari ini secara otomatis, tabel laporan dan riwayat transaksi tampil dengan tepat, dan ekspor Excel gabungan berjalan lancar.

## ERR-010 - Sinkronisasi PIN Pemilik Multi-Outlet, Audio TV Autoplay, dan Pemilih Outlet Modal Menu

Kondisi:
1. Ganti PIN Pemilik hanya tersimpan di 1 cabang saja saat sedang membuka detail cabang tersebut, sehingga login Pemilik berikutnya gagal.
2. Suara panggilan di layar TV terblokir oleh Autoplay Policy browser TV jika belum diklik.
3. Modal Kelola Menu tidak menampilkan secara jelas cabang mana yang sedang diubah.

Penyebab:
1. Endpoint `/owner/pin` sebelumnya hanya memperbarui store 1 outlet tanpa mengiterasi seluruh cabang.
2. Browser TV memerlukan satu gestur sentuhan/klik pengguna pada DOM untuk mengizinkan Web Speech Audio Synthesis.
3. Jendela pop-up Kelola Menu tidak memiliki dropdown pemilih outlet di dalamnya.

Solusi:
1. Perbarui rute `/owner/pin` di `server.js` untuk meng-update hash PIN Pemilik di kelima store cabang sekaligus.
2. Tambahkan event listener `document.body.addEventListener('click', activateVoice)` pada `display.js` dan perjelas tombol pengaktifan suara TV.
3. Tambahkan dropdown `#menu-modal-outlet-select` di dalam modal Kelola Menu Kedai agar Pemilik bisa memilih dan melihat cabang mana yang sedang dikelola dengan jelas.

Verifikasi:
Pengujian otomatis `test/server.test.js` dan `scripts/test-live-flow.js` lulus 100%, ganti PIN Pemilik berlaku seragam ke seluruh cabang, dan layar TV aktif mengeluarkan suara panggilan saat diklik.

