import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = join(MODULE_DIR, '..');

// Helper to convert image to base64 Data URI
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
  <title>Prototype Sistem Antrean MAUCAFE</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 0;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    }
    body {
      background-color: #F8F6F0;
      color: #2D2D2D;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page {
      width: 210mm;
      height: 297mm;
      padding: 20mm 18mm;
      position: relative;
      page-break-after: always;
      background: #FFFFFF;
      display: flex;
      flex-direction: column;
    }
    .page:last-child {
      page-break-after: avoid;
    }

    /* Cover Page Styling */
    .cover-page {
      background: linear-gradient(135deg, #C62828 0%, #8E0000 100%);
      color: #FFFFFF;
      justify-content: center;
      align-items: center;
      text-align: center;
    }
    .cover-brand {
      background: #FFFFFF;
      color: #C62828;
      font-size: 24px;
      font-weight: 900;
      padding: 12px 30px;
      border-radius: 50px;
      letter-spacing: 2px;
      margin-bottom: 30px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.2);
      display: inline-block;
    }
    .cover-title {
      font-size: 34px;
      font-weight: 800;
      margin-bottom: 15px;
      line-height: 1.2;
    }
    .cover-subtitle {
      font-size: 17px;
      font-weight: 400;
      opacity: 0.95;
      max-width: 520px;
      margin: 0 auto 35px auto;
      line-height: 1.5;
    }
    .cover-badge {
      background: rgba(255,255,255,0.15);
      border: 1px solid rgba(255,255,255,0.3);
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 13px;
      letter-spacing: 1px;
    }

    /* Header & Footer */
    .header-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 3px solid #C62828;
      padding-bottom: 12px;
      margin-bottom: 20px;
    }
    .header-logo {
      font-weight: 800;
      font-size: 20px;
      color: #C62828;
      letter-spacing: 1px;
    }
    .header-tag {
      font-size: 12px;
      font-weight: 600;
      color: #666;
      text-transform: uppercase;
    }

    .footer-bar {
      margin-top: auto;
      border-top: 1px solid #EEEEEE;
      padding-top: 10px;
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      color: #888888;
    }

    /* Section Styling */
    .section-title {
      font-size: 22px;
      font-weight: 700;
      color: #1A1A1A;
      margin-bottom: 8px;
    }
    .section-desc {
      font-size: 13px;
      color: #555;
      margin-bottom: 18px;
      line-height: 1.5;
    }

    .screenshot-box {
      border: 2px solid #E0E0E0;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 6px 18px rgba(0,0,0,0.06);
      margin-bottom: 18px;
      background: #FAFAFA;
      text-align: center;
    }
    .screenshot-box img {
      width: 100%;
      height: auto;
      display: block;
      max-height: 460px;
      object-fit: contain;
    }

    .features-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .feature-card {
      background: #FDFBF7;
      border-left: 4px solid #C62828;
      padding: 12px 14px;
      border-radius: 4px;
    }
    .feature-title {
      font-size: 13px;
      font-weight: 700;
      color: #C62828;
      margin-bottom: 4px;
    }
    .feature-text {
      font-size: 12px;
      color: #444;
      line-height: 1.4;
    }

    /* Hardware Specs Cards */
    .spec-card {
      background: #FFFFFF;
      border: 1px solid #E2E8F0;
      border-radius: 8px;
      padding: 13px 15px;
      margin-bottom: 11px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.03);
    }
    .spec-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 5px;
    }
    .spec-name {
      font-size: 14px;
      font-weight: 700;
      color: #C62828;
    }
    .spec-badge {
      background: #FFEBEE;
      color: #C62828;
      font-size: 11px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 4px;
    }
    .spec-badge-green {
      background: #E8F5E9;
      color: #2E7D32;
      font-size: 11px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 4px;
    }
    .spec-detail {
      font-size: 12px;
      color: #333333;
      line-height: 1.5;
    }

    .checklist-list {
      list-style: none;
      padding-left: 0;
      margin-top: 5px;
    }
    .checklist-list li {
      font-size: 12px;
      color: #444;
      margin-bottom: 4px;
      padding-left: 18px;
      position: relative;
    }
    .checklist-list li::before {
      content: '✔';
      position: absolute;
      left: 0;
      color: #2E7D32;
      font-weight: bold;
    }

    /* Info Box */
    .info-banner {
      background: #FFF3E0;
      border: 1px solid #FFE0B2;
      border-radius: 8px;
      padding: 14px;
      margin-top: 10px;
    }
    .info-banner-title {
      font-weight: 700;
      color: #E65100;
      font-size: 13px;
      margin-bottom: 4px;
    }
    .info-banner-text {
      font-size: 12px;
      color: #4E2C00;
      line-height: 1.4;
    }
  </style>
