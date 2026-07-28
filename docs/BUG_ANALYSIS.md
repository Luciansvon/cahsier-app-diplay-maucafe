# Status Audit dan Bug Fix

Dokumen ini menggantikan laporan audit lama yang sudah tidak sesuai source terbaru.

## Verifikasi terakhir

- Automated tests: **39/39 pass**
- Build: **pass**
- Syntax check source runtime: **pass**
- Packaged-data smoke test: Admin demo + Owner demo + public-data boundary **pass**

## Temuan kritis yang sudah diperbaiki

### Mutation route tanpa autentikasi

Sebelumnya create order, call/complete/cancel, product mutation, dan media mutation dapat dipanggil tanpa role check yang memadai.

Sekarang route mutation memiliki authorization server-side dan Admin session diisolasi per outlet.

### Public state membocorkan data internal

Sebelumnya endpoint display dapat membawa hampir seluruh state, termasuk order/payment/HPP.

Sekarang public state memakai allowlist minimal dan tidak mengirim cost/order history/payment/credential.

### Stored XSS melalui dynamic `innerHTML`

Dynamic DOM pada Admin/Owner sudah diganti dengan `textContent`, `createElement`, dan `replaceChildren`. UI contract test memastikan assignment `innerHTML` tidak kembali ditambahkan pada script utama.

### Credential plaintext/default fallback

Admin PIN tidak lagi plaintext. Owner credential dipisahkan ke `security.json`. Missing Owner credential membuat startup gagal, bukan fallback diam-diam.

Default demo credential masih diketahui (`1111`/`1234`) demi kompatibilitas data demo, tetapi dapat dan harus diganti lewat Owner UI sebelum deployment publik.

### Upload media tidak aman

Sekarang upload membutuhkan auth, size limit, signature/MIME validation, generated filename, rate limit, fit validation, serta cleanup managed media lama.

## Logic bug yang sudah diperbaiki

- Call event ID tidak lagi reset ke 1 saat queue reset.
- Migrasi legacy call event menggunakan baseline tinggi agar tidak bentrok dengan `localStorage` display lama.
- Category dan unitPrice disnapshot ke order item.
- `sales.js` memakai canonical `unitPrice` dengan fallback legacy.
- Laporan memisahkan Penjualan Bersih dan Total Diterima tanpa komponen pajak.
- Waiting queue di UI diurutkan oldest-first; Ready dipisahkan.
- Cancel membutuhkan reason + Owner approval dan menyimpan audit metadata.
- Queue reset mencatat cancellation metadata untuk order aktif yang dibatalkan.
- Display stale >30 detik tidak menampilkan nomor cache lama sebagai nomor valid.
- Tab Admin disesuaikan menjadi 3 kolom.
- Jumlah outlet pada UI/export tidak lagi hardcoded ke angka 5.
- Error validasi HTTP di Admin tidak lagi salah ditampilkan sebagai koneksi offline.

## UI/UX yang sudah diperbaiki

- Desktop/tablet kasir: product browser + sticky cart berdampingan.
- Mobile kasir: sticky cart summary.
- Search dan category filter.
- CTA checkout menampilkan total + metode bayar.
- Ready/Waiting grouping dengan waiting duration.
- Cancel dialog reason + Owner PIN.
- Owner financial labels lebih eksplisit.
- Owner bisa mengganti PIN Admin per outlet.
- Media `cover`/`contain` dapat dipilih.
- Owner tab mobile dirapikan dan dibuat adaptif.
- Perbaikan overflow horizontal layar HP Pemilik (HP <350px hingga 768px).
- Penambahan dropdown pemilih outlet langsung pada setiap kartu/seksi Pengaturan & Zona Bahaya Pemilik.

## Batasan yang belum diklaim selesai

Ini bukan klaim “100% production secure”. Masih ada pekerjaan arsitektural jika dipakai skala besar:

1. Session/rate limiter masih in-memory.
2. Transaction state masih JSON files.
3. Belum ada global immutable audit-log subsystem; baru cancellation metadata pada order.
4. HTTPS bergantung deployment/reverse proxy.
5. Belum ada scheduled backup, shift reconciliation, health monitoring, dan database migration.
6. Full browser E2E automation belum menjadi bagian test suite; UI diuji lewat contract test + API/runtime smoke test.

Jangan menghapus batasan ini hanya untuk membuat laporan terlihat lebih bagus.
