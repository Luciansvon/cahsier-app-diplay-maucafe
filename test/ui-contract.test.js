import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (file) => readFile(new URL(`../public/${file}`, import.meta.url), 'utf8');

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

test('display keeps a 34 percent queue panel, promo area, voice opt-in, and live connection', async () => {
  const [html, script, css] = await Promise.all([read('display.html'), read('display.js'), read('styles.css')]);
  for (const id of ['display-connection', 'active-number', 'promo-content', 'enable-voice']) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
  assert.match(script, /EventSource/);
  assert.match(script, /speechSynthesis/);
  assert.match(script, /localStorage/);
  assert.match(css, /\.queue-panel[\s\S]*flex:\s*0 0 34%/);
  assert.match(css, /aspect-ratio:\s*16\s*\/\s*9/);
  assert.match(css, /\.active-number[\s\S]*font-size:\s*clamp\(88px,\s*min\(15vw,\s*27vh\),\s*260px\)/);
  assert.match(css, /\.active-number[\s\S]*max-width:\s*100%/);
});
