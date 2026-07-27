# Error solutions

Dokumen ini menyimpan error yang sudah diperbaiki dan error berstatus `OPEN` yang gejala serta penyebabnya sudah dibuktikan. Jangan menambahkan dugaan atau menyatakan error `OPEN` selesai sebelum solusi diuji.

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
Pertahankan Server-Sent Events untuk pembaruan cepat dan tambahkan sinkronisasi state berkala sebagai cadangan. Implementasi saat ini melakukan fallback polling setiap lima detik sekaligus menandai data antrean stale setelah batas waktu tertentu.

Verifikasi:
Tes kontrak UI membuktikan polling cadangan aktif bersama Server-Sent Events. Pengambilan state memakai `no-store`; polling fallback dan indikator stale mencegah nomor lama dianggap sebagai antrean aktif saat stream tertahan atau koneksi putus.

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

Solusi saat ini:
1. Operasi destruktif dipindahkan ke endpoint Owner yang memerlukan sesi Owner aktif. PIN statis di body request tidak lagi cukup untuk menjalankan reset/pembersihan.
2. Konfirmasi destruktif tetap ditampilkan di UI, termasuk frasa konfirmasi untuk aksi berisiko tinggi.
3. Fungsi `clearAllOrders` tetap digunakan untuk penghapusan riwayat yang memang diminta, tetapi authorization ditegakkan server-side.

Verifikasi saat ini:
Tes server memastikan request tanpa sesi Owner ditolak, sementara request dengan sesi Owner yang valid dapat menjalankan operasi yang diizinkan.

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
Tombol dapat diklik dan memunculkan modal yang sesuai. Regression test UI dan server saat ini ikut memverifikasi flow Owner terkait.

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

Solusi saat ini:
1. Credential Owner dipindahkan menjadi satu sumber global di `data/security.json`, sehingga tidak perlu lagi mengubah hash di setiap store outlet.
2. Aktivasi suara tetap membutuhkan gestur pengguna jika browser menerapkan autoplay restriction; display menangani event panggilan dengan ID monotonik agar recall/reset tidak membisukan panggilan baru.
3. Pemilihan outlet pada pengelolaan tetap eksplisit agar perubahan tidak salah cabang.

Verifikasi saat ini:
Tes server dan smoke flow multi-outlet memastikan credential Owner konsisten secara global, isolasi outlet tetap terjaga, dan event panggilan tidak kembali ke ID lama setelah reset antrean.

## ERR-011 - Tampilan dashboard Owner terpotong atau tergeser ke samping di layar HP

Kondisi:
Saat halaman `/owner` dibuka dari HP (layar kecil 320px - 390px), halaman mengalami scroll horizontal berlebih dan beberapa kartu terpotong di tepi kanan.

Penyebab:
Beberapa elemen grid dan selector outlet menetapkan ukuran minimal yang kaku yang melebihi ruang kontainer HP kecil saat ditambah padding.

Solusi:
1. Menambahkan atribut `min-width: 0` dan `width: 100%` pada seluruh pembungkus selector dan kartu ringkasan.
2. Tab navigasi Owner dibuat responsif untuk lima area kerja dan pemilih outlet tersedia pada setiap kartu pengaturan agar tidak perlu scroll jauh ke atas.

Verifikasi:
Pemeriksaan kontrak UI dan QA responsif pada viewport 320px, 360px, 390px, 414px, dan 768px mengonfirmasi tidak ada lagi elemen yang keluar dari lebar layar.

## ERR-012 - Nomor antrean memiliki nol di depan atau dibacakan per digit

Kondisi:
Nomor antrean tampil sebagai `001`, `050`, dan bentuk tiga digit lain. Nilai yang sama dikirim mentah ke Web Speech API, sehingga hasil pelafalan dapat terdengar seperti digit terpisah, misalnya "lima kosong", tergantung mesin suara browser/TV.

Saat helper pelafalan pertama kali ditambahkan, halaman display juga gagal memuat `queue-number.js` karena file baru belum didaftarkan pada allowlist static-file server.

Penyebab:
1. `createOrder()` membentuk nomor menggunakan `padStart(3, '0')`.
2. `display.js` mengirim `activeCall.queueNumber` langsung ke `SpeechSynthesisUtterance`.
3. `src/server.js` hanya melayani daftar asset JavaScript yang eksplisit, tetapi `queue-number.js` belum terdaftar pada rute root dan rute nested outlet.

