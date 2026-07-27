# Nomor Antrean Tanpa Nol Depan

## Tujuan

Nomor antrean baru memakai bentuk angka biasa (`1`, `11`, `50`, `100`) tanpa nol di depan. Panggilan suara memakai kata bilangan Bahasa Indonesia agar hasilnya tidak bergantung pada cara mesin TTS membaca digit.

## Perilaku

- Server menyimpan nomor antrean baru sebagai string angka tanpa padding.
- Reset harian dan reset Owner mengembalikan nomor berikutnya ke `1`.
- Display tetap menampilkan nilai nomor antrean sebagai angka.
- Teks suara mengubah nomor menjadi kata, misalnya `50` menjadi `lima puluh`.
- Nomor legacy seperti `050` tetap diumumkan sebagai `lima puluh` tanpa menulis ulang histori lama.
- `nextCallEventId`, histori transaksi, dan kebijakan reset lain tidak berubah.

## Batas

Konversi kata mendukung bilangan bulat aman nonnegatif. Nilai yang tidak valid dikembalikan sebagai teks aslinya agar display tidak gagal.

## Verifikasi

- Unit test format nomor baru.
- Unit test kata bilangan untuk `1`, `11`, `30`, `50`, `100`, dan input legacy `050`.
- UI contract memastikan display memakai teks kata untuk suara.
- Seluruh `npm test`, `npm run build`, dan smoke test live flow lulus.
