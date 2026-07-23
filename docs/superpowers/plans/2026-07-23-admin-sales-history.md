# Admin sales history implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menambahkan tab Penjualan yang menghitung transaksi dibayar, mengecualikan pembatalan dari omzet, dan mempertahankan riwayat saat antrean direset.

**Architecture:** Ringkasan dihitung di browser dari state pesanan yang sudah dikirim melalui REST dan SSE. Helper murni `summarizeSales` dipisahkan ke modul kecil agar perhitungan dapat diuji tanpa DOM. Reset mempertahankan semua pesanan dan mengubah pesanan aktif menjadi batal.

**Tech stack:** Node.js ESM, HTML, CSS, JavaScript browser, `node:test`, REST, Server-Sent Events, JSON file storage.

---

## Struktur file

* Buat `public/sales.js` untuk perhitungan ringkasan tanpa akses DOM.
* Buat `test/sales.test.js` untuk kontrak omzet, metode bayar, produk, tanggal usaha, dan pembatalan.
* Ubah `src/queue.js` untuk mempertahankan riwayat saat reset.
* Ubah `test/queue.test.js` dan `test/server.test.js` untuk perilaku reset.
* Ubah `public/admin.html`, `public/admin.js`, dan `public/styles.css` untuk tab Penjualan.
* Ubah `scripts/build.js` agar helper penjualan ikut diperiksa sebagai JavaScript valid.
* Ubah `test/ui-contract.test.js` untuk kontrak elemen laporan.
* Ubah `README.md`, `docs/ARCHITECTURE.md`, dan `docs/WORKLOG.md` sesuai perilaku yang sudah diuji.

### Task 1: Helper ringkasan penjualan

**Files:**

* Create: `public/sales.js`
* Create: `test/sales.test.js`

- [ ] **Step 1: Tulis tes yang gagal**

```js
import test from 'node:test';
import assert from 'node:assert/strict';

import { summarizeSales } from '../public/sales.js';

const orders = [
  {
    id: 'waiting-cash', businessDate: '2026-07-23', status: 'waiting', paymentMethod: 'cash',
    total: 18000, createdAt: '2026-07-23T01:00:00.000Z',
    items: [{ productId: 'kopi', productName: 'Kopi Susu', quantity: 1, subtotal: 18000 }],
  },
  {
    id: 'completed-qris', businessDate: '2026-07-23', status: 'completed', paymentMethod: 'QRIS',
    total: 40000, createdAt: '2026-07-23T02:00:00.000Z',
    items: [{ productId: 'cokelat', productName: 'Chocolate', quantity: 2, subtotal: 40000 }],
  },
  {
    id: 'cancelled', businessDate: '2026-07-23', status: 'cancelled', paymentMethod: 'cash',
    total: 18000, createdAt: '2026-07-23T03:00:00.000Z',
    items: [{ productId: 'kopi', productName: 'Kopi Susu', quantity: 1, subtotal: 18000 }],
  },
  {
    id: 'other-date', businessDate: '2026-07-22', status: 'completed', paymentMethod: 'cash',
    total: 99000, createdAt: '2026-07-22T03:00:00.000Z', items: [],
  },
];

test('summarizes paid sales for one business date and excludes cancelled totals', () => {
  const summary = summarizeSales(orders, '2026-07-23');

  assert.equal(summary.revenue, 58000);
  assert.equal(summary.transactionCount, 2);
  assert.deepEqual(summary.paymentTotals, { cash: 18000, QRIS: 40000 });
  assert.deepEqual(summary.products, [
    { productId: 'cokelat', productName: 'Chocolate', quantity: 2, revenue: 40000 },
    { productId: 'kopi', productName: 'Kopi Susu', quantity: 1, revenue: 18000 },
  ]);
  assert.deepEqual(summary.transactions.map((order) => order.id), ['cancelled', 'completed-qris', 'waiting-cash']);
});

test('returns empty totals when the business date has no transactions', () => {
  assert.deepEqual(summarizeSales(orders, '2026-07-24'), {
    revenue: 0,
    transactionCount: 0,
    paymentTotals: { cash: 0, QRIS: 0 },
    products: [],
    transactions: [],
  });
});
```

