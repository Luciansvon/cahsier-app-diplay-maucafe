# Unpadded Queue Voice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menampilkan nomor antrean tanpa nol depan dan menyuarakannya sebagai kata bilangan Bahasa Indonesia.

**Architecture:** `src/queue.js` tetap menjadi sumber nomor antrean baru. Helper browser terpisah di `public/queue-number.js` menormalisasi nomor legacy dan mengubah angka menjadi kata sebelum dikirim ke Web Speech API.

**Tech Stack:** Node.js ES modules, browser Web Speech API, `node:test`.

---

### Task 1: Format nomor baru

**Files:**
- Modify: `test/queue.test.js`
- Modify: `test/server.test.js`
- Modify: `src/queue.js`

- [ ] Ubah ekspektasi nomor pertama dari `'001'` menjadi `'1'`, lalu jalankan `node --test test/queue.test.js test/server.test.js` dan pastikan gagal pada format lama.
- [ ] Ganti `String(state.nextQueueNumber).padStart(3, '0')` menjadi `String(state.nextQueueNumber)`.
- [ ] Jalankan ulang test terfokus dan pastikan lulus.

### Task 2: Kata bilangan untuk suara

**Files:**
- Create: `public/queue-number.js`
- Create: `test/queue-number.test.js`
- Modify: `public/display.js`
- Modify: `scripts/build.js`
- Modify: `test/ui-contract.test.js`

- [ ] Tambah test untuk `queueNumberText()` dengan kasus `1`, `11`, `30`, `50`, `100`, dan legacy `050`, lalu jalankan dan pastikan gagal karena modul belum ada.
- [ ] Implementasikan helper konversi bilangan Bahasa Indonesia tanpa dependency.
- [ ] Impor helper di `display.js` dan gunakan hasilnya pada `SpeechSynthesisUtterance`.
- [ ] Daftarkan helper pada pemeriksaan syntax build dan perketat UI contract.
- [ ] Jalankan `node --test test/queue-number.test.js test/ui-contract.test.js` dan pastikan lulus.

### Task 3: Copy dan dokumentasi

**Files:**
- Modify: `public/owner.html`
- Modify: `public/owner.js`
- Modify: `docs/MODUL_PANDUAN_DEMO.md`
- Modify: `README.md`

- [ ] Ganti copy operasional “ke 001” menjadi “ke 1”.
- [ ] Dokumentasikan nomor tanpa nol depan dan pronunciation kata Indonesia.

### Task 4: Verifikasi

**Files:**
- Verify only

- [ ] Jalankan `npm test`.
- [ ] Jalankan `npm run build`.
- [ ] Jalankan `node scripts/test-live-flow.js`.
- [ ] Periksa diff hanya berisi perubahan yang terkait permintaan ini.
