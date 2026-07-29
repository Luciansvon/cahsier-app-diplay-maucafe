# Owner Partner Summary and Fixed-Split Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menambahkan ringkasan gabungan per Mitra pada dashboard Owner serta mengubah Display menjadi split permanen 34/66 dengan iklan full-bleed dan rotasi seluruh nomor `Sedang dibuat`.

**Architecture:** Endpoint Owner tetap menjadi source of truth dan menambahkan agregat per Mitra dari ringkasan outlet aktif, termasuk saldo cup. Public Display tetap menerima data minimal berupa nomor waiting dan active call; pagination enam nomor dilakukan di browser dengan helper murni yang dapat diuji. UI Owner memakai safe DOM API dan Display mempertahankan satu video player tanpa teks promo tambahan.

**Tech Stack:** Node.js HTTP server, SQLite state store, JavaScript ES modules, HTML/CSS, Node test runner, in-app browser smoke test.

---

## File Map

- `src/server.js`: membentuk ringkasan outlet, `partnerSummaries`, `unassignedSummary`, saldo cup, dan seluruh nomor waiting publik.
- `public/owner.html`: mengganti area daftar outlet global menjadi area ringkasan per Mitra.
- `public/owner.js`: merender kartu Mitra, saldo cup, dan drill-down outlet.
- `public/owner.css`: layout responsif kartu Mitra dan daftar outlet turunannya.
- `public/queue-number.js`: helper murni pagination nomor waiting.
- `public/display.html`: memindahkan status waiting ke panel antrean dan menghapus chrome promo.
- `public/display.js`: rotasi halaman waiting serta media-only fallback.
- `public/display.css`: split permanen 34/66 dan iklan full-bleed.
- `test/server.test.js`: regression test agregasi Doni/Dedi/unassigned serta public waiting list.
- `test/queue-number.test.js`: unit test pagination enam nomor.
- `test/queue.test.js`: regression test satu checkout tetap satu nomor walaupun quantity lebih dari satu dan ready order tidak tertimpa.
- `test/ui-contract.test.js`: kontrak kartu Mitra, saldo cup, split permanen, dan penghapusan teks/dekorasi promo.
- `docs/CLIENT_REVISIONS.md`: memperbarui REV-012 dan mencatat revisi Display split permanen.
- `docs/ERROR_SOLUTIONS.md`: mencatat root cause dan bukti fix.
- `README.md`, `docs/ARCHITECTURE.md`: memperbarui kontrak dashboard Owner dan Display.

### Task 1: Owner API Mengagregasi Outlet per Mitra

**Files:**
- Modify: `test/server.test.js`
- Modify: `src/server.js`

- [ ] **Step 1: Write the failing Owner aggregation test**

Tambahkan helper test untuk membuat satu Mitra dengan sejumlah outlet:

```js
async function createPartnerWithOutlets(baseUrl, ownerCookie, {
  name, username, pin, outletCount, pendingCount = 0,
}) {
  const created = await jsonRequest(`${baseUrl}/api/owner/partners`, 'POST', {
    name, username, pin,
  }, ownerCookie);
  const login = await jsonRequest(`${baseUrl}/api/partner/login`, 'POST', { username, pin });
  const partnerCookie = cookiePair(login.response);
  const activeOutletIds = [];

  for (let index = 0; index < outletCount + pendingCount; index += 1) {
    const proposed = await jsonRequest(`${baseUrl}/api/partner/outlets`, 'POST', {
      name: `${name} Outlet ${index + 1}`,
      address: `Alamat ${name} ${index + 1}`,
    }, partnerCookie);
    if (index < outletCount) {
      await jsonRequest(
        `${baseUrl}/api/owner/outlets/${proposed.payload.outlet.id}/approve`,
        'POST',
        {},
        ownerCookie,
      );
      activeOutletIds.push(proposed.payload.outlet.id);
    }
  }

  return { partner: created.payload.partner, activeOutletIds };
}
```

Tambahkan test endpoint:

