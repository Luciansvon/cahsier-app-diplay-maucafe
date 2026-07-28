# Arsitektur MAUCAFE Operations

## Bentuk sistem

```text
Kasir/Karyawan     Display TV        Mitra            Owner
/outlet/:id/admin  /outlet/:id/display  /partner      /owner
        \               |              /                /
         +--------------+-------------+----------------+
                                |
                     satu Node.js HTTP server
                      API + SSE + static media
                                |
                    data/maucafe.sqlite (WAL)
             registry | security | outlet state | audit
```

Sistem sengaja tetap satu server dan satu database. Tidak ada microservice, Redis, atau message broker.

## Persistence

`src/sqlite-store.js` memakai `node:sqlite` dan tabel:

- `app_state`: JSON state dengan key `registry`, `security`, dan `outlet:<id>`;
- `audit_log`: append-only action log tanpa PIN/token/hash;
- `schema_migrations`: migrasi satu kali;
- WAL, foreign keys, dan busy timeout aktif.

Registry menyimpan outlet, Mitra, user, dan master product. State outlet menyimpan order, shift, transaksi operasional, inventory movement, media playlist, active call, serta revision.

Startup pertama mengimpor JSON lama dalam satu transaksi dan menandai `legacy-json-v1`. File JSON sumber tidak dihapus. Sesudah migrasi, SQLite adalah source of truth runtime.

## Hierarki akses

```text
Owner
├── semua Mitra dan outlet
├── master menu/HPP/foto/cup usage
├── laporan seluruh jaringan dan agregat per Mitra
└── credential, approval, audit, destructive action

Mitra
├── hanya outlet dengan partnerId miliknya
├── Karyawan miliknya
├── shift/cash/expense/cup/media outlet
└── ringkasan gabungan dan laporan outlet miliknya

Karyawan
├── tepat satu outlet dari session
├── shift sendiri
├── order dan antrean aktif
└── ringkasan harian tanpa HPP/profit

Public Display
└── produk publik, active call, nomor waiting, playlist, dan freshness
```

Authorization diputuskan di server. UI tersembunyi bukan security.

## Credential dan session

- Semua PIN memakai hash scrypt dari `src/security.js`.
- Hash Owner hanya berada di state `security`.
- PIN bootstrap Admin berada di registry outlet sebagai `adminPinHash`.
- User Mitra/Karyawan berada di registry sebagai `pinHash`.
- Cookie web: `HttpOnly`, `SameSite=Strict`, dan `Secure` saat HTTPS.
- APK: bearer token lewat `/api/native/*`, disimpan hanya selama sesi.
- Session dan rate limiter in-memory; satu deployment hanya satu proses.
- Production fail closed jika security hilang/rusak atau credential demo masih aktif.

## Order, shift, dan finansial

Server menetapkan harga, HPP snapshot, total, nomor, business date, shift, dan identitas Karyawan. Client hanya menentukan product ID, quantity, payment method, dan request ID idempoten.

Satu shift aktif per outlet:

```text
expected cash =
  opening cash
  + paid cash sales
  + cash in
  - cash out
  - expenses paid from drawer
  - deposits
```

Tutup shift menyimpan kas aktual dan variance. Selisih atau force-close wajib memiliki alasan.

Definisi laporan:

- Penjualan Bersih: subtotal transaksi dibayar;
- Total Diterima: sama dengan Penjualan Bersih;
- Total per metode pembayaran: uang yang diterima melalui Tunai atau QRIS;
- Total HPP: snapshot unitCost × quantity;
- Laba Kotor: Penjualan Bersih − HPP;
- Biaya Operasional: entry bertipe `expense`;
- Profit Bersih: Laba Kotor − Biaya Operasional.

Cancelled/expired/void tetap ada dalam histori, tetapi tidak dihitung sebagai penjualan.

## Business day dan antrean

Saat tanggal Jakarta berubah:

- waiting/ready lama menjadi `expired` + `paymentStatus: void`;
- active call dibersihkan;
- nomor antrean kembali ke `1`;
- `nextCallEventId` tidak di-reset.

Event ID suara monotonik mencegah TV menganggap panggilan baru sebagai event lama. Complete/cancel order yang sedang dipanggil juga membersihkan active call.

## Master menu

Owner mengelola satu katalog global. Create/update/foto produk menulis registry dan state semua outlet dalam satu transaksi SQLite, lalu memperbarui cache dan broadcast SSE. Outlet yang dibuat kemudian memakai master terbaru.

Public/Kasir menerima allowlist:

- id, name, category, price, active, imageUrl.

HPP dan credential tidak dikirim.

## Cup dan inventory

Produk menyimpan `cupUsage` 0–10 dan order menyimpan snapshot-nya. Ledger inventory mencatat `received`, `used`, `damaged`, `lost`, `returned`, dan `adjustment`. Ringkasan membandingkan pemakaian manual dengan ekspektasi dari penjualan.

## Media dan display

Playlist adalah state per outlet:

- maksimal lima video MP4;
- video berulang otomatis, termasuk playlist satu item;
- durasi video dibaca dari box `mvhd`, maksimal 120 detik;
- foto PNG/JPEG/WebP memiliki durasi 3–60 detik;
- generated filename, signature/MIME validation, size limit, dan rate limit;
- reorder/delete diaudit.

Static media memakai stream file, byte-range, ETag, Last-Modified, dan public cache. Server tidak membaca video penuh ke RAM.

Display selalu split tetap: panel antrean 34% dan panel media 66%. Panel antrean menampilkan active call atau status kosong serta nomor waiting oldest-first. Semua nomor waiting dikirim server, lalu browser menampilkan enam nomor per halaman dan berotasi setiap empat detik. Panel media hanya memuat foto/video full-bleed tanpa chrome promo. Selama Web Speech, visual video terus berjalan dan hanya audio promo yang dimute sementara. SSE dipadukan dengan polling fallback lima detik dan stale guard 30 detik.

## Backup, restore, dan LAN

Backup memakai SQLite `VACUUM INTO`. Restore memvalidasi `integrity_check`, `app_state`, `registry`, dan `security`, lalu memindahkan database lama ke file recoverable sebelum mengganti.

Windows Scheduled Task menjalankan server saat startup sebagai `SYSTEM` tanpa credential plaintext.

Topologi yang disarankan:

```text
Perangkat LAN ──> reverse proxy HTTPS ──> Node :3000 ──> SQLite lokal
Remote staff ──> VPN kantor ────────────┘
```

Jangan memakai beberapa Node instance terhadap database ini. Jika kebutuhan berubah menjadi multi-instance, durability lintas mesin, atau audit enterprise, migrasikan database dan session store secara eksplisit.