Solusi:
1. Nomor order baru disimpan tanpa padding sehingga urutannya menjadi `1`, `11`, `50`, `100`, dan seterusnya.
2. Display menormalkan nomor legacy seperti `050` menjadi `50` tanpa menulis ulang histori lama.
3. Teks panggilan mengubah angka menjadi kata bilangan Bahasa Indonesia; `50` dikirim ke mesin suara sebagai `lima puluh`.
4. `queue-number.js` didaftarkan pada static-file allowlist untuk URL root dan `/outlet/<id>/`.

Verifikasi:
- Unit test mencakup normalisasi `001`/`050` serta pelafalan `1`, `11`, `30`, `50`, dan `100`.
- Regression test server membuktikan asset helper tersedia pada rute root dan nested outlet.
- Seluruh `54/54` automated test lulus, `npm run build` lulus, dan smoke test multi-outlet lulus.
- Runtime server mengembalikan HTTP `200` untuk API outlet, `queue-number.js` root, dan `queue-number.js` nested; `display.js` aktif memakai `queueNumberText`.
- Pelafalan audio pada perangkat TV fisik belum diverifikasi langsung; bukti runtime saat ini memastikan teks yang dikirim ke mesin suara adalah kata bilangan Indonesia.

## ERR-013 - Tombol Bayar di HP tidak merespons

Kondisi:
Saat tombol Bayar disentuh dari panel Admin melalui URL HTTP jaringan lokal, tidak ada pesanan yang dibuat. Flow yang sama bekerja saat dibuka dari PC melalui `localhost`.

Penyebab:
1. Checkout membuat idempotency key dengan `crypto.randomUUID()`. API tersebut hanya tersedia pada secure context di sebagian browser/WebView, sehingga tersedia di `localhost` tetapi tidak pada URL HTTP alamat IP HP.
2. Error sebelum request API ditelan oleh `catch {}`, sehingga kasir tidak menerima pesan kegagalan.
3. Tombol non-submit sebelumnya juga belum mendeklarasikan `type="button"` secara eksplisit.

Solusi:
1. Checkout memakai `crypto.randomUUID()` jika tersedia dan id fallback berbasis waktu + random untuk HTTP LAN.
2. Error checkout sekarang tampil pada banner Admin.
3. Tombol Bayar, metode pembayaran, tab Admin, dan tombol Kunci memakai `type="button"`.

Verifikasi:
Regression contract test memastikan checkout memiliki fallback saat `randomUUID` tidak tersedia, error tidak ditelan, dan tombol non-submit bertipe button. `npm test`, `npm run build`, dan restart server dijalankan setelah perubahan.

## ERR-014 - Test SQLite gagal membersihkan folder temporary dengan `EBUSY`

Kondisi:
Test persistence lulus secara fungsi, tetapi teardown Windows gagal menghapus `maucafe.sqlite` karena file masih dikunci.

Penyebab:
Test menjalankan `rm(..., recursive)` sebelum `DatabaseSync.close()`, sehingga handle SQLite masih aktif saat Windows mencoba menghapus file.

Solusi:
Tutup database lebih dahulu pada teardown, baru hapus direktori temporary.

Verifikasi:
`test/sqlite-store.test.js` dan full `npm test` dapat berjalan berulang tanpa error `EBUSY`.

## ERR-015 - Test SSE gagal setelah rollover business day yang valid

Kondisi:
Regression test event stream mengharapkan string literal `"revision":0`, tetapi server mengirim revision yang lebih besar setelah normalisasi tanggal.

Penyebab:
Rollover hari memang menaikkan revision. Test mengunci nilai implementasi lama, bukan kontrak bahwa revision harus berupa angka terbaru.

Solusi:
Ubah assertion menjadi pola `"revision":\d+` dan tetap verifikasi payload public tidak membawa data internal.

Verifikasi:
Test rollover, public state, dan public event stream lulus bersamaan.

## ERR-016 - Perubahan produk Owner hanya berlaku pada satu outlet

Kondisi:
Produk yang ditambah/diubah dari detail outlet Owner tidak otomatis tersedia di outlet lain atau outlet baru.

Penyebab:
Route produk lama memutasi `state.products` outlet yang sedang dipilih. Belum ada katalog master global.

