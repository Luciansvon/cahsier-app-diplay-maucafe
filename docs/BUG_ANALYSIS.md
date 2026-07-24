# 🔍 Laporan Bug & Temuan Sistem

Hasil analisis mendalam terhadap seluruh codebase `nescafe-queue-display`.

---

## Status Umum

| Item | Hasil |
|------|-------|
| Test (25 test) | ✅ Semua lulus |
| Build | ✅ Sukses |
| Bug kritis (crash/data loss) | ⚠️ 2 ditemukan |
| Bug sedang (logic error) | ⚠️ 3 ditemukan |
| Bug ringan (UX/minor) | 💡 4 ditemukan |

---

## 🔴 Bug Kritis

### 1. `state.example.json` tidak punya `promoMedia` dan `ownerPinHash` — outlet baru akan crash

**File**: [state.example.json](file:///c:/Users/shint/Documents/Codex/2026-07-22/eh/nescafe-queue-display/data/state.example.json)

**Masalah**: File `state.example.json` yang dipakai `start()` di server sebagai `initialState` tidak memiliki field `promoMedia` dan `ownerPinHash`. Sementara di [queue.js L63](file:///c:/Users/shint/Documents/Codex/2026-07-22/eh/nescafe-queue-display/src/queue.js#L63), fungsi `createInitialState()` menghasilkan kedua field ini. Tapi `start()` di [server.js L840](file:///c:/Users/shint/Documents/Codex/2026-07-22/eh/nescafe-queue-display/src/server.js#L840) langsung memakai file example JSON, **bukan** `createInitialState()`.

**Dampak**:
- Outlet yang baru di-init dari `state.example.json` tidak punya `ownerPinHash` → Owner login akan selalu pakai fallback `DEFAULT_OWNER_PIN` ("1234") dan migrasi PIN ke hash tidak pernah terjadi otomatis pada first boot.
- `promoMedia` undefined → display.js tetap bisa jalan karena ada guard (`if (!promoMedia || !promoMedia.url) return false`), tapi admin.js `renderMediaStatus()` akan menampilkan "Video Bawaan" padahal sebenarnya state-nya kosong.

**Fix yang disarankan**: Tambahkan `promoMedia` dan `ownerPinHash` (atau `ownerPin`) ke `state.example.json`, atau ubah `start()` agar memanggil `createInitialState()` sebagai base lalu merge products dari example.

---

### 2. `adminPin` di-hardcode "1111" di `outlets.json` dan fallback di server

**File**: [outlets.json](file:///c:/Users/shint/Documents/Codex/2026-07-22/eh/nescafe-queue-display/data/outlets.json), [server.js L107-L112](file:///c:/Users/shint/Documents/Codex/2026-07-22/eh/nescafe-queue-display/src/server.js#L107-L112)

**Masalah**: AGENTS.md bilang *"Jangan hardcode password, token, atau credential."* Tapi:
- `outlets.json` menyimpan `adminPin: "1111"` untuk semua 5 outlet.
- Server fallback di line 107-112 juga hardcode `adminPin: '1111'`.

> [!CAUTION]
> Ini melanggar aturan AGENTS.md. PIN admin kasir tersimpan plain-text di file JSON yang tersedia di repo.

**Fix yang disarankan**: Pindahkan `adminPin` ke mekanisme yang lebih aman (misalnya hash seperti `ownerPinHash`), atau minimal buat file `.env` / file terpisah yang masuk `.gitignore`.

---

## 🟡 Bug Sedang (Logic Error)

### 3. `sales.js` — `unitPrice` salah ambil dari field yang tidak ada

**File**: [sales.js L23](file:///c:/Users/shint/Documents/Codex/2026-07-22/eh/nescafe-queue-display/public/sales.js#L23)

```js
unitPrice: item.price ?? (item.quantity > 0 ? Math.round(item.subtotal / item.quantity) : 0),
```

**Masalah**: Di `createOrder()` ([queue.js L86-L92](file:///c:/Users/shint/Documents/Codex/2026-07-22/eh/nescafe-queue-display/src/queue.js#L86-L92)), setiap item disimpan dengan field `unitPrice`, bukan `price`. Jadi `item.price` akan selalu `undefined`, dan kode jatuh ke fallback `Math.round(item.subtotal / item.quantity)`.

**Dampak**: Kebetulan fallback menghasilkan angka yang sama, jadi secara hasil akhir **masih benar**. Tapi ini tetap bug karena mengandalkan kalkulasi ulang padahal data sudah tersedia.

**Fix**: Ganti `item.price` menjadi `item.unitPrice`.

---

### 4. Display polling setiap 2 detik bersamaan dengan SSE — beban ganda yang tidak perlu

**File**: [display.js L196](file:///c:/Users/shint/Documents/Codex/2026-07-22/eh/nescafe-queue-display/public/display.js#L196)

```js
window.setInterval(syncState, 2000);
```

**Masalah**: Display sudah pakai SSE (EventSource) untuk real-time update di line 185-188. Tapi ada juga polling HTTP setiap 2 detik di line 196. Ini membuat setiap layar display mengirim **30 request/menit** yang tidak perlu ke server.

**Dampak**: 
- Beban server meningkat — kalau ada 5 outlet × 1 display = 150 request/menit ekstra.
- SSE sudah cukup untuk update real-time. Polling hanya berguna sebagai fallback kalau SSE putus, tapi seharusnya dicek dulu apakah SSE masih terhubung.

**Fix yang disarankan**: Ubah interval jadi lebih lama (misalnya 30 detik) sebagai fallback, atau hanya jalankan polling saat SSE disconnect.

---

### 5. `renderMediaStatus()` di admin.js rentan XSS (innerHTML)

**File**: [admin.js L127-L131](file:///c:/Users/shint/Documents/Codex/2026-07-22/eh/nescafe-queue-display/public/admin.js#L127-L131)

```js
currentMediaNode.innerHTML = `Media aktif: <strong>${typeLabel} (${promoMedia.filename})</strong>`;
```

**Masalah**: `promoMedia.filename` berasal dari nama file yang di-upload user. Kalau nama file mengandung karakter HTML (misalnya `<script>alert(1)</script>.mp4`), ini bisa dieksekusi sebagai HTML.

**Dampak**: Self-XSS — hanya admin yang bisa exploit diri sendiri, tapi tetap bad practice.

**Fix**: Pakai `textContent` atau escape HTML sebelum inject ke `innerHTML`.

---

## 💡 Bug Ringan / Improvement

### 6. `display.js` — `renderPromo()` crash kalau `promo` element null

**File**: [display.js L101](file:///c:/Users/shint/Documents/Codex/2026-07-22/eh/nescafe-queue-display/public/display.js#L101)

```js
promo.replaceChildren();
```

**Masalah**: Di line 100, ada check `if (promo) promo.hidden = false;`, tapi di line 101 langsung `promo.replaceChildren()` tanpa guard. Kalau `promo` null, akan throw error.

---

### 7. SSE EventSource tidak pernah reconnect di `display.js`

**File**: [display.js L183-L188](file:///c:/Users/shint/Documents/Codex/2026-07-22/eh/nescafe-queue-display/public/display.js#L183-L188)

**Masalah**: `EventSource` di browser otomatis reconnect, tapi setelah beberapa kali gagal, browser bisa menyerah. Tidak ada mekanisme manual reconnect. Di `admin.js` juga sama — SSE hanya dibuat sekali.

---

### 8. `admin.js` — `setConnection(false)` dipanggil saat API error non-network

**File**: [admin.js L100-L103](file:///c:/Users/shint/Documents/Codex/2026-07-22/eh/nescafe-queue-display/public/admin.js#L100-L103)

**Masalah**: Kalau API return error 400 (validation error), `catch` block menandai koneksi offline (`setConnection(false)`). Padahal koneksi tetap online, hanya request-nya yang salah. Ini bisa membingungkan kasir.

---

### 9. Owner export hardcode "5 Outlet" di judul laporan

**File**: [server.js L425](file:///c:/Users/shint/Documents/Codex/2026-07-22/eh/nescafe-queue-display/src/server.js#L425)

```html
<td colspan="9" class="title">Laporan Penjualan - Gabungan Semua Outlet (5 Outlet)</td>
```

**Masalah**: Angka "5" di-hardcode. Kalau jumlah outlet berubah (misalnya ditambah atau dikurangi), judul laporan tetap bilang "5 Outlet".

**Fix**: Ganti dengan `outletsConfig.length`.

---

## ✅ Hal yang Sudah Benar

- ✅ PIN owner sudah di-hash pakai `scrypt` + `timingSafeEqual` (aman dari timing attack)
- ✅ `JsonStore` pakai atomic write (tmp file + rename)
- ✅ Server handle concurrent updates dengan queue di `JsonStore`
- ✅ CORS tidak diset (aman untuk jaringan lokal)
- ✅ Server dengarkan di `0.0.0.0` (bisa diakses dari HP/device lain di jaringan)
- ✅ SSE keep-alive setiap 20 detik
- ✅ Semua 25 test lulus
- ✅ Build sukses

---

## Rekomendasi Prioritas Perbaikan

| Prioritas | Bug | Effort |
|-----------|-----|--------|
| 🔴 Tinggi | #2 AdminPin hardcode (langgar AGENTS.md) | Sedang |
| 🔴 Tinggi | #1 state.example.json tidak lengkap | Kecil |
| 🟡 Sedang | #3 `item.price` → `item.unitPrice` di sales.js | Kecil |
| 🟡 Sedang | #5 XSS di renderMediaStatus | Kecil |
| 🟡 Sedang | #9 Hardcode "5 Outlet" | Kecil |
| 💡 Ringan | #4 Polling + SSE ganda | Kecil |
| 💡 Ringan | #6 Null guard di renderPromo | Kecil |
| 💡 Ringan | #8 setConnection false saat validation error | Kecil |

> [!IMPORTANT]
> Mau aku perbaiki semua bug ini? Atau pilih yang mana dulu yang mau diperbaiki?
