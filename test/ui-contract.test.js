import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (file) => readFile(new URL(`../public/${file}`, import.meta.url), 'utf8');

test('Android-ready shell uses relative local assets and one authenticated API client', async () => {
  const [indexHtml, adminHtml, ownerHtml, adminScript, ownerScript, launcherScript] = await Promise.all([
    read('index.html'),
    read('admin.html'),
    read('owner.html'),
    read('admin.js'),
    read('owner.js'),
    read('launcher.js'),
  ]);

  assert.match(indexHtml, /src=["']\.\/runtime-config\.js["']/);
  assert.match(indexHtml, /src=["']\.\/launcher\.js["']/);
  assert.match(launcherScript, /\/api\/outlets/);
  assert.match(launcherScript, /admin\.html\?outlet=/);
  assert.match(indexHtml, /href=["']\.\/partner\.html["']/);
  for (const html of [adminHtml, ownerHtml]) {
    assert.doesNotMatch(html, /(src|href)=["']\//);
    assert.match(html, /src=["']\.\/runtime-config\.js["']/);
  }
  for (const script of [adminScript, ownerScript]) {
    assert.match(script, /from ['"]\.\/api-client\.js['"]/);
    assert.match(script, /from ['"]\.\/app-config\.js['"]/);
    assert.doesNotMatch(script, /\bfetch\s*\(/);
  }
  assert.match(ownerScript, /from ['"]\.\/sales\.js['"]/);
  assert.match(adminScript, /isNativeApp/);
  assert.match(ownerScript, /isNativeApp/);
});

test('admin exposes an efficient cashier layout, protected live channel, filtering, and owner-approved cancellation UI', async () => {
  const [html, script, css] = await Promise.all([read('admin.html'), read('admin.js'), read('admin.css')]);
  for (const id of [
    'connection-status', 'cashier-panel', 'orders-panel', 'product-grid', 'cart-total', 'checkout',
    'product-search', 'category-filters', 'mobile-cart-bar', 'cancel-dialog', 'cancel-reason', 'cancel-owner-pin',
  ]) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
  assert.match(html, /id=["']admin-username-input["'][^>]*name=["']username["'][^>]*autocomplete=["']username["']/);
  assert.match(html, /id=["']admin-pin-input["'][^>]*name=["']current-password["'][^>]*autocomplete=["']current-password["']/);
  for (const removedId of ['sales-panel', 'menu-panel', 'reset-queue', 'purge-sales']) {
    assert.doesNotMatch(html, new RegExp(`id=["']${removedId}["']`));
  }
  assert.doesNotMatch(script, /summarizeSales/);
  assert.match(script, /\/admin\/state/);
  assert.match(script, /\/admin\/events/);
  assert.match(script, /EventSource/);
  assert.match(script, /ownerPin/);
  assert.match(css, /\.tab-bar\s*\{\s*grid-template-columns:\s*repeat\(4/);
  assert.match(css, /\.cashier-layout\s*\{[\s\S]*grid-template-columns/);
  assert.match(css, /\.cart-card\s*\{[\s\S]*position:\s*sticky/);
  assert.match(css, /@media\s*\(max-width:\s*700px\)[\s\S]*\.mobile-cart-bar/);
  assert.match(html, /<button id="checkout" type="button"/);
  assert.match(html, /<button type="button" class="tab active"/);
  assert.match(html, /<button type="button" class="payment active"/);
  assert.match(script, /crypto\.randomUUID\?\.\(\)\s*\?\?/);
  assert.match(script, /showError\(error\.message\s*\|\|\s*'Pembayaran gagal/);
  assert.doesNotMatch(`${html}\n${script}`, /cart-tax|taxConfig|Pajak|PBJT|PPN/i);
  for (const id of [
    'admin-username-input', 'operations-panel', 'cashier-daily-summary', 'open-shift-form',
    'close-shift-form', 'operation-entry-form', 'inventory-entry-form', 'admin-media-playlist',
  ]) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
  assert.match(script, /\/shifts\/open/);
  assert.match(script, /\/operations/);
  assert.match(script, /\/inventory/);
  assert.match(html, /class=["'][^"']*shift-card/);
  assert.match(html, /class=["'][^"']*shift-status/);
  assert.match(script, /Saldo awal:/);
  assert.match(css, /\.shift-status[\s\S]*overflow-wrap:\s*anywhere/);
});

test('display keeps the 34 percent queue panel, voice opt-in, media fit, and stale/offline protection', async () => {
  const [html, script, css] = await Promise.all([read('display.html'), read('display.js'), read('display.css')]);
  for (const id of [
    'display-connection', 'active-number', 'enable-voice', 'preparing-status',
    'preparing-page', 'promo-video', 'promo-image',
  ]) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
  assert.doesNotMatch(html, /promo-topline|promo-tagline|promo-counter|promo-content|promo-decoration/);
  assert.doesNotMatch(html, /PROMO OUTLET|MENU PILIHAN|HARI INI/);
  assert.match(script, /EventSource/);
  assert.match(script, /async function syncState/);
  assert.match(script, /setInterval\(syncState,\s*5000\)/);
  assert.match(script, /STALE_AFTER_MS\s*=\s*30_000/);
  assert.match(script, /Nomor antrean sedang diperbarui/);
  assert.match(script, /preparingQueueNumbers/);
  assert.match(script, /queueNumberPage/);
  assert.match(script, /PREPARING_ROTATION_MS\s*=\s*4_000/);
  assert.match(script, /preparingPageIndex/);
  assert.match(script, /speechSynthesis/);
  assert.match(script, /import\s*\{\s*normalizeQueueNumber,\s*queueNumberPage,\s*queueNumberText\s*\}\s*from\s*['"]\.\/queue-number\.js['"]/);
  assert.match(script, /SpeechSynthesisUtterance\(`Pesanan nomor \$\{queueNumberText\(activeCall\.queueNumber\)\}/);
  assert.match(script, /localStorage/);
  assert.match(script, /objectFit/);
  assert.doesNotMatch(`${html}\n${script}`, /🔊/u);
  assert.match(css, /\.queue-panel[\s\S]*flex:\s*0 0 34%/);
  const queuePanelBlock = css.match(/\.queue-panel\s*\{([^}]*)\}/)?.[1] || '';
  assert.match(queuePanelBlock, /display:\s*flex/);
  assert.doesNotMatch(queuePanelBlock, /display:\s*none/);
  assert.match(css, /\.promo-panel\s*\{[\s\S]*flex:\s*0 0 66%/);
  assert.match(css, /\.promo-panel\s*\{[\s\S]*padding:\s*0/);
  assert.match(css, /\.promo-video,\s*\.promo-image\s*\{[\s\S]*border-radius:\s*0/);
  assert.doesNotMatch(css, /has-active-call|promo-topline|promo-decoration/);
  assert.match(css, /aspect-ratio:\s*16\s*\/\s*9/);
  assert.match(css, /\.active-number[\s\S]*font-size:\s*clamp\(88px,\s*min\(15vw,\s*27vh\),\s*260px\)/);
  assert.match(script, /mediaPlaylist/);
  assert.match(script, /advancePlaylist/);
  assert.match(script, /renderMedia\(item,\s*playlistIndex,\s*playlist\.length,\s*\{\s*forcePlayback\s*\}\)/);
  assert.match(script, /forcePlayback[\s\S]*promoVideo\.currentTime\s*=\s*0[\s\S]*promoVideo\.play\(\)/);
  const announceBlock = script.match(/function announce\(activeCall\)\s*\{[\s\S]*?\n\}\n\nfunction renderMedia/)?.[0] || '';
  assert.doesNotMatch(announceBlock, /promoVideo\.pause/);
  assert.doesNotMatch(announceBlock, /promoVideo\.play/);
  assert.match(announceBlock, /promoVideo\.muted\s*=\s*true/);
  assert.match(announceBlock, /restorePromoAudio/);
  assert.match(announceBlock, /window\.setTimeout\(\(\)\s*=>\s*restorePromoAudio\(generation\),\s*15_000\)/);
  assert.doesNotMatch(announceBlock, /throw error/);
});

test('owner uses protected owner channels, clear financial labels, responsive tabs, and separated danger settings', async () => {
  const [html, script, css, baseCss] = await Promise.all([read('owner.html'), read('owner.js'), read('owner.css'), read('base.css')]);
  for (const id of [
    'owner-login', 'owner-dashboard', 'tab-summary', 'tab-reports', 'tab-settings', 'tab-danger',
    'owner-revenue', 'owner-received', 'owner-cash', 'owner-qris', 'owner-sales-count', 'owner-active-count',
    'owner-updated-at', 'danger-confirmation', 'owner-media-fit', 'admin-pin-config-form', 'new-admin-pin', 'confirm-admin-pin',
    'tab-franchise', 'owner-partner-form', 'owner-franchise-outlet-list', 'owner-audit-list',
    'owner-operating-expenses', 'owner-net-profit', 'grand-net-profit',
  ]) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
  assert.match(html, /id=["']pin-input["'][^>]*name=["']current-password["'][^>]*autocomplete=["']current-password["']/);
  assert.match(html, /id=["']current-pin-input["'][^>]*name=["']current-password["'][^>]*autocomplete=["']current-password["']/);
  assert.match(html, /id=["']new-pin-input["'][^>]*name=["']new-password["'][^>]*autocomplete=["']new-password["']/);
  assert.match(html, /Penjualan Bersih/i);
  assert.match(html, /Total Diterima/i);
  assert.match(html, /id=["']partner-summary-grid["']/);
  assert.doesNotMatch(html, /id=["']outlets-grid["']/);
  assert.match(html, /Ringkasan per Mitra/i);
  assert.match(html, /Zona Bahaya/i);
  assert.match(html, /<dialog[^>]+id=["']change-pin-modal["']/);
  assert.match(html, /<dialog[^>]+id=["']menu-mgmt-modal["']/);
  assert.doesNotMatch(html, /\sstyle=/);
  assert.match(script, /\/api\/owner\/login/);
  assert.match(script, /\/api\/owner\/multi-summary/);
  assert.match(script, /partnerSummaries/);
  assert.match(script, /Saldo Cup/);
  assert.match(script, /inventory\?\.balance/);
  assert.match(script, /pendingOutletCount/);
  assert.match(script, /Outlet tanpa Mitra/);
  assert.match(script, /expandedPartnerIds/);
  assert.match(script, /\/owner\/events/);
  assert.match(script, /\/admin\/pin/);
  assert.match(script, /\/api\/owner\/logout/);
  assert.doesNotMatch(script, /\/api\/owner\/outlets\/\$\{outlet\.id\}\/assign/);
  assert.match(script, /async function handleExportExcel/);
  assert.match(script, /showError\(error\.message\)/);
  assert.doesNotMatch(script, /sessionStorage/);
  assert.doesNotMatch(script, /innerHTML/);
  assert.doesNotMatch(`${html}\n${script}`, /tax-config|Pajak|PBJT|PPN/i);
  assert.match(baseCss, /\[hidden\]\s*\{\s*display:\s*none\s*!important/);
  assert.match(baseCss, /body:has\(dialog\[open\]\)\s*\{\s*overflow:\s*hidden/);
  assert.match(css, /@media\s*\(max-width:\s*700px\)[\s\S]*\.owner-tab-bar/);
  assert.match(css, /@media\s*\(max-width:\s*480px\)[\s\S]*\.outlet-selector-wrapper\s*\{[^}]*flex:\s*none/);
  assert.match(css, /\.partner-summary-card/);
  assert.match(css, /\.partner-outlet-list/);
});

test('Partner page covers scoped outlets, employees, shifts, cup, expenses, reports, and media', async () => {
  const [html, script, css] = await Promise.all([read('partner.html'), read('partner.js'), read('partner.css')]);
  for (const id of [
    'partner-login', 'partner-dashboard', 'partner-outlet-select', 'partner-metrics',
    'partner-force-close-form', 'partner-operation-form', 'partner-inventory-form',
    'partner-employee-form', 'partner-media-form', 'partner-outlet-form', 'partner-export',
  ]) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
  assert.match(html, /id=["']partner-username["'][^>]*name=["']username["'][^>]*autocomplete=["']username["']/);
  assert.match(html, /id=["']partner-pin["'][^>]*name=["']current-password["'][^>]*autocomplete=["']current-password["']/);
  assert.match(html, /id=["']employee-username["'][^>]*name=["']username["'][^>]*autocomplete=["']username["']/);
  assert.match(script, /\/api\/partner\/dashboard/);
  assert.match(script, /\/api\/partner\/employees/);
  assert.match(script, /\/api\/partner\/outlets/);
  assert.match(html, /Ringkasan Gabungan/i);
  assert.match(script, /dashboard\.summary/);
  assert.match(html, /Tutup Paksa Shift/);
  assert.match(html, /class=["'][^"']*shift-card/);
  assert.match(html, /class=["'][^"']*shift-status/);
  assert.match(script, /Kasir:/);
  assert.match(css, /\.shift-status[\s\S]*overflow-wrap:\s*anywhere/);
  assert.match(script, /\/operations/);
  assert.match(script, /\/inventory/);
  assert.match(script, /\/media\/upload/);
  assert.doesNotMatch(script, /\.innerHTML\s*=/);
  assert.match(css, /\.partner-metrics/);
});

test('each page loads shared foundations plus one role stylesheet', async () => {
  const pages = [
    ['index.html', 'launcher.css'],
    ['admin.html', 'admin.css'],
    ['owner.html', 'owner.css'],
    ['partner.html', 'partner.css'],
    ['display.html', 'display.css'],
  ];
  for (const [page, roleStylesheet] of pages) {
    const html = await read(page);
    assert.match(html, /href=["']\.\/base\.css(\?v=\d+)?["']/);
    assert.match(html, new RegExp(`href=["']\\./${roleStylesheet.replace('.', '\\.')}(\\?v=\\d+)?["']`));
    assert.doesNotMatch(html, /styles\.css/);
  }
});

test('public scripts do not inject dynamic HTML through innerHTML', async () => {
  const scripts = await Promise.all(['admin.js', 'display.js', 'owner.js', 'partner.js'].map(read));
  for (const script of scripts) assert.doesNotMatch(script, /\.innerHTML\s*=/);
});

test('every credential input declares password-manager metadata', async () => {
  const pages = await Promise.all(['admin.html', 'owner.html', 'partner.html'].map(read));
  for (const html of pages) {
    const passwordInputs = [...html.matchAll(/<input\b[^>]*type=["']password["'][^>]*>/g)].map((match) => match[0]);
    assert.ok(passwordInputs.length > 0);
    for (const input of passwordInputs) {
      assert.match(input, /\sname=["'][^"']+["']/);
      assert.match(input, /\sautocomplete=["'](?:current-password|new-password)["']/);
    }
  }
});

test('typography and spacing safeguards keep text readable on narrow layouts', async () => {
  const [baseCss, adminCss, ownerCss, partnerCss, displayCss, launcherCss] = await Promise.all([
    read('base.css'),
    read('admin.css'),
    read('owner.css'),
    read('partner.css'),
    read('display.css'),
    read('launcher.css'),
  ]);

  assert.match(baseCss, /typography-spacing-fix: shared foundations/);
  assert.match(baseCss, /--page-gutter:\s*clamp\(16px,\s*2vw,\s*24px\)/);
  assert.match(baseCss, /\.primary,[\s\S]*white-space:\s*normal/);

  assert.match(adminCss, /typography-spacing-fix: admin/);
  assert.match(adminCss, /@media\s*\(max-width:\s*430px\)[\s\S]*\.tab-bar\s*\{[\s\S]*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(adminCss, /\.product-card strong[\s\S]*overflow-wrap:\s*anywhere/);

  assert.match(ownerCss, /typography-spacing-fix: owner/);
  assert.match(ownerCss, /@media\s*\(max-width:\s*700px\)[\s\S]*\.owner-tab-bar\s*\{[\s\S]*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(ownerCss, /@media\s*\(max-width:\s*430px\)[\s\S]*\.owner-tab-bar\s*\{[\s\S]*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);

  assert.match(partnerCss, /typography-spacing-fix: partner/);
  assert.match(partnerCss, /@media\s*\(max-width:\s*600px\)[\s\S]*#partner-media-form,[\s\S]*grid-template-columns:\s*1fr/);
  assert.match(partnerCss, /\.partner-tab[\s\S]*white-space:\s*normal/);

  assert.match(displayCss, /typography-spacing-fix: display/);
  assert.match(displayCss, /\.queue-panel\s*\{[\s\S]*padding:\s*clamp\(28px,\s*3\.8vw,\s*64px\)/);
  assert.match(displayCss, /\.pickup-message[\s\S]*line-height:\s*1\.4/);

  assert.match(launcherCss, /typography-spacing-fix: launcher/);
  assert.match(launcherCss, /\.launcher-card h1[\s\S]*overflow-wrap:\s*anywhere/);
});
