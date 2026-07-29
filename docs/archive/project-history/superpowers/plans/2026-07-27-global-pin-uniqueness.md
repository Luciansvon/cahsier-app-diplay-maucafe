# Global PIN Uniqueness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menolak PIN yang sama di seluruh credential Owner, Admin outlet, Mitra, dan Karyawan tanpa menyimpan PIN plaintext.

**Architecture:** Tambahkan helper pemeriksaan kumpulan hash di modul security, lalu panggil helper tersebut dari seluruh jalur tulis dan login credential di server. Pemeriksaan tulis berjalan di mutation lock yang sudah ada agar hasil cek dan penyimpanan tetap serial.

**Tech Stack:** Node.js 22, `node:crypto` scrypt, Node test runner, SQLite state store.

---

### Task 1: Helper pencocokan credential

**Files:**
- Modify: `src/security.js`
- Test: `test/security.test.js`

- [x] **Step 1: Write the failing test**

Tambahkan test untuk menghitung key credential yang cocok terhadap satu PIN dan memastikan hash rusak diabaikan.

- [x] **Step 2: Run test to verify it fails**

Run: `node --test test/security.test.js`

Expected: FAIL karena helper belum diekspor.

- [x] **Step 3: Write minimal implementation**

Ekspor helper yang menerima array `{ key, hash }`, memakai `verifyPinHash`, dan hanya mengembalikan key yang cocok.

- [x] **Step 4: Run test to verify it passes**

Run: `node --test test/security.test.js`

Expected: PASS.

### Task 2: Tolak PIN duplikat pada semua jalur tulis

**Files:**
- Modify: `src/server.js`
- Test: `test/server.test.js`

- [x] **Step 1: Write the failing tests**

Tambahkan API test untuk pembuatan Mitra, pembuatan/reset Karyawan, rotasi Admin, dan rotasi Owner memakai PIN credential lain. Pastikan respons `409`, pesan generik, PIN lama tetap bisa login, dan PIN konflik tidak tersimpan.

- [x] **Step 2: Run tests to verify they fail**

Run: `node --test --test-name-pattern="duplicate PIN" test/server.test.js`

Expected: FAIL karena endpoint masih menerima PIN duplikat.

- [x] **Step 3: Write minimal implementation**

Bentuk daftar seluruh hash credential. Sebelum mutation menyimpan PIN, validasi format lalu tolak jika cocok dengan key selain credential target. Jalankan rotasi Owner melalui mutation lock yang sama.

- [x] **Step 4: Run tests to verify they pass**

Run: `node --test --test-name-pattern="duplicate PIN" test/server.test.js`

Expected: PASS.

### Task 3: Fail closed untuk collision data lama

**Files:**
- Modify: `src/server.js`
- Test: `test/server.test.js`

- [x] **Step 1: Write the failing test**

Buat fixture dengan dua credential ber-PIN sama lalu pastikan login terkait ditolak tanpa nama akun konflik.

- [x] **Step 2: Run test to verify it fails**

Run: `node --test --test-name-pattern="legacy PIN collision" test/server.test.js`

Expected: FAIL karena login masih menerima salah satu credential.

- [x] **Step 3: Write minimal implementation**

Sebelum autentikasi berhasil, hitung jumlah credential yang cocok. Jika lebih dari satu, kembalikan error login generik yang sudah dipakai route tersebut.

- [x] **Step 4: Run test to verify it passes**

Run: `node --test --test-name-pattern="legacy PIN collision" test/server.test.js`

Expected: PASS.

### Task 4: Dokumentasi dan verifikasi

**Files:**
- Modify: `README.md`

- [x] Tambahkan kontrak PIN unik global dan perilaku collision legacy.
- [x] Jalankan `npm test`.
- [x] Jalankan `npm run build`.
- [x] Jalankan smoke test API credential pada server fixture.
- [x] Periksa diff hanya pada file yang disentuh task ini.