Solusi:
Pindahkan katalog ke `registry.masterProducts`. Create/update/foto produk sekarang menulis registry dan seluruh state outlet dalam satu transaksi SQLite, memperbarui cache, lalu broadcast ke semua channel. Outlet baru diinisialisasi dari master terbaru.

Verifikasi:
Regression test membuktikan create, update status, dan foto tersinkron ke outlet kedua serta outlet dinamis yang dibuat setelah produk.

## ERR-017 - Video display dibaca penuh ke RAM dan tidak mendukung byte-range

Kondisi:
Browser TV tidak dapat melakukan seek/range secara efisien dan server membaca seluruh file video sebelum mengirim respons.

Penyebab:
Rute `/media/*` memakai helper static file umum berbasis `readFile`.

Solusi:
Tambahkan streaming `createReadStream`, parser HTTP Range, status `206/416`, `Content-Range`, `Accept-Ranges`, ETag, Last-Modified, dan public cache.

Verifikasi:
Test upload meminta `bytes=0-7`, menerima `206` dengan delapan byte, lalu membuktikan range di luar file menghasilkan `416`.

## ERR-018 - Rotasi PIN Admin tidak persisten di source of truth SQLite

Kondisi:
Setelah migrasi SQLite, ganti PIN Admin berhasil pada proses aktif dan mirror `outlets.json`, tetapi registry SQLite masih menyimpan hash lama.

Penyebab:
Route lama memodifikasi object outlet in-memory lalu langsung menulis JSON, melewati `registryStore`.

Solusi:
Rotasi PIN sekarang melalui `mutateRegistry`, menyimpan hash baru ke SQLite, memperbarui compatibility mirror, menulis audit, dan mencabut seluruh session Admin outlet.

Verifikasi:
Regression test membuktikan PIN lama ditolak, PIN baru diterima, session lama dicabut, serta SQLite dan JSON sama-sama hanya menyimpan hash scrypt.

## ERR-019 - Order expired/cancelled masih bertanda `paymentStatus: paid`

Kondisi:
Laporan tidak menghitung cancelled/expired karena filter status, tetapi record masih menyatakan pembayaran `paid`, sehingga data audit membingungkan dan berisiko dipakai salah oleh consumer baru.

Penyebab:
Rollover, cancel, dan reset hanya mengubah `status` order.

Solusi:
Semua transisi cancelled/expired sekarang menetapkan `paymentStatus: void`. Order expired juga tidak dapat diselesaikan atau dibatalkan ulang.

Verifikasi:
Unit test queue memeriksa `paymentStatus: void` pada rollover, cancel, dan reset. Test laporan tetap membuktikan transaksi void tidak dihitung.

## ERR-020 - Contract test tab Kasir tertinggal setelah tab Shift ditambahkan

Kondisi:
Implementasi UI Kasir sudah benar memakai empat tab, tetapi full test gagal karena assertion CSS masih mengharapkan tiga kolom.

Penyebab:
Contract test lama mengunci jumlah tab sebelum panel Shift ditambahkan.

Solusi:
Perbarui kontrak ke empat kolom dan tambahkan assertion fungsional untuk username Karyawan, buka/tutup shift, catatan kas/biaya, inventory cup, dan playlist.

Verifikasi:
Full UI contract dan `npm test` lulus dengan panel operasional baru.

## ERR-021 - Nama file foto produk dapat bertabrakan pada milidetik yang sama

Kondisi:
Dua upload foto produk yang terjadi pada milidetik yang sama dapat menghasilkan nama file identik. Penggantian foto berisiko menimpa file baru lalu cleanup menghapus file yang baru ditulis.

Penyebab:
Nama file upload hanya memakai `Date.now()` dan ID produk.

Solusi:
Tambahkan suffix acak kriptografis pada setiap nama file upload. Parser cleanup tetap menerima pola nama lama agar file existing dapat diganti dengan aman.

Verifikasi:
Regression test mengganti foto produk, memastikan URL baru berbeda, file baru tetap tersedia, dan file lama mengembalikan `404`.

## ERR-022 - Halaman login Partner dan Owner memicu error 401 sebelum pengguna login

Kondisi:
Saat halaman Partner atau Owner pertama kali dibuka, script langsung meminta dashboard terproteksi. Console browser mencatat `401 Unauthorized` meskipun pengguna belum menekan tombol login.

