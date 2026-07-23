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
