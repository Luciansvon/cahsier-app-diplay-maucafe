# Owner Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mengubah `/owner` menjadi dashboard pantau cepat di HP, memperbaiki layar yang menumpuk, dan menghentikan kebocoran PIN melalui API umum.

**Architecture:** Server membuat sesi owner berbasis cookie setelah PIN diterima. Data umum tidak mengandung credential. Halaman owner memiliki tiga view yang saling eksklusif: login, ringkasan, serta laporan/pengaturan.

**Tech Stack:** Node.js HTTP server, JavaScript modules, HTML, CSS, Node test runner.

---

### Task 1: Kontrak owner dan API aman

**Files:**
- Modify: `test/ui-contract.test.js`
- Modify: `test/server.test.js`

- [ ] Tambahkan tes kontrak untuk `owner-login`, `owner-dashboard`, `owner-settings`, `owner-revenue`, `owner-active-count`, `owner-updated-at`, dan `danger-confirmation`.
- [ ] Tambahkan tes bahwa `/api/state` tidak memiliki `ownerPin`.
- [ ] Tambahkan tes login salah ditolak, login benar memberi cookie, `/api/owner/state` memerlukan cookie, dan logout menutup sesi.
- [ ] Jalankan `node --test test/ui-contract.test.js test/server.test.js` dan pastikan tes gagal karena kontrak belum diterapkan.

### Task 2: Sesi server dan data owner

**Files:**
- Modify: `src/server.js`
- Modify: `src/queue.js`
- Modify: `test/queue.test.js`

- [ ] Buat `publicState(state)` yang menghapus `ownerPin` dari respons dan event umum.
- [ ] Buat sesi acak di memori dengan masa aktif delapan jam dan cookie `owner_session` beratribut `HttpOnly; SameSite=Strict; Path=/`.
- [ ] Tambahkan `POST /api/owner/login`, `POST /api/owner/logout`, dan `GET /api/owner/state`.
- [ ] Wajibkan sesi pada ganti PIN, reset owner, purge, dan clear.
- [ ] Jangan mengirim PIN baru dalam respons perubahan PIN.
- [ ] Jalankan `node --test test/queue.test.js test/server.test.js`.

### Task 3: UI pantau cepat

**Files:**
- Modify: `public/owner.html`
- Modify: `public/owner.js`
- Modify: `public/styles.css`

- [ ] Tambahkan aturan `[hidden] { display: none !important; }` agar view tidak menumpuk.
- [ ] Susun kartu omzet, Tunai, QRIS, Transaksi, dan Antrean Aktif sebagai isi pertama dashboard.
- [ ] Tampilkan waktu pembaruan dan pertahankan angka terakhir saat koneksi putus.
- [ ] Pindahkan reset, purge, clear, dan ganti PIN ke view laporan/pengaturan.
- [ ] Minta teks `HAPUS` sebelum clear dan konfirmasi sebelum reset.
- [ ] Gunakan endpoint login dan state owner; jangan simpan PIN di browser.
- [ ] Jalankan `node --test test/ui-contract.test.js`.

### Task 4: Dokumentasi dan verifikasi

**Files:**
- Modify: `README.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/ERROR_SOLUTIONS.md`
- Modify: `docs/WORKLOG.md`

- [ ] Dokumentasikan login owner, layout ringkasan, sesi, dan penanganan koneksi.
- [ ] Jalankan `npm test`.
- [ ] Jalankan `npm run build`.
- [ ] Uji `/owner` pada 360 x 800 dan ukuran laptop; pastikan hanya satu view terlihat, login bekerja, ringkasan terbaca, dan pengaturan tidak berada di halaman utama.