Penyebab:
UI belum memiliki endpoint untuk memeriksa session cookie yang tersimpan tanpa memperlakukan kondisi belum login sebagai request dashboard gagal.

Solusi:
Tambahkan `/api/partner/session` dan `/api/owner/session`. UI memulihkan session lebih dahulu; dashboard hanya diminta jika session valid.

Verifikasi:
QA browser pada session baru membuka kedua halaman login tanpa console error atau request dashboard yang gagal.

## ERR-023 - Ringkasan jaringan menampilkan antrean aktif dari hari sebelumnya

Kondisi:
Dashboard Owner dan Mitra masih menghitung order `waiting`/`ready` dari business day lama sebagai antrean aktif.

Penyebab:
Rollover Jakarta dijalankan pada flow outlet/public, tetapi endpoint ringkasan multi-outlet menghitung state langsung sebelum memastikan business day terbaru.

Solusi:
Endpoint dashboard Owner dan Mitra sekarang menjalankan rollover tiap outlet sebelum membentuk ringkasan.

Verifikasi:
Regression test menanam order aktif dari hari sebelumnya lalu membuktikan ringkasan aktif menjadi nol dan order berubah menjadi expired/void.

## ERR-024 - Promo TV tidak fullscreen saat tidak ada panggilan aktif

Kondisi:
Saat antrean kosong, panel nomor tetap terlihat dan memakai 34% lebar layar sehingga promo tidak memenuhi layar.

Penyebab:
Blok `.queue-panel` mendeklarasikan `display: none` lalu menimpanya dengan `display: flex` di blok yang sama.

Solusi:
Hapus deklarasi kedua. Panel nomor hanya menjadi `display: flex` melalui selector `.display-shell.has-active-call .queue-panel`.

Verifikasi:
Contract test memastikan panel default tersembunyi tanpa deklarasi override dan hanya aktif saat class panggilan ada. QA visual runtime memastikan promo mengisi seluruh layar ketika tidak ada panggilan.

## ERR-025 - Browser tidak mengenali field username/PIN untuk autofill

Kondisi:
Login tetap berfungsi, tetapi QA browser menampilkan peringatan bahwa form password tidak mempunyai metadata username/autocomplete yang lengkap.

Penyebab:
Sebagian input sudah memiliki `autocomplete`, tetapi belum memiliki atribut `name`; field pembuatan credential Karyawan/Mitra/Admin belum memiliki metadata password baru; form ganti PIN Owner juga belum menyertakan identitas username.

Solusi:
Tambahkan nama semantik dan `autocomplete` pada seluruh field username, PIN aktif, PIN baru Karyawan/Mitra/Admin, serta approval Owner. Form ganti PIN Owner dan rotasi PIN Admin menyertakan username tersembunyi untuk hubungan credential yang jelas.

Verifikasi:
UI contract mengunci pasangan `name` dan `autocomplete`; QA diulang pada session browser baru untuk halaman Partner dan Owner.

## ERR-026 - Assertion credential Owner sempat dijalankan terhadap HTML Admin

Kondisi:
Targeted UI test gagal walaupun atribut credential pada semua halaman sudah benar.

Penyebab:
Assertion untuk ID `pin-input`, `current-pin-input`, dan `new-pin-input` tersisip ke blok test Admin, bukan blok Owner.

Solusi:
Pindahkan assertion Owner ke suite Owner dan gunakan assertion khusus `admin-username-input`/`admin-pin-input` pada suite Admin.

Verifikasi:
Targeted UI contract dan full test dijalankan ulang setelah pemisahan assertion.

## ERR-027 - APK di folder artifacts tertinggal dari build terbaru

Kondisi:
`android:debug` berhasil membuat APK terbaru di output Gradle, tetapi file yang didokumentasikan untuk pengguna di `artifacts/MAUCAFE-Operations-<versi>-debug.apk` masih memiliki timestamp dan ukuran build lama.

Penyebab:
Runner Gradle hanya menjalankan `assembleDebug` dan tidak menyalin hasilnya ke folder artifacts.

Solusi:
Setelah `assembleDebug` sukses, runner memvalidasi keberadaan `app-debug.apk`, membaca versi dari `package.json`, membuat folder artifacts jika perlu, lalu menyalin APK ke nama stabil yang didokumentasikan.