- [ ] **Step 2: Jalankan tes dan pastikan gagal**

Run: `node --test test/sales.test.js`

Expected: FAIL karena `public/sales.js` belum tersedia.

- [ ] **Step 3: Buat implementasi minimal**

```js
export function summarizeSales(orders = [], businessDate) {
  const transactions = orders
    .filter((order) => order.businessDate === businessDate)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const counted = transactions.filter((order) => order.status !== 'cancelled');
  const paymentTotals = { cash: 0, QRIS: 0 };
  const products = new Map();

  for (const order of counted) {
    paymentTotals[order.paymentMethod] = (paymentTotals[order.paymentMethod] ?? 0) + order.total;
    for (const item of order.items) {
      const value = products.get(item.productId) ?? {
        productId: item.productId,
        productName: item.productName,
        quantity: 0,
        revenue: 0,
      };
      value.quantity += item.quantity;
      value.revenue += item.subtotal;
      products.set(item.productId, value);
    }
  }

  return {
    revenue: counted.reduce((sum, order) => sum + order.total, 0),
    transactionCount: counted.length,
    paymentTotals,
    products: [...products.values()].sort((left, right) => right.quantity - left.quantity || left.productName.localeCompare(right.productName)),
    transactions,
  };
}
```

- [ ] **Step 4: Jalankan tes dan pastikan lulus**

Run: `node --test test/sales.test.js`

Expected: 2 tests PASS.

- [ ] **Step 5: Commit**

```powershell
git add public/sales.js test/sales.test.js
git commit -m "feat: calculate daily sales summary"
```

### Task 2: Reset antrean tanpa menghapus riwayat

**Files:**

* Modify: `src/queue.js:127-134`
* Modify: `test/queue.test.js:76-86`
* Modify: `test/server.test.js:76-88`

- [ ] **Step 1: Ubah tes unit menjadi kontrak riwayat**

Ganti tes reset di `test/queue.test.js` dengan:

```js
test('reset cancels active orders and preserves closed sales history', () => {
  let state = stateWithMenu();
  const first = createOrder(state, { items: [{ productId: 'kopi-susu', quantity: 1 }], paymentMethod: 'cash' }, NOW);
  const second = createOrder(first.state, { items: [{ productId: 'kopi-susu', quantity: 1 }], paymentMethod: 'QRIS' }, NOW);
  state = completeOrder(second.state, first.order.id, NOW).state;
  state = callOrder(state, second.order.id, NOW).state;

  state = resetQueue(state, '2026-07-23T02:05:00.000Z');

  assert.equal(state.orders.length, 2);
  assert.equal(state.orders[0].status, 'completed');
  assert.equal(state.orders[1].status, 'cancelled');
  assert.equal(state.orders[1].updatedAt, '2026-07-23T02:05:00.000Z');
  assert.equal(state.activeCall, null);
  assert.equal(state.nextQueueNumber, 1);
});
```

Ubah assertion reset di `test/server.test.js` menjadi:

```js
assert.equal(reset.payload.state.orders.length, 1);
assert.equal(reset.payload.state.orders[0].status, 'cancelled');
assert.equal(reset.payload.state.activeCall, null);
assert.equal(reset.payload.state.nextQueueNumber, 1);
```

- [ ] **Step 2: Jalankan tes dan pastikan gagal**

Run: `node --test test/queue.test.js test/server.test.js`

Expected: FAIL karena reset masih menghapus `state.orders`.

- [ ] **Step 3: Ubah implementasi reset**

Ganti isi `resetQueue` di `src/queue.js` dengan:

