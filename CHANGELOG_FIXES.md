# CHANGELOG - Security, Logic, Reliability, dan UI/UX Fix

## Security

- Menambahkan authorization server-side pada route order mutation.
- Memisahkan state public/display, cashier, dan Owner.
- Menghilangkan kebocoran HPP/order/payment data dari public display endpoint.
- Mengganti Admin PIN plaintext menjadi scrypt hash.
- Memindahkan Owner credential menjadi satu global `data/security.json`.
- Startup fail-closed jika Owner credential file hilang/rusak.
- Menambahkan Owner UI/API untuk rotasi Admin PIN per outlet.
- Menambahkan login/PIN approval rate limiting.
- Memperketat PIN format sebelum scrypt verification.
- Cookie session: HttpOnly, SameSite=Strict, Secure saat HTTPS.
- Menambahkan security headers/CSP dasar.
- Menghapus dynamic `innerHTML` pada script Admin/Owner/Display.
- Upload media: auth, max 25 MB, MIME + signature validation, generated filename, rate limit, cleanup file lama.
- Static media path dibatasi safe filename.
- Owner login response tidak lagi mengirim Admin credential hash.
- Operasi reset/purge/clear hanya melalui Owner session.

## Logic dan data integrity

- `nextCallEventId` dibuat independen dan monotonik, tidak ikut queue reset.
- Legacy migration call-event dibuat aman terhadap `localStorage` TV lama.
- Order snapshot sekarang menyimpan category dan canonical unitPrice.
- Fix laporan `item.price` menjadi `item.unitPrice` dengan legacy fallback.
- Financial summary memisahkan net sales/tax/total received.
- Cancel menyimpan reason, cancelledAt, cancelledBy, approvedBy.
- Queue reset menambahkan cancellation metadata pada order aktif.
- State schema dinaikkan ke v2 dan dinormalisasi saat startup.
- Existing outlet data dipertahankan dan dimigrasi tanpa menghapus histori.
- JSON mutation tetap serialized + atomic rename.
- Range validation ditambahkan untuk price/cost/quantity/text length.
- Outlet count hardcode dihapus dari report/UI utama.

## UI/UX Kasir

- Layout product browser + sticky cart untuk desktop/tablet.
- Mobile sticky cart summary.
- Search menu + filter kategori.
- Checkout CTA menampilkan total dan payment method.
- Ready dan Waiting dipisahkan.
- Waiting diurutkan oldest-first dan menampilkan durasi.
- Cancel flow memiliki modal reason + Owner approval.
- Error HTTP validation tidak lagi salah mengubah indikator menjadi offline.
- Admin tabs diperbaiki menjadi 3 kolom.

## Display TV

- Public payload diminimalkan.
- Stale state protection 30 detik.
- Cache lama tidak dianggap nomor aktif ketika server tidak fresh.
- Media mendukung `cover`/`contain`.
- Event suara tetap valid setelah queue reset/migration.

## Owner

- Label Penjualan Bersih vs Total Diterima diperjelas.
- Summary outlet lebih fleksibel terhadap jumlah outlet.
- Admin PIN per outlet dapat diganti dari Owner.
- Report DOM dibangun dengan safe DOM API.
- Media fit control ditambahkan.
- Navigation mobile dirapikan.

## Verification

- 39/39 automated tests pass.
- `npm run build` pass.
- Runtime JavaScript syntax checks pass.
- Isolated 5-outlet smoke flow pass.
- Packaged-data login/public-state smoke pass.

## Remaining production caveats

- Session/rate limiter masih in-memory.
- Data transaksi masih JSON, belum database.
- HTTPS disediakan layer deployment.
- Belum ada global immutable audit log, shift/cash reconciliation, monitoring, atau scheduled backup.

## Mobile responsive owner dashboard fix

Perbaikan lanjutan setelah QA viewport perangkat mobile:

- Menghapus page-level horizontal overflow pada dashboard Owner.
- Memperbaiki grid outlet yang sebelumnya memiliki minimum 320px dan dapat melebarkan viewport 320px.
- Membuat header Owner benar-benar adaptif: desktop tetap sejajar, mobile kecil menumpuk dengan status dan tombol Kunci tetap utuh.
- Membuat selector outlet shrink-safe dengan `min-width: 0`, `width: 100%`, dan layout satu kolom pada HP kecil.
- Mengubah tab Owner menjadi empat tab mobile ringkas: Ringkasan, Laporan, Kelola, Bahaya, tanpa memotong page.
- Membuat metric cards adaptif: dua kolom pada mobile yang cukup lebar, satu kolom pada <=350px.
- Memperbaiki outlet cards agar selalu mengikuti lebar container.
- Menambahkan proteksi `min-width: 0` pada flex/grid children yang sebelumnya dapat memaksa intrinsic width keluar viewport.

QA responsif dilakukan pada viewport: 320, 360, 390, 414, 430, dan 768 px. Pada seluruh viewport tersebut, document `scrollWidth` sama dengan viewport width dan tidak ditemukan elemen utama keluar dari viewport.