Verifikasi:
Contract test mengunci source/destination dan operasi copy. Build Android debug diulang, lalu hash dan ukuran APK output Gradle dibandingkan dengan artifact pengguna.

## ERR-028 - Runner Android memicu warning keamanan `shell: true`

Kondisi:
Build APK selesai, tetapi Node menampilkan `DEP0190` karena argumen Gradle diteruskan ke child process dengan mode shell.

Penyebab:
Runner memakai `spawnSync(..., { shell: true })` agar file batch Gradle dapat dijalankan di Windows.

Solusi:
Validasi nama task Gradle dengan allowlist karakter, panggil `ComSpec` secara eksplisit untuk wrapper Windows, dan jalankan child process tanpa opsi shell Node.

Verifikasi:
Contract test melarang `shell: true`. Android debug build diulang dan harus selesai tanpa `DEP0190`.

## ERR-029 - PIN yang sama dapat dipakai oleh beberapa credential

Kondisi:
Owner, Admin outlet, Mitra, atau Karyawan dapat tidak sengaja memakai PIN yang sama. Karena login tiap peran sebelumnya diperiksa pada route yang berbeda, benturan tersebut tidak ditolak saat credential dibuat atau dirotasi. Data lama juga dapat mengandung beberapa credential dengan PIN identik.

Penyebab:
Setiap PIN sudah disimpan sebagai hash `scrypt` dengan salt acak, tetapi server hanya memvalidasi format dan hash credential target. Belum ada pemeriksaan kandidat PIN terhadap seluruh hash credential lain sebelum penyimpanan atau login.

Solusi:
Server membandingkan kandidat PIN dengan hash Owner global, seluruh Admin outlet, Mitra, dan Karyawan. Pembuatan atau rotasi yang bentrok ditolak dengan HTTP `409` dan pesan generik tanpa menyebut pemilik PIN; data serta sesi lama tidak berubah. Pemeriksaan tulis berjalan di mutation lock. Jika PIN dari data lama cocok dengan lebih dari satu credential, login browser maupun native ditolak sampai salah satu PIN dirotasi.

Verifikasi:
Unit test helper hash dan regression test API membuktikan pembuatan Mitra/Karyawan, reset PIN Karyawan, rotasi Admin, serta rotasi Owner menolak PIN duplikat. Fixture legacy membuktikan login Owner, Admin, Mitra, dan Karyawan pada browser/native fail closed tanpa membocorkan identitas konflik. `npm test` lulus `88/88`, `npm run build` lulus, dan audit read-only data aktif menemukan empat credential Admin lama masih memakai PIN demo yang sama sehingga harus dirotasi sebelum runtime baru digunakan.

## ERR-030 - OPEN - Video promo berhenti saat suara panggilan antrean

Status:
`OPEN`. Penyebab sudah dibuktikan, tetapi perbaikan belum diimplementasikan.

Kondisi:
Video promo sedang berjalan di Display. Ketika event panggilan antrean masuk dan suara nomor diputar, gambar video ikut berhenti. Pada reproduksi browser, video berjalan sampai detik `4,67`, lalu berubah menjadi paused ketika panggilan nomor `42` diterima.

Penyebab:
Fungsi `announce()` di `public/display.js` mengatur video menjadi muted lalu memanggil `promoVideo.pause()`. Video hanya diputar kembali melalui callback `speech.onend` atau `speech.onerror`. Akibatnya video pasti berhenti selama panggilan dan dapat tetap berhenti jika callback suara terlambat atau tidak terpanggil.

Solusi yang direncanakan:
Biarkan visual video terus berjalan. Saat suara antrean diputar, hanya audio promo yang dimute. Setelah suara selesai atau gagal, kembalikan status mute sebelumnya. Tambahkan fallback agar status audio tetap dipulihkan ketika browser TV tidak mengirim callback akhir suara.

Verifikasi diagnosis:
- Pemeriksaan source menemukan pemanggilan `promoVideo.pause()` pada alur `announce()`.
- Reproduksi browser dengan event panggilan terkontrol mencatat video dalam kondisi playing sebelum event dan paused setelah event.
- Reproduksi tidak membuat order baru atau mengubah data server.
- Belum ada verifikasi perbaikan karena kode belum diubah.