```js
test('Owner summary groups active outlets by Partner and includes combined cup balance', async (t) => {
  const { app, baseUrl, defaultOutletId } = await fixture(t);
  const ownerCookie = await loginOwner(baseUrl);
  const doni = await createPartnerWithOutlets(baseUrl, ownerCookie, {
    name: 'Doni', username: 'doni', pin: '5678', outletCount: 3, pendingCount: 1,
  });
  const dedi = await createPartnerWithOutlets(baseUrl, ownerCookie, {
    name: 'Dedi', username: 'dedi', pin: '6789', outletCount: 2,
  });

  for (const [index, outletId] of doni.activeOutletIds.entries()) {
    await app.stores.get(outletId).store.update((state) => {
      const ordered = createOrder(state, {
        items: [{ productId: 'latte', quantity: index + 1 }],
        paymentMethod: 'cash',
      }).state;
      return recordInventoryMovement(ordered, {
        type: 'received',
        quantity: 10 * (index + 1),
        actorType: 'owner',
        actorId: 'owner',
        actorName: 'Owner',
      }).state;
    });
  }
  for (const outletId of dedi.activeOutletIds) {
    await app.stores.get(outletId).store.update((state) => recordInventoryMovement(state, {
      type: 'received',
      quantity: 5,
      actorType: 'owner',
      actorId: 'owner',
      actorName: 'Owner',
    }).state);
  }

  const response = await jsonRequest(
    `${baseUrl}/api/owner/multi-summary`,
    'GET',
    undefined,
    ownerCookie,
  );
  const doniSummary = response.payload.partnerSummaries.find((item) => item.id === doni.partner.id);
  const dediSummary = response.payload.partnerSummaries.find((item) => item.id === dedi.partner.id);

  assert.equal(doniSummary.outletCount, 3);
  assert.equal(doniSummary.pendingOutletCount, 1);
  assert.equal(doniSummary.received, 120_000);
  assert.equal(doniSummary.salesCount, 3);
  assert.equal(doniSummary.inventory.balance, 60);
  assert.equal(dediSummary.outletCount, 2);
  assert.equal(dediSummary.inventory.balance, 10);
  assert.equal(response.payload.unassignedSummary.outletIds.includes(defaultOutletId), true);
});
```

Tambahkan import:

```js
import { recordInventoryMovement } from '../src/operations.js';
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
node --test --test-name-pattern="Owner summary groups active outlets by Partner" test/server.test.js
```

Expected: FAIL karena `partnerSummaries` dan `unassignedSummary` belum ada.

- [ ] **Step 3: Add per-outlet Partner and inventory fields**

Di object `summaries.push()` pada `/api/owner/multi-summary`, tambahkan:

```js
partnerId: outlet.partnerId ?? null,
inventory: inventorySummary(state, reportDate),
```

- [ ] **Step 4: Add a minimal aggregation helper inside the route**

Setelah loop outlet selesai, gunakan bentuk total yang sama dengan summary outlet:

```js
const emptyGroupedSummary = (input) => ({
  ...input,
  outletIds: [],
  outletCount: 0,
  pendingOutletCount: 0,
  revenue: 0,
  received: 0,
  cash: 0,
  qris: 0,
  cost: 0,
  margin: 0,
  operatingExpenses: 0,
  netProfit: 0,
  salesCount: 0,
  activeCount: 0,
  inventory: { balance: 0 },
});

const addOutletSummary = (group, outlet) => {
  group.outletIds.push(outlet.id);
  group.outletCount += 1;
  for (const key of [
    'revenue', 'received', 'cash', 'qris', 'cost', 'margin',
    'operatingExpenses', 'netProfit', 'salesCount', 'activeCount',
  ]) {
    group[key] += outlet[key];
  }
  group.inventory.balance += outlet.inventory.balance;
  return group;
};

const partnerSummaries = registry.partners
  .filter((partner) => partner.active !== false)
  .map((partner) => {
    const grouped = emptyGroupedSummary({ id: partner.id, name: partner.name });
    grouped.pendingOutletCount = outletsConfig.filter((outlet) => (
      outlet.partnerId === partner.id && outlet.status === 'pending'
    )).length;
    return summaries
      .filter((outlet) => outlet.partnerId === partner.id)
      .reduce(addOutletSummary, grouped);
  });

const unassignedSummary = summaries
  .filter((outlet) => !outlet.partnerId)
  .reduce(
    addOutletSummary,
    emptyGroupedSummary({ id: 'unassigned', name: 'Outlet tanpa Mitra' }),
  );
```

