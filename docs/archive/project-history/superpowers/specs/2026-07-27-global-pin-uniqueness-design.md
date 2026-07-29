# Global PIN Uniqueness Design

## Tujuan

Setiap credential Owner, Admin outlet, Mitra, dan Karyawan harus memakai PIN yang berbeda secara global.

## Behavior

- PIN baru dibandingkan dengan seluruh hash credential lain sebelum disimpan.
- Perubahan ke PIN yang sama milik credential itu sendiri tetap diperbolehkan karena tidak membuat credential bersama.
- Jika cocok dengan credential lain, server merespons `409` dengan pesan `PIN sudah digunakan, pilih PIN lain.` dan tidak mengubah data atau sesi.
- Pesan kesalahan tidak menyebut akun, peran, atau outlet pemilik PIN.
- Login ditolak jika PIN yang dimasukkan cocok dengan lebih dari satu credential lama. Owner harus merotasi salah satu PIN sebelum credential tersebut dapat digunakan kembali.
- Pemeriksaan meliputi akun aktif maupun nonaktif agar PIN lama tidak langsung dipakai ulang.

## Arsitektur

Server membentuk daftar record hash dari `security.ownerPinHash`, seluruh `outlet.adminPinHash`, dan seluruh `user.pinHash`. Pemeriksaan menggunakan fungsi `verifyPinHash` yang sama dengan autentikasi saat ini. Tidak ada PIN plaintext atau fingerprint deterministik baru yang disimpan.

Semua jalur penulisan credential diperiksa di dalam mutation lock yang sama dengan penyimpanan agar dua request bersamaan tidak dapat menyimpan PIN identik.

## Jalur yang Dilindungi

- pembuatan Mitra;
- pembuatan Karyawan;
- reset PIN Karyawan;
- rotasi PIN Admin outlet;
- rotasi PIN Owner;
- login Owner, Admin outlet legacy, Mitra, dan Karyawan.

## Verifikasi

- Unit test membuktikan pencarian kecocokan hash tidak membocorkan credential.
- API test membuktikan setiap jalur penulisan menolak PIN milik credential lain dan data lama tetap berlaku.
- API test membuktikan login fail closed ketika fixture legacy memiliki PIN ganda.
- `npm test`, `npm run build`, dan smoke test API credential dijalankan sebelum selesai.
