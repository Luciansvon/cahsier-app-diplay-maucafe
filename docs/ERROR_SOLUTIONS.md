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