</head>
<body>

  <!-- COVER PAGE -->
  <div class="page cover-page">
    <div class="cover-brand">MAUCAFE KIOSK</div>
    <div class="cover-title">DOKUMEN PROTOTYPE<br>SISTEM ANTREAN & DIGITAL SIGNAGE</div>
    <div class="cover-subtitle">Visualisasi Alur Operasional Outlet, Spesifikasi Kebutuhan Perangkat Keras (Hardware), dan Opsi Deployment (Hosting / Lokal)</div>
    <div class="cover-badge">DOKUMEN PROPOSAL OUTLET • MAUCAFE</div>
  </div>

  <!-- PAGE 1: ADMIN KASIR -->
  <div class="page">
    <div class="header-bar">
      <div class="header-logo">MAUCAFE QUEUE</div>
      <div class="header-tag">ALUR 1: PANEL ADMIN / KASIR (/admin)</div>
    </div>

    <div class="section-title">1. Tampilan Awal & Input Kasir (Tablet / HP)</div>
    <div class="section-desc">
      Panel admin dirancang khusus untuk kenyamanan kasir di layar tablet atau HP. Tombol berukuran besar mencegah salah tekan saat operasional sibuk.
    </div>

    <div class="screenshot-box">
      ${shotAdmin ? `<img src="${shotAdmin}" alt="Admin Panel">` : '<div style="padding:40px;color:#999;">Tangkapan Layar Admin</div>'}
    </div>

    <div class="features-grid">
      <div class="feature-card">
        <div class="feature-title">Panggil Antrean (Satu Sentuhan)</div>
        <div class="feature-text">Nomor antrean aktif langsung naik dan membunyikan suara bel pemanggilan ke layar TV outlet secara instan.</div>
      </div>
      <div class="feature-card">
        <div class="feature-title">Input Pesanan Kopi & Pembayaran</div>
        <div class="feature-text">Kasir dapat mencatat pesanan menu MAUCAFE serta memilih metode bayar Tunai (Cash) atau QRIS Bank.</div>
      </div>
      <div class="feature-card">
        <div class="feature-title">Koreksi & Reset Antrean</div>
        <div class="feature-text">Dilengkapi tombol kurangi nomor jika ada koreksi, serta tombol Reset Antrean yang dilindungi PIN Keamanan.</div>
      </div>
      <div class="feature-card">
        <div class="feature-title">Indikator Koneksi Real-Time</div>
        <div class="feature-text">Indikator status Wi-Fi/koneksi aktif memastikan kasir selalu mengetahui bahwa layar TV terhubung.</div>
      </div>
    </div>

    <div class="footer-bar">
      <span>Dokumen Prototype MAUCAFE Queue Display</span>
      <span>Halaman 2 dari 5</span>
    </div>
  </div>

  <!-- PAGE 2: LAYAR DISPLAY TV -->
  <div class="page">
    <div class="header-bar">
      <div class="header-logo">MAUCAFE QUEUE</div>
      <div class="header-tag">ALUR 2: LAYAR DISPLAY TV OUTLET (/display)</div>
    </div>

    <div class="section-title">2. Tampilan Layar TV Antrean & Promo (16:9)</div>
    <div class="section-desc">
      Tampilan TV pelanggan membagi layar menjadi area nomor antrean yang besar & jelas (terbaca dari 2-3 meter) serta area promosi menu/video MAUCAFE.
    </div>

    <div class="screenshot-box">
      ${shotDisplay ? `<img src="${shotDisplay}" alt="Display TV">` : '<div style="padding:40px;color:#999;">Tangkapan Layar Display TV</div>'}
    </div>

    <div class="features-grid">
      <div class="feature-card">
        <div class="feature-title">Ukuran Angka Ekstra Besar</div>
        <div class="feature-text">Nomor antrean utama ditampilkan dengan ukuran sangat mencolok agar pelanggan tidak melewatkan giliran.</div>
      </div>
      <div class="feature-card">
        <div class="feature-title">Update Otomatis Tanpa Refresh</div>
        <div class="feature-text">Begitu kasir menekan tombol panggil di HP, nomor di layar TV memperbarui secara langsung dalam hitungan milidetik.</div>
      </div>
      <div class="feature-card">
        <div class="feature-title">Putar Video & Promo Otomatis</div>
        <div class="feature-text">Area kanan memutar media promosi/iklan varian kopi MAUCAFE secara berulang (looping) untuk menarik pembeli.</div>
      </div>
      <div class="feature-card">
        <div class="feature-title">Identitas Merah Ikonik MAUCAFE</div>
        <div class="feature-text">Warna latar dan aksen disesuaikan dengan ciri khas merah MAUCAFE yang modern dan bersih.</div>
      </div>
    </div>

    <div class="footer-bar">
      <span>Dokumen Prototype MAUCAFE Queue Display</span>
      <span>Halaman 3 dari 5</span>
    </div>
  </div>

  <!-- PAGE 3: MONITORING OWNER -->
  <div class="page">
    <div class="header-bar">
      <div class="header-logo">MAUCAFE QUEUE</div>
      <div class="header-tag">ALUR 3: MONITORING PEMILIK STORE (/owner)</div>
    </div>

    <div class="section-title">3. Panel Pemilik (Owner) & Ringkasan Laporan</div>
    <div class="section-desc">
      Pemilik toko dapat memantau omzet harian, transaksi aktif, serta kecocokan kas tunai vs QRIS secara langsung dari ponsel pribadi.
    </div>

    <div class="screenshot-box">
      ${shotOwner ? `<img src="${shotOwner}" alt="Owner Dashboard">` : '<div style="padding:40px;color:#999;">Tangkapan Layar Owner</div>'}
    </div>

    <div class="info-banner">
      <div class="info-banner-title">Fitur Keamanan & Manajemen Penjualan Pemilik:</div>
      <div class="info-banner-text">
        1. <strong>Pengunci PIN Pemilik (Owner PIN)</strong>: Fitur sensitif seperti reset nomor dan pembersihan data memerlukan PIN khusus agar mencegah kecurangan kasir.<br>
        2. <strong>Pencocokan Uang Kasir (Tunai vs QRIS)</strong>: Rincian transaksi langsung mengelompokkan jumlah uang tunai di laci kasir dan uang masuk ke rekening QRIS Bank.<br>
        3. <strong>Pembersihan Riwayat Otomatis</strong>: Data transaksi lama disederhanakan otomatis agar aplikasi tetap cepat tanpa memberatkan perangkat.
      </div>
    </div>

    <div class="footer-bar">
      <span>Dokumen Prototype MAUCAFE Queue Display</span>
      <span>Halaman 4 dari 5</span>
    </div>
  </div>

  <!-- PAGE 4: PERANGKAT & OPSI HOSTING CLOUD -->
  <div class="page">
    <div class="header-bar">
      <div class="header-logo">MAUCAFE QUEUE</div>
      <div class="header-tag">OPSI SETUP & PERANGKAT DIBUTUHKAN</div>
    </div>

    <div class="section-title">4. Pilihan Setup Server & Perangkat Outlet</div>
    <div class="section-desc">
      Aplikasi ini fleksibel: Bisa di-online-kan ke Cloud Hosting (tanpa laptop di toko) atau dijalankan offline di jaringan toko.
    </div>

    <div class="spec-card" style="border-left: 4px solid #2E7D32;">
      <div class="spec-header">
        <span class="spec-name">OPSI A: Cloud Server Hosting (DIREKOMENDASIKAN Jika Klien Tidak Punya Laptop)</span>
        <span class="spec-badge-green">TANPA LAPTOP DI STORE</span>
      </div>
      <div class="spec-detail">
        Aplikasi dipasang di Cloud Server berbayar murah (~Rp50rb - Rp75rb / bulan). Server aktif 24/7 di internet.
        <ul class="checklist-list">
          <li><strong>Tablet / HP Kasir</strong>: Cukup buka browser alamat website outlet (misal: <code>outlet-maucafe.com/admin</code>).</li>
          <li><strong>Layar Display TV</strong>: Buka alamat display di Smart TV atau TV biasa + Android TV Box murah (~Rp200rb).</li>
          <li><strong>Keunggulan Utama</strong>: <strong>Outlet tidak memerlukan komputer / laptop sama sekali</strong>. Bebas perawatan fisik server.</li>
        </ul>
      </div>
    </div>

    <div class="spec-card">
      <div class="spec-header">
        <span class="spec-name">OPSI B: Server Lokal Store (Lokal Wi-Fi Offline)</span>
        <span class="spec-badge">OPSI ALTERNATIF</span>
      </div>
      <div class="spec-detail">
        Aplikasi dijalankan secara lokal di dalam outlet menggunakan laptop atau perangkat mini PC lokal.
        <ul class="checklist-list">
          <li><strong>Perangkat Server</strong>: Laptop Windows/Mac ATAU STB Mini PC (~Rp300rb sekali beli) yang standby di toko.</li>
          <li><strong>Keunggulan Utama</strong>: Berjalan 100% lokal via Wi-Fi toko tanpa memerlukan kuota internet bulanan.</li>
        </ul>
      </div>
    </div>

    <div class="spec-card">
      <div class="spec-header">
        <span class="spec-name">Daftar Perangkat Outlet (Hardware Checklist)</span>
        <span class="spec-badge">RINGKASAN</span>
      </div>
      <div class="spec-detail">
        <ul class="checklist-list">
          <li><strong>1 Unit Tablet / HP Kasir</strong>: Layar min. 5 inci, RAM 2GB, koneksi internet/Wi-Fi.</li>
          <li><strong>1 Unit Layar TV Display</strong>: Smart TV / TV LED 32-50 inci (Rasio 16:9 1080p).</li>
          <li><strong>1 Unit Android TV Box / Dongle (Opsional)</strong>: Jika TV outlet bukan Smart TV (harga ~Rp200rb sekali beli).</li>
        </ul>
      </div>
    </div>

    <div class="footer-bar">
      <span>Dokumen Prototype MAUCAFE Queue Display</span>
      <span>Halaman 5 dari 5</span>
    </div>
  </div>

</body>
</html>`;

const tempHtmlPath = join(PROJECT_DIR, 'docs', 'prototype_presentation.html');
const outputPdfPath = join(PROJECT_DIR, 'Prototype_Antrean_Maucafe.pdf');

writeFileSync(tempHtmlPath, htmlContent, 'utf-8');
console.log('HTML presentation updated:', tempHtmlPath);

// Convert HTML to PDF using Edge headless
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const cmd = `powershell -Command "Start-Process '${edgePath}' -ArgumentList '--headless', '--no-pdf-header-footer', '--print-to-pdf=${outputPdfPath}', '${tempHtmlPath}' -Wait"`;

console.log('Generating updated PDF via Edge...');
execSync(cmd);
console.log('SUCCESS: Updated PDF saved to:', outputPdfPath);
