# Modul Panduan Praktis Menjalankan Demo Aplikasi Maucafe

Dokumen ini disusun khusus agar **pemilik toko, manajer outlet, maupun kasir** dapat menjalankan demo aplikasi antrean dan kasir digital secara mandiri tanpa memerlukan keahlian koding.

---

## 📋 Ringkasan 3 Layar Utama

Aplikasi ini memiliki 3 tampilan utama yang bekerja secara otomatis tanpa perlu tekan tombol refresh:

1. **Layar Display TV (`/display`)**
   * **Dipasang di**: Laptop yang terhubung ke Layar TV / Smart TV Outlet.
   * **Fungsi**: Menampilkan nomor antrean yang dipanggil dan pemutar media promosi (foto/video).
2. **Layar HP Kasir (`/admin`)**
   * **Dipasang di**: HP / Tablet Kasir.
   * **Fungsi**: Menerima pesanan pelanggan, memilih metode bayar (Tunai/QRIS), memanggil nomor antrean, dan menyelesaikan pesanan.
   * **PIN Default**: `1111`
3. **Layar HP Pemilik (`/owner`)**
   * **Dipasang di**: HP Pemilik Toko / Manager.
   * **Fungsi**: Memantau omzet harian, keuntungan bersih (HPP), rincian transaksi tunai & QRIS, serta laporan penjualan real-time.
   * **PIN Default**: `1234`

---

## 🚀 Langkah 1: Menyalakan Aplikasi di Laptop

1. Buka folder aplikasi **`nescafe-queue-display`** di laptop Windows.
2. Cari file bernama **`JALANKAN_DEMO.bat`**.
3. **Klik 2 kali** file tersebut.
4. Sebuah jendela layar hitam akan terbuka. Tunggu 3–5 detik sampai muncul tulisan bahwa aplikasi sudah siap.
5. **Jangan tutup** jendela layar hitam ini selama Anda ingin menjalankan demo.

---

## 📶 Langkah 2: Menyambungkan HP & Laptop ke Wi-Fi yang Sama

Agar HP Kasir dan HP Pemilik dapat terhubung ke laptop:

1. Pastikan laptop, HP Kasir, dan HP Pemilik tersambung ke **Wi-Fi yang sama** (atau hubungkan HP ke **Hotspot** dari laptop).
2. Untuk mengetahui alamat IP Laptop:
   * Di laptop, buka **Command Prompt** (ketik `cmd` pada menu Search Windows, lalu tekan Enter).
   * Ketik perintah: `ipconfig` lalu tekan Enter.
   * Cari baris **`IPv4 Address`** (contoh: `192.168.1.15`).

---

## 📱 Langkah 3: Membuka Aplikasi di Masing-Masing Layar

Buka browser (Google Chrome, Safari, atau Microsoft Edge) pada tiap perangkat:

### 1. Layar TV (Buka di Laptop)
* Ketik alamat: `http://localhost:3000/display`
* **PENTING**: Tekan tombol **"Aktifkan Suara"** 1 kali di layar TV agar suara pemanggilan antrean dapat berbunyi.

### 2. HP Kasir / Admin
* Ketik alamat: `http://192.168.1.15:3000/admin` *(ganti angka IP sesuai IPv4 laptop Anda)*.
* Masukkan PIN Kasir: `1111`

### 3. HP Pemilik / Owner
* Ketik alamat: `http://192.168.1.15:3000/owner` *(ganti angka IP sesuai IPv4 laptop Anda)*.
* Masukkan PIN Pemilik: `1234`

---

## 🔄 Langkah 4: Alur Simulasi Transaksi (Langkah demi Langkah)

Mari kita coba lakukan simulasi transaksi sederhana dari awal sampai selesai:

1. **Memuat Pesanan Baru (HP Kasir)**
   * Pilih menu kopi yang dipesan (misal: *Espresso Single* & *Caramel Macchiato*).
   * Pilih metode pembayaran: **Tunai** atau **QRIS**.
   * Tekan tombol **Bayar Rp… · Tunai/QRIS** sesuai metode yang dipilih.
   * Sistem akan menerbitkan nomor antrean otomatis tanpa nol di depan (contoh: **1**).

2. **Memanggil Nomor Antrean (HP Kasir)**
   * Di HP Kasir, buka tab **Pesanan**.
   * Tekan tombol **Panggil** pada pesanan nomor **1**.
   * **Lihat di Layar TV**: Nomor **1** akan muncul besar di layar TV disertai suara pemanggilan otomatis. Angka seperti **50** dibacakan sebagai **"lima puluh"**.

3. **Menyerahkan Pesanan (HP Kasir)**
   * Setelah pembeli mengambil kopi di counter, tekan tombol **Selesai** di HP Kasir.
   * Nomor antrean aktif di TV akan dibersihkan secara otomatis.

4. **Memantau Laporan Bisnis (HP Pemilik)**
   * Buka layar HP Pemilik (`/owner`).
   * Anda dapat langsung melihat:
     * Penjualan Bersih dan Total Diterima
     * Rincian Tunai vs QRIS dan pajak terkumpul
     * Laba kotor berdasarkan HPP yang tersimpan
     * Grafik Penjualan & Riwayat Transaksi Terbaru

---

## ❓ Kendala Umum & Solusi Cepat

| Kendala | Penyebab | Solusi Cepat |
| :--- | :--- | :--- |
| **Suara panggil di TV tidak berbunyi** | Browser memblokir suara otomatis | Tekan tombol **"Aktifkan Suara"** yang ada di pojok layar TV. |
| **HP Kasir/Pemilik tulisan "Koneksi Terputus"** | Jendela `JALANKAN_DEMO.bat` tertutup atau Wi-Fi beda | Pastikan jendela layar hitam di laptop masih terbuka dan HP terhubung ke Wi-Fi yang sama dengan laptop. |
| **Lupa alamat IP laptop** | IP berubah setelah ganti Wi-Fi | Ketik `ipconfig` lagi di Command Prompt laptop untuk melihat IP terbaru. |

---

## 🛑 Langkah 5: Menghentikan Demo

Jika demo sudah selesai:
1. Tutup jendela layar hitam (`JALANKAN_DEMO.bat`) di laptop.
2. Aplikasi otomatis berhenti dan data transaksi hari ini tetap tersimpan aman untuk demo berikutnya.