```js
export function resetQueue(currentState, now = new Date().toISOString()) {
  const state = clone(currentState);
  state.businessDate = jakartaDate(now);
  state.nextQueueNumber = 1;
  for (const order of state.orders) {
    if (['waiting', 'ready'].includes(order.status)) {
      order.status = 'cancelled';
      order.updatedAt = now;
    }
  }
  state.activeCall = null;
  return changed(state);
}
```

- [ ] **Step 4: Jalankan tes dan pastikan lulus**

Run: `node --test test/queue.test.js test/server.test.js`

Expected: semua tes pada dua file PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/queue.js test/queue.test.js test/server.test.js
git commit -m "fix: preserve sales history on queue reset"
```

### Task 3: Tab Penjualan pada admin

**Files:**

* Modify: `public/admin.html:20-65`
* Modify: `public/admin.js:1-70,128-216`
* Modify: `public/styles.css:32-84,110-121`
* Modify: `scripts/build.js:6-12`
* Modify: `test/ui-contract.test.js:7-18`

- [ ] **Step 1: Tambah kontrak UI yang gagal**

Ubah tes admin di `test/ui-contract.test.js`:

```js
test('admin exposes cashier, orders, sales, menu, reset confirmation, and connection feedback', async () => {
  const [html, script, css] = await Promise.all([read('admin.html'), read('admin.js'), read('styles.css')]);
  for (const id of [
    'connection-status', 'cashier-panel', 'orders-panel', 'sales-panel', 'menu-panel',
    'reset-queue', 'product-form', 'sales-revenue', 'sales-count', 'sales-cash',
    'sales-qris', 'sold-products', 'sales-list',
  ]) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
  assert.match(script, /summarizeSales/);
  assert.match(script, /renderSales/);
  assert.match(script, /pesanan aktif akan dibatalkan/i);
  assert.match(script, /\/api\/orders/);
  assert.match(script, /\/api\/products/);
  assert.match(script, /EventSource/);
  assert.match(css, /\.sales-summary/);
  assert.match(css, /min-height:\s*48px/);
  assert.match(css, /@media\s*\(max-width:\s*600px\)/);
});
```

- [ ] **Step 2: Jalankan tes dan pastikan gagal**

Run: `node --test test/ui-contract.test.js`

Expected: FAIL karena elemen Penjualan dan fungsi render belum ada.

- [ ] **Step 3: Tambah markup Penjualan**

Ubah navigasi menjadi empat tombol dan sisipkan panel sebelum `menu-panel`:

```html
<nav class="tab-bar" aria-label="Menu admin">
  <button class="tab active" data-tab="cashier-panel">Kasir</button>
  <button class="tab" data-tab="orders-panel">Pesanan <span id="order-count" class="count">0</span></button>
  <button class="tab" data-tab="sales-panel">Penjualan</button>
  <button class="tab" data-tab="menu-panel">Menu</button>
</nav>

<section id="sales-panel" class="panel">
  <div class="section-heading">
    <div><p class="eyebrow">HARI INI</p><h2>Catatan penjualan</h2></div>
  </div>
  <div class="sales-summary">
    <article class="sales-card featured"><span>Omzet</span><strong id="sales-revenue">Rp0</strong></article>
    <article class="sales-card"><span>Transaksi</span><strong id="sales-count">0</strong></article>
    <article class="sales-card"><span>Tunai</span><strong id="sales-cash">Rp0</strong></article>
    <article class="sales-card"><span>QRIS</span><strong id="sales-qris">Rp0</strong></article>
  </div>
  <div class="sales-columns">
    <section class="sales-section">
      <h3>Produk terjual</h3>
      <div id="sold-products" class="sold-products"></div>
    </section>
    <section class="sales-section">
      <h3>Transaksi</h3>
      <div id="sales-list" class="sales-list"></div>
    </section>
  </div>
