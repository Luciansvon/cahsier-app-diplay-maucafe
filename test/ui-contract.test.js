import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (file) => readFile(new URL(`../public/${file}`, import.meta.url), 'utf8');

test('admin exposes cashier, orders, and live connection feedback while leaving owner controls to owner page', async () => {
  const [html, script, css] = await Promise.all([read('admin.html'), read('admin.js'), read('styles.css')]);
  for (const id of ['connection-status', 'cashier-panel', 'orders-panel', 'product-grid', 'cart-total', 'checkout']) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
  for (const removedId of ['sales-panel', 'menu-panel', 'reset-queue', 'purge-sales']) {
    assert.doesNotMatch(html, new RegExp(`id=["']${removedId}["']`));
  }
  assert.doesNotMatch(script, /summarizeSales/);
  assert.match(script, /\/api\/outlet/);
  assert.match(script, /EventSource/);
  assert.match(css, /min-height:\s*48px/);
  assert.match(css, /@media\s*\(max-width:\s*600px\)/);
});

test('display keeps a 34 percent queue panel, promo area, voice opt-in, and live connection', async () => {
  const [html, script, css] = await Promise.all([read('display.html'), read('display.js'), read('styles.css')]);
  for (const id of ['display-connection', 'active-number', 'promo-content', 'enable-voice']) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
  assert.match(script, /EventSource/);
  assert.match(script, /async function syncState/);
  assert.match(script, /setInterval\(syncState,\s*2000\)/);
  assert.match(script, /speechSynthesis/);
  assert.match(script, /localStorage/);
  assert.match(css, /\.queue-panel[\s\S]*flex:\s*0 0 34%/);
  assert.match(css, /aspect-ratio:\s*16\s*\/\s*9/);
  assert.match(css, /\.active-number[\s\S]*font-size:\s*clamp\(88px,\s*min\(15vw,\s*27vh\),\s*260px\)/);
  assert.match(css, /\.active-number[\s\S]*max-width:\s*100%/);
});

test('owner uses tabbed views, multi-outlet grid summary, and separated dangerous settings', async () => {
  const [html, script, css] = await Promise.all([read('owner.html'), read('owner.js'), read('styles.css')]);
  for (const id of [
    'owner-login', 'owner-dashboard', 'tab-summary', 'tab-reports', 'tab-settings', 'tab-danger',
    'owner-revenue', 'owner-cash', 'owner-qris', 'owner-sales-count', 'owner-active-count',
    'owner-updated-at', 'danger-confirmation',
  ]) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
  assert.match(html, /Zona Bahaya/i);
  assert.match(script, /\/api\/owner\/login/);
  assert.match(script, /\/api\/owner\/multi-summary/);
  assert.match(script, /\/api\/owner\/logout/);
  assert.doesNotMatch(script, /sessionStorage/);
  assert.match(css, /\[hidden\]\s*\{\s*display:\s*none\s*!important/);
  assert.match(css, /@media\s*\(max-width:\s*600px\)[\s\S]*\.owner-metrics/);
});