Tambahkan hasil ke response:

```js
partnerSummaries,
unassignedSummary: unassignedSummary.outletCount ? unassignedSummary : null,
```

- [ ] **Step 5: Run focused tests and verify GREEN**

Run:

```powershell
node --test --test-name-pattern="Owner summary groups active outlets by Partner|owner reports and API" test/server.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit Owner API**

```powershell
git add -- src/server.js test/server.test.js
git commit -m "feat: tambah ringkasan owner per mitra"
```

### Task 2: Owner UI Menampilkan Kartu Mitra dan Saldo Cup

**Files:**
- Modify: `test/ui-contract.test.js`
- Modify: `public/owner.html`
- Modify: `public/owner.js`
- Modify: `public/owner.css`

- [ ] **Step 1: Write the failing Owner UI contract**

Tambahkan assertion pada test Owner:

```js
assert.match(html, /id=["']partner-summary-grid["']/);
assert.doesNotMatch(html, /id=["']outlets-grid["']/);
assert.match(html, /Ringkasan per Mitra/);
assert.match(script, /partnerSummaries/);
assert.match(script, /Saldo Cup/);
assert.match(script, /inventory\?\.balance/);
assert.match(script, /pendingOutletCount/);
assert.match(script, /Outlet tanpa Mitra/);
assert.match(css, /\.partner-summary-card/);
assert.match(css, /\.partner-outlet-list/);
```

- [ ] **Step 2: Run the contract and verify RED**

Run:

```powershell
node --test --test-name-pattern="owner uses protected" test/ui-contract.test.js
```

Expected: FAIL karena markup dan renderer ringkasan Mitra belum ada.

- [ ] **Step 3: Replace the global outlet section heading and add the Partner grid**

Di `public/owner.html`, gunakan:

```html
<div id="outlets-grid-container">
  <div class="owner-section-title section-spaced">
    <div>
      <p class="eyebrow">KINERJA MITRA</p>
      <h2>Ringkasan per Mitra</h2>
    </div>
  </div>
  <div id="partner-summary-grid" class="partner-summary-grid"></div>
</div>
```

`outlets-grid` tidak lagi menjadi grid global tetap; buat daftar outlet di dalam kartu Mitra secara dinamis.

- [ ] **Step 4: Render Partner cards with always-visible metrics and outlet toggle**

Di `renderMultiSummary(data)`, ganti loop kartu outlet dengan:

```js
const grid = $('#partner-summary-grid');
grid.replaceChildren();

const renderPartnerGroup = (summary) => {
  const card = element('article', 'card partner-summary-card');
  const heading = element('div', 'partner-summary-heading');
  const title = element('div', 'partner-summary-title');
  title.append(
    element('h3', '', summary.name),
    element(
      'small',
      '',
      `${summary.outletCount} outlet aktif · ${summary.pendingOutletCount || 0} pending`,
    ),
  );
  heading.append(title);

  const metrics = element('div', 'outlet-card-metrics');
  for (const [label, value, className = ''] of [
    ['Total Diterima', rupiah(summary.received), 'text-success'],
    ['Profit Bersih', rupiah(summary.netProfit), 'text-profit'],
    ['Transaksi', String(summary.salesCount)],
    ['Antrean Aktif', String(summary.activeCount)],
      ['Saldo Cup', String(summary.inventory?.balance ?? 0)],
  ]) {
    const metric = element('div', 'outlet-card-metric');
    metric.append(element('span', '', label), element('strong', className, value));
    metrics.append(metric);
  }

  const outletList = element('div', 'partner-outlet-list');
  outletList.hidden = true;
  data.summaries
    .filter((outlet) => (
      summary.id === 'unassigned'
        ? !outlet.partnerId
        : outlet.partnerId === summary.id
    ))
    .forEach((outlet) => {
      const row = element('article', 'partner-outlet-row');
      const info = element('div');
      info.append(
        element('strong', '', outlet.name),
        element('small', '', outlet.address),
      );
      const detail = element('button', 'primary small-btn', 'Lihat Outlet');
      detail.type = 'button';
      detail.addEventListener('click', () => selectOutlet(outlet.id));
      row.append(info, detail);
      outletList.append(row);
    });

  const toggle = element('button', 'ghost small-btn', 'Lihat Outlet');
  toggle.type = 'button';
  toggle.setAttribute('aria-expanded', 'false');
  toggle.addEventListener('click', () => {
    outletList.hidden = !outletList.hidden;
    toggle.setAttribute('aria-expanded', String(!outletList.hidden));
    toggle.textContent = outletList.hidden ? 'Lihat Outlet' : 'Tutup Outlet';
  });
  heading.append(title, toggle);
  card.append(heading, metrics, outletList);
  grid.append(card);
};

data.partnerSummaries.forEach(renderPartnerGroup);
if (data.unassignedSummary) renderPartnerGroup(data.unassignedSummary);
```

Pertahankan `outletsList = data.summaries` agar dropdown dan laporan outlet tetap bekerja.

- [ ] **Step 5: Add responsive Partner card CSS**

Tambahkan:

```css
.partner-summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr)); gap: 13px; }
.partner-summary-card { min-width: 0; }
.partner-summary-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
.partner-summary-title { min-width: 0; }
.partner-summary-heading h3 { margin: 0 0 4px; font: 900 20px/1.2 Georgia, serif; }
.partner-summary-heading small { color: var(--muted); }
.partner-outlet-list { display: grid; gap: 8px; border-top: 1px solid var(--line); padding-top: 12px; }
.partner-outlet-row { min-width: 0; display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.partner-outlet-row div { min-width: 0; display: grid; gap: 3px; }
.partner-outlet-row small { color: var(--muted); overflow-wrap: anywhere; }
```

Pada viewport mobile, buat `.partner-outlet-row` menumpuk dan tombol selebar kartu.

- [ ] **Step 6: Run the UI contract and verify GREEN**

Run:

```powershell
node --test --test-name-pattern="owner uses protected" test/ui-contract.test.js
```

Expected: PASS.

- [ ] **Step 7: Commit Owner UI**

```powershell
git add -- public/owner.html public/owner.js public/owner.css test/ui-contract.test.js
git commit -m "feat: tampilkan performa mitra di dashboard owner"
```

### Task 3: Multi-Order Contract dan Pagination Waiting

**Files:**
- Modify: `test/queue.test.js`
- Modify: `test/queue-number.test.js`
- Modify: `test/server.test.js`
- Modify: `src/server.js`
- Modify: `public/queue-number.js`

- [ ] **Step 1: Write failing queue behavior tests**

Tambahkan pada `test/queue.test.js`:

```js
test('one checkout keeps one queue number regardless of item quantity and later calls do not delete ready orders', () => {
  const first = createOrder(stateWithMenu(), {
    items: [{ productId: 'latte', quantity: 1 }],
    paymentMethod: 'cash',
  });
  const second = createOrder(first.state, {
    items: [{ productId: 'latte', quantity: 3 }],
    paymentMethod: 'cash',
  });
  const firstCalled = callOrder(second.state, first.order.id);
  const secondCalled = callOrder(firstCalled.state, second.order.id);

  assert.equal(first.order.queueNumber, '1');
  assert.equal(second.order.queueNumber, '2');
  assert.equal(second.order.items[0].quantity, 3);
  assert.equal(secondCalled.state.activeCall.queueNumber, '2');
  assert.equal(secondCalled.state.orders.find((order) => order.id === first.order.id).status, 'ready');
  assert.equal(secondCalled.state.orders.length, 2);
});
```

Tambahkan pada `test/queue-number.test.js`:

```js
import { normalizeQueueNumber, queueNumberPage, queueNumberText } from '../public/queue-number.js';

test('paginates every waiting queue number six at a time', () => {
  const values = ['001', '2', '3', '4', '5', '6', '7', '8'];
  assert.deepEqual(queueNumberPage(values, 0), {
    numbers: ['1', '2', '3', '4', '5', '6'],
    pageIndex: 0,
    pageCount: 2,
  });
  assert.deepEqual(queueNumberPage(values, 1), {
    numbers: ['7', '8'],
    pageIndex: 1,
    pageCount: 2,
  });
  assert.equal(queueNumberPage(values, 2).pageIndex, 0);
});
```

- [ ] **Step 2: Run queue tests and verify RED**

Run:

```powershell
node --test test/queue.test.js test/queue-number.test.js
```

Expected: queue behavior test PASS pada kontrak yang sudah benar, pagination test FAIL karena `queueNumberPage` belum diekspor. Test yang sudah pass menjadi bukti current behavior, bukan alasan mengubah queue state.

- [ ] **Step 3: Implement the pure pagination helper**

Tambahkan ke `public/queue-number.js`:

```js
export function queueNumberPage(values, requestedPage = 0, pageSize = 6) {
  const numbers = (Array.isArray(values) ? values : []).map(normalizeQueueNumber);
  const safePageSize = Number.isSafeInteger(pageSize) && pageSize > 0 ? pageSize : 6;
  const pageCount = Math.max(1, Math.ceil(numbers.length / safePageSize));
  const rawPage = Number.isSafeInteger(requestedPage) ? requestedPage : 0;
  const pageIndex = ((rawPage % pageCount) + pageCount) % pageCount;
  return {
    numbers: numbers.slice(pageIndex * safePageSize, (pageIndex + 1) * safePageSize),
    pageIndex,
    pageCount,
  };
}
```

- [ ] **Step 4: Write the failing public-state test for more than six orders**

Perluas test public preparing state di `test/server.test.js` dengan membuat delapan order dan assert:

```js
assert.deepEqual(publicPreparing.payload.preparingQueueNumbers, [
  '1', '2', '3', '4', '5', '6', '7', '8',
]);
```

Run:

```powershell
node --test --test-name-pattern="protects cashier mutations" test/server.test.js
```

Expected: FAIL karena server masih memakai `.slice(0, 6)`.

- [ ] **Step 5: Return all safe waiting numbers**

Di `displayState()` hapus:

```js
.slice(0, 6)
```

Tetap pertahankan filter `status === 'waiting'`, sort oldest-first, dan mapping hanya ke `String(order.queueNumber)`.

- [ ] **Step 6: Run focused tests and verify GREEN**

Run:

```powershell
node --test test/queue.test.js test/queue-number.test.js
node --test --test-name-pattern="protects cashier mutations" test/server.test.js
```

Expected: PASS.

- [ ] **Step 7: Commit queue behavior**

```powershell
git add -- src/server.js public/queue-number.js test/server.test.js test/queue.test.js test/queue-number.test.js
git commit -m "feat: rotasi seluruh nomor pesanan yang dibuat"
```

### Task 4: Display Split Permanen dan Iklan Full-Bleed

**Files:**
- Modify: `test/ui-contract.test.js`
- Modify: `public/display.html`
- Modify: `public/display.js`
- Modify: `public/display.css`

- [ ] **Step 1: Replace the old adaptive Display contract with a failing fixed-split contract**

Perbarui assertion Display:

```js
for (const id of [
  'display-connection', 'active-number', 'enable-voice',
  'preparing-status', 'preparing-page',
]) {
  assert.match(html, new RegExp(`id=["']${id}["']`));
}
assert.doesNotMatch(html, /promo-topline|promo-tagline|promo-counter|promo-content|promo-decoration/);
assert.doesNotMatch(html, /PROMO OUTLET|MENU PILIHAN|HARI INI/);
assert.match(script, /queueNumberPage/);
assert.match(script, /PREPARING_ROTATION_MS\s*=\s*4_000/);
assert.match(script, /preparingPageIndex/);
assert.match(css, /\.queue-panel\s*\{[\s\S]*display:\s*flex/);
assert.match(css, /\.queue-panel\s*\{[\s\S]*flex:\s*0 0 34%/);
assert.match(css, /\.promo-panel\s*\{[\s\S]*flex:\s*0 0 66%/);
assert.match(css, /\.promo-panel\s*\{[\s\S]*padding:\s*0/);
assert.match(css, /\.promo-video,\s*\.promo-image\s*\{[\s\S]*border-radius:\s*0/);
assert.doesNotMatch(css, /has-active-call|promo-topline|promo-decoration/);
```

- [ ] **Step 2: Run the Display contract and verify RED**

Run:

```powershell
node --test --test-name-pattern="display keeps" test/ui-contract.test.js
```

Expected: FAIL pada adaptive layout dan chrome promo lama.

- [ ] **Step 3: Simplify Display markup**

Gunakan struktur:

```html
<section class="queue-panel">
  <div class="display-brand">
    <span class="brand-mark">M</span>
    <span id="display-outlet-name">MAUCAFE</span>
  </div>
  <div class="queue-center">
    <p class="queue-label">PESANAN SIAP</p>
    <strong id="active-number" class="active-number">---</strong>
    <p id="pickup-message" class="pickup-message">Belum ada pesanan siap</p>
  </div>
  <div class="preparing-block">
    <p class="preparing-label">SEDANG DIBUAT</p>
    <p id="preparing-status" class="preparing-status">Belum ada pesanan yang sedang dibuat</p>
    <span id="preparing-page" class="preparing-page" hidden></span>
  </div>
  <div class="display-controls">
    <span id="display-connection" class="connection offline" role="status">Menghubungkan...</span>
    <button id="enable-voice" class="voice-button">Klik layar TV untuk aktifkan suara</button>
  </div>
</section>
<section class="promo-panel">
  <div class="promo-wrapper">
    <video id="promo-video" class="promo-video" autoplay muted playsinline hidden>
      <source id="promo-video-source" src="/media/promo.mp4" type="video/mp4">
    </video>
    <img id="promo-image" class="promo-image" alt="Promosi MAUCAFE" hidden>
  </div>
</section>
```

- [ ] **Step 4: Remove generated promo text and add waiting rotation**

Impor helper:

```js
import { normalizeQueueNumber, queueNumberPage, queueNumberText } from './queue-number.js';
```

Hapus `promo`, `promoCounter`, `promoTagline`, `promoIndex`, `rupiah`, dan `renderDefaultPromo()`.

Tambahkan state:

```js
const PREPARING_ROTATION_MS = 4_000;
let preparingPageIndex = 0;
let preparingSignature = '';
```

Tambahkan renderer:

```js
function renderPreparing(numbers, { reset = false } = {}) {
  const safeNumbers = Array.isArray(numbers) ? numbers : [];
  const signature = safeNumbers.join('|');
  if (reset || signature !== preparingSignature) {
    preparingSignature = signature;
    preparingPageIndex = 0;
  }
  const page = queueNumberPage(safeNumbers, preparingPageIndex);
  preparingPageIndex = page.pageIndex;
  preparingStatus.textContent = page.numbers.length
    ? page.numbers.join(', ')
    : 'Belum ada pesanan yang sedang dibuat';
  preparingPage.hidden = page.pageCount <= 1;
  preparingPage.textContent = `${page.pageIndex + 1} / ${page.pageCount}`;
}
```

Pada `renderQueue()`:

```js
if (message) {
  message.textContent = activeCall
    ? 'Silakan ambil pesanan di counter'
    : allowActiveNumber
      ? 'Belum ada pesanan siap'
      : 'Nomor antrean sedang diperbarui';
}
renderPreparing(preparing);
```

Tambahkan interval sekali:

```js
window.setInterval(() => {
  if (!lastFreshAt || Date.now() - lastFreshAt > STALE_AFTER_MS) return;
  const numbers = state?.preparingQueueNumbers ?? [];
  const page = queueNumberPage(numbers, preparingPageIndex);
  if (page.pageCount <= 1) return;
  preparingPageIndex = (page.pageIndex + 1) % page.pageCount;
  renderPreparing(numbers);
}, PREPARING_ROTATION_MS);
```

Hapus `displayShell` dan semua toggle class `has-active-call` karena layout tidak lagi adaptif. Hapus juga semua assignment `promo.textContent`, `promoTagline.textContent`, serta `promoCounter.textContent` dari `renderMedia()`.

Saat playlist kosong, gunakan cabang eksplisit berikut agar video/image berhenti tanpa membuat teks promo pengganti:

```js
if (!playlist.length) {
  clearImageTimer();
  currentMediaId = '';
  currentMediaUrl = '';
  if (promoVideo) {
    promoVideo.pause();
    promoVideo.hidden = true;
  }
  if (promoImage) promoImage.hidden = true;
  return;
}
```

- [ ] **Step 5: Make CSS permanently split and full-bleed**

Ubah aturan utama:

```css
.queue-panel {
  display: flex;
  flex: 0 0 34%;
}
.promo-panel {
  position: relative;
  flex: 0 0 66%;
  min-width: 0;
  overflow: hidden;
  padding: 0;
  background: #140d0b;
}
.promo-wrapper {
  width: 100%;
  height: 100%;
  min-height: 0;
  margin: 0;
}
.promo-video,
.promo-image {
  width: 100%;
  height: 100%;
  max-height: none;
  border-radius: 0;
  object-fit: cover;
  background: #000;
}
.preparing-block { display: grid; gap: 8px; }
.preparing-label { margin: 0; font-size: clamp(12px, 1.2vw, 18px); font-weight: 900; letter-spacing: .14em; }
.preparing-status { margin: 0; color: #fff; font-size: clamp(22px, 2.8vw, 48px); font-weight: 900; line-height: 1.1; }
.preparing-page { color: rgb(255 255 255 / 72%); font-size: 12px; font-weight: 800; }
```

Hapus selector `has-active-call`, `promo-topline`, `promo-content`, `promo-kicker`, dan `promo-decoration`.

- [ ] **Step 6: Run the Display contract and verify GREEN**

Run:

```powershell
node --test --test-name-pattern="display keeps" test/ui-contract.test.js
```

Expected: PASS.

- [ ] **Step 7: Commit Display UI**

```powershell
git add -- public/display.html public/display.js public/display.css test/ui-contract.test.js
git commit -m "feat: jadikan display split permanen"
```

### Task 5: Documentation, Full Verification, Browser QA, and Push

**Files:**
- Modify: `docs/CLIENT_REVISIONS.md`
- Modify: `docs/ERROR_SOLUTIONS.md`
- Modify: `README.md`
- Modify: `docs/ARCHITECTURE.md`

- [ ] **Step 1: Update client revision tracking**

Perbarui REV-012 agar bukti mencakup dashboard Mitra dan Owner. Tambahkan REV-017:

```markdown
| REV-017 | 27 Juli 2026 | Display selalu split 34% antrean dan 66% iklan full-bleed, dengan rotasi seluruh nomor Sedang dibuat. | `DONE` | Automated test dan smoke browser membuktikan panel antrean selalu terlihat, media tidak memiliki chrome tambahan, dan nomor waiting berpindah halaman. Rincian ada di `ERR-037` dan `ERR-038`. |
```

- [ ] **Step 2: Add mandatory bug documentation**

Tambahkan dua bagian ke `docs/ERROR_SOLUTIONS.md`:

```markdown
## ERR-037 - Dashboard Owner belum memiliki ringkasan gabungan per Mitra

Kondisi:
Owner hanya melihat total jaringan dan kartu per outlet sehingga performa Doni tiga outlet tidak dapat dibandingkan langsung dengan Dedi dua outlet.

Penyebab:
`/api/owner/multi-summary` hanya membentuk `summaries` per outlet dan `grandTotals`; agregasi berdasarkan `partnerId` baru tersedia pada endpoint Mitra.

Solusi:
Server menambahkan `partnerSummaries` serta `unassignedSummary`, termasuk finansial, antrean, dan saldo cup. Owner merender satu kartu per Mitra dengan drill-down outlet.

Verifikasi:
- Regression test membuktikan Doni tiga outlet dan Dedi dua outlet diagregasi terpisah; outlet pending tidak masuk finansial; outlet aktif tanpa Mitra tetap ada; saldo cup ikut dijumlahkan.
- `npm test` lulus 93/93 dan `npm run build` lulus.

## ERR-038 - Display fullscreen menyembunyikan status antrean dan chrome promo mengecilkan iklan

Kondisi:
Tanpa active call, panel antrean disembunyikan dan promo menjadi fullscreen. Teks promo, counter, padding, serta dekorasi memakai ruang yang seharusnya dipakai media.

Penyebab:
CSS memakai selector `has-active-call` untuk mengubah layout dan markup promo memiliki beberapa lapisan non-media.

Solusi:
Display menjadi split permanen 34/66. Status waiting dipindahkan ke panel antrean dan berotasi enam nomor per empat detik. Panel kanan hanya memuat video/foto full-bleed.

Verifikasi:
- UI contract membuktikan split tetap, chrome promo dihapus, dan helper rotasi digunakan.
- Browser smoke membuktikan rasio panel 34/66, media full-bleed, nomor 1-6 berganti ke 7-8, serta video tetap berjalan saat suara antrean dipanggil.
- `npm test` lulus 93/93 dan `npm run build` lulus.
```

- [ ] **Step 3: Update README and architecture**

Dokumentasikan:

- Owner memiliki ringkasan per Mitra termasuk saldo cup;
- satu checkout tetap satu nomor;
- Display selalu split 34/66;
- waiting numbers berotasi enam per halaman;
- media promo full-bleed tanpa label/counter.

- [ ] **Step 4: Run the full automated suite**

Run:

```powershell
npm test
```

Expected: seluruh test PASS, `fail 0`.

- [ ] **Step 5: Run the production web build**

Run:

```powershell
npm run build
```

Expected: exit code `0` dan `Build web selesai`.

- [ ] **Step 6: Run browser smoke test**

Gunakan fixture data terpisah, bukan database user. Verifikasi pada Display:

1. `queue-panel` selalu terlihat sebelum active call.
2. Lebar panel antrean sekitar 34% dan iklan sekitar 66%.
3. Tidak ada `PROMO OUTLET`, counter, harga, atau dekorasi.
4. Video/foto menyentuh keempat sisi panel kanan.
5. Delapan waiting order menampilkan halaman `1–6`, lalu `7–8` setelah empat detik.
6. Memanggil nomor 1 lalu 2 membuat active number menjadi 2 tanpa menghapus order 1 dari state ready.
7. Video tetap `paused: false` saat active call.

Verifikasi pada Owner:

1. Doni tampil sebagai satu kartu tiga outlet.
2. Dedi tampil sebagai satu kartu dua outlet.
3. Total Diterima, Profit Bersih, Transaksi, Antrean Aktif, dan Saldo Cup sesuai API.
4. Membuka kartu menampilkan outlet milik Mitra saja.
5. Viewport mobile tidak memiliki horizontal overflow.

- [ ] **Step 7: Verify mandatory bug documentation diff**

Run:

```powershell
git diff -- docs/ERROR_SOLUTIONS.md
git diff --check
```

Expected: ERR-037/ERR-038 berisi kondisi, penyebab, solusi, dan bukti aktual; tidak ada whitespace error.

- [ ] **Step 8: Commit all remaining approved revisions**

Karena working tree sudah berisi revisi klien sebelumnya yang telah lulus verifikasi tetapi belum dikomit, audit `git diff` lalu stage hanya file repo yang memang terkait:

```powershell
git status --short
git diff --stat
git add -- AGENTS.md CHANGELOG_FIXES.md README.md data/state.example.json docs public src test
git diff --cached --check
git commit -m "feat: selesaikan revisi dashboard dan display klien"
```

- [ ] **Step 9: Push the current branch**

Pastikan branch adalah `codex/maucafe-franchise-v1`, lalu:

```powershell
git push -u origin codex/maucafe-franchise-v1
```

Expected: push sukses dan remote branch menunjuk commit terbaru.