</section>
```

- [ ] **Step 4: Hubungkan helper dan render state**

Tambahkan import pada baris pertama `public/admin.js`:

```js
import { summarizeSales } from '/sales.js';
```

Tambahkan `renderSales();` di akhir `applyState`, lalu tambahkan fungsi berikut setelah `renderOrders`:

```js
const saleStatus = {
  waiting: 'Dibayar',
  ready: 'Siap',
  completed: 'Selesai',
  cancelled: 'Batal',
};

function transactionTime(value) {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(value));
}

function renderSales() {
  const summary = summarizeSales(state.orders, state.businessDate);
  $('#sales-revenue').textContent = rupiah(summary.revenue);
  $('#sales-count').textContent = String(summary.transactionCount);
  $('#sales-cash').textContent = rupiah(summary.paymentTotals.cash);
  $('#sales-qris').textContent = rupiah(summary.paymentTotals.QRIS);

  const products = $('#sold-products');
  products.replaceChildren();
  if (!summary.products.length) products.append(element('p', 'empty-state', 'Belum ada produk terjual.'));
  for (const product of summary.products) {
    const row = element('div', 'sold-product-row');
    const info = element('div');
    info.append(element('strong', '', product.productName), element('small', '', rupiah(product.revenue)));
    row.append(info, element('strong', 'sold-quantity', `${product.quantity} item`));
    products.append(row);
  }

  const list = $('#sales-list');
  list.replaceChildren();
  if (!summary.transactions.length) list.append(element('p', 'empty-state large', 'Belum ada transaksi hari ini.'));
  for (const order of summary.transactions) {
    const row = element('article', `sale-row ${order.status}`);
    const top = element('div', 'sale-top');
    const identity = element('div');
    identity.append(element('strong', 'sale-number', order.queueNumber), element('small', '', transactionTime(order.createdAt)));
    top.append(identity, element('span', 'status-pill', saleStatus[order.status]));
    const items = element('p', 'sale-items', order.items.map((item) => `${item.quantity}× ${item.productName}`).join(', '));
    const meta = element('div', 'sale-meta');
    meta.append(element('span', '', order.paymentMethod === 'cash' ? 'Tunai' : 'QRIS'), element('strong', '', rupiah(order.total)));
    row.append(top, items, meta);
    list.append(row);
  }
}
```

Ubah konfirmasi reset menjadi:

```js
if (window.confirm('Reset antrean? Semua pesanan aktif akan dibatalkan, tetapi riwayat penjualan tetap disimpan.')) {
```

- [ ] **Step 5: Tambah style responsif**

Ubah `.tab-bar` menjadi `grid-template-columns: repeat(4, 1fr);`, lalu tambahkan:

```css
.sales-summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 18px; }
.sales-card { min-width: 0; border: 1px solid var(--line); border-radius: 16px; padding: 15px; background: var(--cream); box-shadow: 0 5px 16px rgba(53, 31, 20, .06); }
.sales-card span, .sales-card strong { display: block; }
.sales-card span { margin-bottom: 8px; color: var(--muted); font-size: 12px; font-weight: 800; }
.sales-card strong { overflow-wrap: anywhere; font-family: Georgia, serif; font-size: clamp(20px, 3vw, 30px); }
.sales-card.featured { color: white; background: var(--red); }
.sales-card.featured span { color: rgba(255, 255, 255, .78); }
.sales-columns { display: grid; grid-template-columns: minmax(240px, .8fr) minmax(0, 1.4fr); gap: 16px; }
.sales-section { border: 1px solid var(--line); border-radius: 18px; padding: 16px; background: var(--cream); }
.sales-section h3 { margin: 0 0 12px; font-family: Georgia, serif; font-size: 22px; }
.sold-product-row, .sale-meta, .sale-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.sold-product-row { padding: 11px 0; border-bottom: 1px solid var(--line); }
.sold-product-row:last-child { border-bottom: 0; }
.sold-product-row small, .sale-top small { display: block; margin-top: 3px; color: var(--muted); }
.sold-quantity { white-space: nowrap; color: var(--red); }
.sales-list { display: grid; gap: 10px; }
.sale-row { border: 1px solid var(--line); border-radius: 14px; padding: 13px; background: white; }
.sale-row.cancelled { opacity: .58; }
.sale-number { font-family: Georgia, serif; font-size: 25px; }
.sale-items { margin: 10px 0; color: var(--muted); }
.sale-meta { padding-top: 10px; border-top: 1px solid var(--line); }
```

Tambahkan ke media query `max-width: 600px`:

```css
.tab { padding-inline: 4px; font-size: 12px; }
.sales-summary { grid-template-columns: 1fr 1fr; }
.sales-columns { grid-template-columns: 1fr; }
```

Tambahkan helper ke `requiredJavaScript` di `scripts/build.js`:

```js
const requiredJavaScript = [
  'src/queue.js',
  'src/store.js',
  'src/server.js',
  'public/sales.js',
  'public/admin.js',
  'public/display.js',
];
```

- [ ] **Step 6: Jalankan tes UI dan build**

Run: `node --test test/ui-contract.test.js`

Expected: 2 tests PASS.

Run: `npm run build`

Expected: `Build selesai: aset tervalidasi dan tersedia di dist/`.

- [ ] **Step 7: Commit**

```powershell
git add public/admin.html public/admin.js public/styles.css scripts/build.js test/ui-contract.test.js
git commit -m "feat: show daily sales in admin"
```

### Task 4: Dokumentasi dan verifikasi menyeluruh

**Files:**

* Modify: `README.md`
* Modify: `docs/ARCHITECTURE.md`
* Modify: `docs/WORKLOG.md`

- [ ] **Step 1: Perbarui dokumentasi perilaku**

Tambahkan ke alur penggunaan README:

```markdown
7. Buka tab **Penjualan** untuk melihat omzet, metode bayar, produk terjual, dan riwayat transaksi hari ini.
```

Ganti penjelasan reset README menjadi:

```markdown
Tombol **Reset** pada tab Pesanan membatalkan pesanan yang masih aktif, mengosongkan panggilan, dan mengembalikan nomor berikutnya ke `001`. Riwayat transaksi tetap tersimpan. Pesanan batal terlihat di tab Penjualan tetapi tidak dihitung sebagai omzet.
```

Tambahkan ke bagian `/admin` pada arsitektur:

```markdown
- merangkum omzet harian dari pesanan yang sudah dibayar;
- memisahkan pembayaran Tunai dan QRIS;
- mempertahankan transaksi selesai dan batal saat antrean direset.
```

Tambahkan checkpoint WORKLOG dengan hasil tes aktual setelah seluruh verifikasi selesai.

- [ ] **Step 2: Jalankan seluruh pemeriksaan otomatis**

Run: `npm test`

Expected: seluruh tes PASS.

Run: `npm run build`

Expected: build PASS.

Run: `git diff --check`

Expected: tidak ada error whitespace.

- [ ] **Step 3: Periksa admin pada ukuran HP**

Muat ulang `http://127.0.0.1:3000/admin`, set viewport 360 x 800, buka tab Penjualan, lalu pastikan:

* empat tab dapat ditekan;
* kartu ringkasan tersusun dua kolom;
* daftar transaksi tidak melewati lebar layar;
* omzet, Tunai, QRIS, dan transaksi cocok dengan `/api/state`;
* tidak ada error console.

- [ ] **Step 4: Periksa alur realtime**

Buat satu pesanan Tunai dan satu QRIS, batalkan salah satunya, lalu pastikan ringkasan berubah tanpa refresh. Reset antrean dan pastikan transaksi selesai tetap terlihat sementara pesanan aktif berubah menjadi Batal.

- [ ] **Step 5: Commit**

```powershell
git add README.md docs/ARCHITECTURE.md docs/WORKLOG.md
git commit -m "docs: document admin sales history"
```
