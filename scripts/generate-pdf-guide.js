import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = join(MODULE_DIR, '..');

function getBase64Image(filePath) {
  if (!existsSync(filePath)) return '';
  const buffer = readFileSync(filePath);
  return `data:image/png;base64,${buffer.toString('base64')}`;
}

const shotAdmin = getBase64Image(join(PROJECT_DIR, 'docs', 'shot_admin.png'));
const shotDisplay = getBase64Image(join(PROJECT_DIR, 'docs', 'shot_display.png'));
const shotOwner = getBase64Image(join(PROJECT_DIR, 'docs', 'shot_owner.png'));

const htmlContent = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Modul Panduan Menjalankan Demo Maucafe</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 0;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: 'Segoe UI', Roboto, Arial, sans-serif;
    }
    body {
      background-color: #F8F6F0;
      color: #2D2D2D;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page {
      width: 210mm;
      min-height: 297mm;
      padding: 15mm;
      position: relative;
      page-break-after: always;
      background: #FFFFFF;
    }
    .header-bar {
      background: linear-gradient(135deg, #B91C1C 0%, #991B1B 100%);
      color: white;
      padding: 18px 24px;
      border-radius: 12px;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 4px 12px rgba(185, 28, 28, 0.15);
    }
    .header-title h1 {
      font-size: 20px;
      font-weight: 700;
      letter-spacing: 0.5px;
    }
    .header-title p {
      font-size: 12px;
      opacity: 0.9;
      margin-top: 2px;
    }
    .header-badge {
      background: rgba(255, 255, 255, 0.2);
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 600;
    }
    .section-title {
      font-size: 15px;
      font-weight: 700;
      color: #991B1B;
      border-bottom: 2px solid #FEE2E2;
      padding-bottom: 6px;
      margin-top: 20px;
      margin-bottom: 14px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .grid-3 {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-bottom: 15px;
    }
    .card {
      background: #FFF5F5;
      border: 1px solid #FECACA;
      border-radius: 10px;
      padding: 12px;
    }
    .card-title {
      font-size: 13px;
      font-weight: 700;
      color: #991B1B;
      margin-bottom: 4px;
    }
    .card-desc {
      font-size: 11px;
      color: #4B5563;
      line-height: 1.4;
    }
    .card-pin {
      margin-top: 6px;
      display: inline-block;
      background: #B91C1C;
      color: white;
      font-size: 10px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 4px;
    }
    .step-box {
      background: #F9FAFB;
      border-left: 4px solid #B91C1C;
      padding: 12px 16px;
      border-radius: 0 8px 8px 0;
      margin-bottom: 12px;
    }
    .step-num {
      font-size: 11px;
      font-weight: 700;
      color: #B91C1C;
      text-transform: uppercase;
      margin-bottom: 2px;
    }
    .step-text {
      font-size: 12px;
      font-weight: 600;
      color: #1F2937;
    }
    .step-detail {
      font-size: 11px;
      color: #4B5563;
      margin-top: 4px;
      line-height: 1.4;
    }
    .screenshot-container {
      margin-top: 10px;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid #E5E7EB;
      box-shadow: 0 2px 6px rgba(0,0,0,0.06);
    }
    .screenshot-container img {
      width: 100%;
      display: block;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
      font-size: 11px;
    }
    th, td {
      border: 1px solid #E5E7EB;
      padding: 8px 12px;
      text-align: left;
    }
    th {
      background: #F3F4F6;
      color: #1F2937;
      font-weight: 700;
    }
    td {
      color: #374151;
    }
    .footer-bar {
      position: absolute;
      bottom: 12mm;
      left: 15mm;
      right: 15mm;
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      color: #9CA3AF;
      border-top: 1px solid #E5E7EB;
      padding-top: 8px;
    }
  </style>
</head>
<body>

  <!-- HALAMAN 1 -->
  <div class="page">
    <div class="header-bar">
      <div class="header-title">
        <h1>PANDUAN MENJALANKAN DEMO MAUCAFE</h1>
        <p>Sistem Antrean Digital Signage TV & Monitoring Kasir Outlet</p>
      </div>
      <div class="header-badge">MODUL PRAKTIS</div>
    </div>

    <div class="section-title">📌 Ringkasan 3 Layar Utama Aplikasi</div>
    <div class="grid-3">
      <div class="card">
        <div class="card-title">1. Layar TV Display</div>
        <div class="card-desc">Dipasang di TV Outlet. Menampilkan nomor pemanggilan antrean & pemutar media promo (foto/video).</div>
        <span class="card-pin">Buka: /display</span>
      </div>
      <div class="card">
        <div class="card-title">2. HP Kasir (Admin)</div>
        <div class="card-desc">Dipasang di HP Kasir. Input pesanan, pilih Tunai/QRIS, memanggil antrean & tombol selesai.</div>
        <span class="card-pin">PIN: 1111</span>
      </div>
      <div class="card">
        <div class="card-title">3. HP Pemilik (Owner)</div>
        <div class="card-desc">Dipasang di HP Pemilik. Pemantauan omzet kotor, Tunai vs QRIS, modal/HPP & keuntungan bersih.</div>
        <span class="card-pin">PIN: 1234</span>
      </div>
    </div>

    <div class="section-title">🚀 Langkah demi Langkah Menyalakan Demo</div>

    <div class="step-box">
      <div class="step-num">Langkah 1</div>
      <div class="step-text">Menyalakan Aplikasi di Laptop</div>
      <div class="step-detail">
        Buka folder aplikasi di laptop, lalu <strong>klik 2 kali file JALANKAN_DEMO.bat</strong>. Jendela hitam kecil akan muncul dan aplikasi otomatis aktif dalam beberapa detik. Jangan tutup jendela ini selama demo.
      </div>
    </div>

    <div class="step-box">
      <div class="step-num">Langkah 2</div>
      <div class="step-text">Menyambungkan HP & Laptop (Wi-Fi yang Sama)</div>
      <div class="step-detail">
        Pastikan Laptop dan HP terhubung ke Wi-Fi/Hotspot yang sama. Cari IP Laptop dengan membuka Command Prompt (<code>cmd</code>), ketik <code>ipconfig</code>, lalu catat angka pada <strong>IPv4 Address</strong> (contoh: <code>192.168.1.15</code>).
      </div>
    </div>

    <div class="step-box">
      <div class="step-num">Langkah 3</div>
      <div class="step-text">Membuka Alamat Layar di Browser</div>
      <div class="step-detail">
        - <strong>Layar TV (Laptop)</strong>: Buka <code>http://localhost:3000/display</code> lalu klik <strong>Aktifkan Suara</strong>.<br>
        - <strong>HP Kasir</strong>: Buka <code>http://192.168.1.15:3000/admin</code> (PIN Kasir: <code>1111</code>).<br>
        - <strong>HP Pemilik</strong>: Buka <code>http://192.168.1.15:3000/owner</code> (PIN Pemilik: <code>1234</code>).
      </div>
    </div>

    ${shotDisplay ? `
    <div class="screenshot-container" style="max-height: 160px;">
      <img src="${shotDisplay}" alt="Display TV Demo">
    </div>
    ` : ''}

    <div class="footer-bar">
      <span>Dokumen Panduan Demo Maucafe</span>
      <span>Halaman 1 dari 2</span>
    </div>
  </div>

  <!-- HALAMAN 2 -->
  <div class="page">
    <div class="header-bar">
      <div class="header-title">
        <h1>ALUR SIMULASI & PENANGANAN KENDALA</h1>
        <p>Petunjuk Alur Penggunaan & Troubleshooting Sederhana</p>
      </div>
      <div class="header-badge">HALAMAN 2</div>
    </div>

    <div class="section-title">🔄 Alur Simulasi Transaksi Kasir & TV</div>
    
    <div class="step-box">
      <div class="step-num">Tahap 1</div>
      <div class="step-text">Input Pesanan di HP Kasir</div>
      <div class="step-detail">Pilih item kopi di HP Kasir, tentukan metode pembayaran (Tunai / QRIS), lalu tekan tombol <strong>Bayar Rp… · Tunai/QRIS</strong>. Nomor antrean otomatis diterbitkan.</div>
    </div>

    <div class="step-box">
      <div class="step-num">Tahap 2</div>
      <div class="step-text">Memanggil Nomor Antrean</div>
      <div class="step-detail">Di HP Kasir, buka tab <strong>Pesanan</strong> lalu tekan <strong>Panggil</strong>. Nomor antrean akan muncul besar di layar TV disertai panggilan suara otomatis.</div>
    </div>

    <div class="step-box">
      <div class="step-num">Tahap 3</div>
      <div class="step-text">Menyerahkan Pesanan & Cek Pemilik Toko</div>
      <div class="step-detail">Setelah kopi diambil, tekan <strong>Selesai</strong> di HP Kasir. Buka HP Pemilik (<code>/owner</code>) untuk melihat update penjualan bersih, total diterima, rincian pembayaran, dan laba kotor secara real-time.</div>
    </div>

    <div class="grid-3" style="grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px;">
      ${shotAdmin ? `
      <div class="screenshot-container">
        <img src="${shotAdmin}" alt="HP Kasir Admin">
      </div>
      ` : ''}
      ${shotOwner ? `
      <div class="screenshot-container">
        <img src="${shotOwner}" alt="HP Pemilik Owner">
      </div>
      ` : ''}
    </div>

    <div class="section-title">❓ Pertanyaan & Troubleshooting Sederhana</div>
    <table>
      <thead>
        <tr>
          <th>Kendala</th>
          <th>Penyebab</th>
          <th>Solusi Cepat</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Suara TV Tidak Berbunyi</strong></td>
          <td>Browser memblokir suara otomatis</td>
          <td>Tekan tombol merah <strong>"Aktifkan Suara"</strong> di pojok layar TV.</td>
        </tr>
        <tr>
          <td><strong>HP Tulisannya "Koneksi Terputus"</strong></td>
          <td>Server laptop mati / beda Wi-Fi</td>
          <td>Pastikan file <code>JALANKAN_DEMO.bat</code> masih aktif dan HP tersambung Wi-Fi yang sama.</td>
        </tr>
        <tr>
          <td><strong>Ingin Matikan Demo</strong></td>
          <td>Selesai peragaan</td>
          <td>Tutup jendela layar hitam (<code>JALANKAN_DEMO.bat</code>). Data transaksi tersimpan aman.</td>
        </tr>
      </tbody>
    </table>

    <div class="footer-bar">
      <span>Dokumen Panduan Demo Maucafe</span>
      <span>Halaman 2 dari 2</span>
    </div>
  </div>

</body>
</html>`;

const tempHtmlPath = join(PROJECT_DIR, 'docs', 'panduan_demo.html');
const outputPdfPath = join(PROJECT_DIR, 'Panduan_Menjalankan_Demo_Maucafe.pdf');

writeFileSync(tempHtmlPath, htmlContent, 'utf-8');
console.log('HTML panduan created:', tempHtmlPath);

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const cmd = `powershell -Command "Start-Process '${edgePath}' -ArgumentList '--headless', '--no-pdf-header-footer', '--print-to-pdf=${outputPdfPath}', '${tempHtmlPath}' -Wait"`;

console.log('Generating PDF via Edge...');
execSync(cmd);
console.log('SUCCESS: PDF created at:', outputPdfPath);
