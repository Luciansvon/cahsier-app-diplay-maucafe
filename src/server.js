import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  addProduct,
  callOrder,
  cancelOrder,
  clearAllOrders,
  completeOrder,
  createInitialState,
  createOrder,
  migrateOwnerPin,
  purgeOldOrders,
  resetPromoMedia,
  resetQueue,
  updateOwnerPin,
  updateProduct,
  updatePromoMedia,
  updateTaxConfig,
  verifyOwnerPin,
} from './queue.js';
import { JsonStore } from './store.js';
import { summarizeSales } from '../public/sales.js';

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = dirname(MODULE_DIR);
const CONTENT_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

function sendJson(response, status, payload, headers = {}) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...headers,
  });
  response.end(JSON.stringify(payload));
}

function publicState(state) {
  const copy = structuredClone(state);
  delete copy.ownerPin;
  delete copy.ownerPinHash;
  return copy;
}

function cookies(request) {
  return Object.fromEntries((request.headers.cookie ?? '').split(';').flatMap((entry) => {
    const separator = entry.indexOf('=');
    if (separator < 1) return [];
    return [[entry.slice(0, separator).trim(), entry.slice(separator + 1).trim()]];
  }));
}

async function readJson(request, maxBytes = 35_000_000) {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (body.length > maxBytes) {
      const error = new Error('Ukuran file terlalu besar');
      error.status = 413;
      throw error;
    }
  }
  if (!body) return {};
  try {
    return JSON.parse(body);
  } catch {
    const error = new Error('Format JSON tidak valid');
    error.status = 400;
    throw error;
  }
}

async function serveFile(response, filePath) {
  try {
    const content = await readFile(filePath);
    response.writeHead(200, {
      'content-type': CONTENT_TYPES[extname(filePath)] ?? 'application/octet-stream',
      'cache-control': 'no-store, no-cache, must-revalidate, max-age=0',
      pragma: 'no-cache',
    });
    response.end(content);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    sendJson(response, 404, { error: 'Halaman tidak ditemukan' });
  }
}

async function loadOutletsConfig(outletsFilePath) {
  try {
    const content = await readFile(outletsFilePath, 'utf8');
    return JSON.parse(content);
  } catch {
    return [
      { id: 'maucafe-bsd', name: 'Maucafe BSD', address: 'BSD City', adminPin: '1111' },
      { id: 'maucafe-pik', name: 'Maucafe PIK', address: 'PIK Avenue', adminPin: '1111' },
      { id: 'maucafe-bintaro', name: 'Maucafe Bintaro', address: 'Bintaro Jaya', adminPin: '1111' },
      { id: 'maucafe-kemang', name: 'Maucafe Kemang', address: 'Kemang Raya', adminPin: '1111' },
      { id: 'maucafe-depok', name: 'Maucafe Depok', address: 'Margonda Depok', adminPin: '1111' },
    ];
  }
}

export async function createQueueServer({
  dataDir = join(PROJECT_DIR, 'data'),
  publicDir = join(PROJECT_DIR, 'public'),
  initialState = createInitialState(),
} = {}) {
  const outletsConfig = await loadOutletsConfig(join(dataDir, 'outlets.json'));
  const stores = new Map();
  const clientsMap = new Map();
  const adminSessions = new Map();
  const ownerSessions = new Map();
  const ownerSessionLifetimeMs = 8 * 60 * 60 * 1000;
  const adminSessionLifetimeMs = 12 * 60 * 60 * 1000;

  for (const outlet of outletsConfig) {
    const filePath = join(dataDir, `outlet-${outlet.id}.json`);
    const store = await new JsonStore(filePath, initialState).init();
    stores.set(outlet.id, { outlet, store });
    clientsMap.set(outlet.id, new Set());
  }

  const defaultOutletId = outletsConfig[0]?.id || 'maucafe-bsd';

  function ownerSession(request) {
    const token = cookies(request).owner_session;
    if (!token) return null;
    const expiresAt = ownerSessions.get(token);
    if (!expiresAt || expiresAt <= Date.now()) {
      ownerSessions.delete(token);
      return null;
    }
    return token;
  }

  function adminSession(request, outletId) {
    const token = cookies(request)[`admin_session_${outletId}`];
    if (!token) return null;
    const session = adminSessions.get(token);
    if (!session || session.expiresAt <= Date.now() || session.outletId !== outletId) {
      if (token) adminSessions.delete(token);
      return null;
    }
    return token;
  }

  function ownerAuthorized(request, pin, outletStore) {
    return Boolean(ownerSession(request)) || verifyOwnerPin(outletStore.get(), pin);
  }

  function broadcast(outletId, state) {
    const clients = clientsMap.get(outletId);
    if (!clients) return;
    const message = `data: ${JSON.stringify(publicState(state))}\n\n`;
    for (const client of clients) client.write(message);
  }

  async function mutate(outletId, transform) {
    const target = stores.get(outletId);
    if (!target) throw new Error(`Outlet ${outletId} tidak ditemukan`);
    let output;
    const state = await target.store.update((current) => {
      output = transform(current);
      return output.state ?? output;
    });
    broadcast(outletId, state);
    return { state: publicState(state), output };
  }

  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, 'http://localhost');
    const path = url.pathname;

    try {
      if (request.method === 'GET' && path === '/') {
        response.writeHead(302, { location: `/outlet/${defaultOutletId}/admin` });
        response.end();
        return;
      }

      if (request.method === 'GET' && (path === '/admin' || path === '/display')) {
        response.writeHead(302, { location: `/outlet/${defaultOutletId}${path}` });
        response.end();
        return;
      }

      const staticFiles = new Map([
        ['/owner', 'owner.html'],
        ['/admin.js', 'admin.js'],
        ['/sales.js', 'sales.js'],
        ['/display.js', 'display.js'],
        ['/owner.js', 'owner.js'],
        ['/styles.css', 'styles.css'],
      ]);

      if (request.method === 'GET' && staticFiles.has(path)) {
        await serveFile(response, join(publicDir, staticFiles.get(path)));
        return;
      }

      const outletPageMatch = path.match(/^\/outlet\/([^/]+)\/(admin|display)$/);
      if (request.method === 'GET' && outletPageMatch) {
        const [, outletId, page] = outletPageMatch;
        if (!stores.has(outletId)) {
          sendJson(response, 404, { error: 'Outlet tidak ditemukan' });
          return;
        }
        await serveFile(response, join(publicDir, `${page}.html`));
        return;
      }

      if (request.method === 'GET' && path.startsWith('/media/')) {
        await serveFile(response, join(publicDir, path));
        return;
      }

      if (request.method === 'GET' && path === '/api/outlets') {
        const list = outletsConfig.map(({ id, name, address }) => ({ id, name, address }));
        sendJson(response, 200, { outlets: list, defaultOutletId });
        return;
      }

      if (request.method === 'POST' && path === '/api/owner/login') {
        const body = await readJson(request);
        const sampleStore = stores.get(defaultOutletId).store;
        if (!verifyOwnerPin(sampleStore.get(), body.pin)) {
          sendJson(response, 401, { error: 'PIN Pemilik tidak valid' });
          return;
        }
        for (const { store } of stores.values()) {
          if (store.get().ownerPin && !store.get().ownerPinHash) {
            await store.update((current) => migrateOwnerPin(current, body.pin));
          }
        }
        const token = randomBytes(32).toString('hex');
        ownerSessions.set(token, Date.now() + ownerSessionLifetimeMs);
        sendJson(response, 200, { ok: true, outlets: outletsConfig }, {
          'set-cookie': `owner_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800`,
        });
        return;
      }

      if (request.method === 'POST' && path === '/api/owner/logout') {
        const token = ownerSession(request);
        if (token) ownerSessions.delete(token);
        sendJson(response, 200, { ok: true }, {
          'set-cookie': 'owner_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0',
        });
        return;
      }

      if (request.method === 'GET' && path === '/api/owner/multi-summary') {
        if (!ownerSession(request)) {
          sendJson(response, 401, { error: 'Sesi berakhir, masukkan PIN lagi.' });
          return;
        }
        const summaries = [];
        let grandRevenue = 0;
        let grandCost = 0;
        let grandMargin = 0;
        let grandSalesCount = 0;
        let grandActiveCount = 0;

        for (const outlet of outletsConfig) {
          const { store } = stores.get(outlet.id);
          const state = store.get();
          const summary = summarizeSales(state.orders, state.businessDate);
          const activeCount = state.orders.filter((o) => ['waiting', 'ready'].includes(o.status)).length;

          summaries.push({
            id: outlet.id,
            name: outlet.name,
            address: outlet.address,
            businessDate: state.businessDate,
            revenue: summary.revenue,
            cash: summary.paymentTotals.cash,
            qris: summary.paymentTotals.QRIS,
            cost: summary.totalCost,
            margin: summary.margin,
            tax: summary.totalTax,
            salesCount: summary.transactionCount,
            activeCount,
          });

          grandRevenue += summary.revenue;
          grandCost += summary.totalCost;
          grandMargin += summary.margin;
          grandSalesCount += summary.transactionCount;
          grandActiveCount += activeCount;
        }

        sendJson(response, 200, {
          summaries,
          grandTotals: {
            revenue: grandRevenue,
            cost: grandCost,
            margin: grandMargin,
            salesCount: grandSalesCount,
            activeCount: grandActiveCount,
          },
          updatedAt: new Date().toISOString(),
        });
        return;
      }

      if (request.method === 'GET' && path === '/api/owner/all-orders') {
        if (!ownerSession(request)) {
          sendJson(response, 401, { error: 'Sesi berakhir, masukkan PIN lagi.' });
          return;
        }
        const allOrders = [];
        for (const [outletId, { outlet, store }] of stores.entries()) {
          const state = store.get();
          for (const order of state.orders) {
            allOrders.push({ ...order, outletId, outletName: outlet.name });
          }
        }
        sendJson(response, 200, { orders: allOrders, updatedAt: new Date().toISOString() });
        return;
      }

      if (request.method === 'GET' && path === '/api/owner/export-sales-all') {
        if (!ownerSession(request)) {
          sendJson(response, 401, { error: 'Sesi berakhir, masukkan PIN lagi.' });
          return;
        }
        const allOrders = [];
        for (const { store } of stores.values()) {
          const state = store.get();
          allOrders.push(...state.orders);
        }
        const dateStr = url.searchParams.get('date') || new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
        const summary = summarizeSales(allOrders, dateStr);

        const formatExcelDate = (str) => {
          try {
            const [y, m, d] = str.split('-');
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
            return `${d} ${months[parseInt(m, 10) - 1]} ${y}`;
          } catch {
            return str;
          }
        };
        const rp = (v) => 'Rp ' + new Intl.NumberFormat('id-ID').format(v);
        const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

        const formattedDate = formatExcelDate(dateStr);
        const headers = ['No', 'Nama Produk', 'Kategori', 'Harga', 'Qty Terjual', 'Total Revenue', 'Jumlah Transaksi', 'Rata-rata Qty/Trx', 'Total Profit'];
        const maxLens = headers.map((h) => h.length);

        let totalQty = 0;
        let totalRevenue = 0;
        let totalProfit = 0;

        const rowsData = [];
        summary.products.forEach((prod, index) => {
          totalQty += prod.quantity;
          totalRevenue += prod.revenue;
          totalProfit += prod.margin;
          const cells = [
            String(index + 1),
            prod.productName,
            prod.category || 'Lainnya',
            rp(prod.unitPrice),
            String(prod.quantity),
            rp(prod.revenue),
            String(prod.transactionCount),
            String(prod.avgQtyPerTrx),
            rp(prod.margin),
          ];
          cells.forEach((c, i) => { maxLens[i] = Math.max(maxLens[i], c.length); });
          rowsData.push(cells);
        });

        const totalCells = ['TOTAL', '', '', '', String(totalQty), rp(totalRevenue), String(summary.transactionCount), '', rp(totalProfit)];
        totalCells.forEach((c, i) => { maxLens[i] = Math.max(maxLens[i], c.length); });

        const colWidths = maxLens.map((len) => Math.max(40, Math.round(len * 7.5) + 20));

        let dataRows = '';
        rowsData.forEach((cells) => {
          dataRows += `<tr>
            <td style="text-align:center">${esc(cells[0])}</td>
            <td>${esc(cells[1])}</td>
            <td>${esc(cells[2])}</td>
            <td style="text-align:right">${esc(cells[3])}</td>
            <td style="text-align:center">${esc(cells[4])}</td>
            <td style="text-align:right">${esc(cells[5])}</td>
            <td style="text-align:center">${esc(cells[6])}</td>
            <td style="text-align:center">${esc(cells[7])}</td>
            <td style="text-align:right">${esc(cells[8])}</td>
          </tr>`;
        });

        const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
<head><meta charset="utf-8">
<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
<x:Name>Laporan Gabungan Semua Outlet</x:Name>
<x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
</x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
<style>
  td, th { font-family: Calibri, Arial, sans-serif; font-size: 11pt; mso-number-format:\\@; }
  th { background: #C00000; color: #FFFFFF; font-weight: bold; text-align: center; padding: 6px 8px; }
  td { padding: 4px 8px; border-bottom: 1px solid #E0E0E0; }
  .title { font-size: 14pt; font-weight: bold; }
  .subtitle { font-size: 10pt; color: #666666; }
  .total td { font-weight: bold; background: #F5F5F5; border-top: 2px solid #333333; }
</style>
</head><body>
<table>
  <col ${colWidths.map((w) => `width="${w}"`).join('><col ')}>
  <tr><td colspan="9" class="title">Laporan Penjualan - Gabungan Semua Outlet (5 Outlet)</td></tr>
  <tr><td colspan="9" class="subtitle">Periode: ${esc(formattedDate)}</td></tr>
  <tr><td colspan="9"></td></tr>
  <tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr>
  ${dataRows}
  <tr class="total">
    <td colspan="4" style="text-align:right;font-weight:bold">TOTAL GABUNGAN</td>
    <td style="text-align:center;font-weight:bold">${totalQty}</td>
    <td style="text-align:right;font-weight:bold">${esc(rp(totalRevenue))}</td>
    <td style="text-align:center;font-weight:bold">${summary.transactionCount}</td>
    <td></td>
    <td style="text-align:right;font-weight:bold">${esc(rp(totalProfit))}</td>
  </tr>
</table>
</body></html>`;

        const cleanDate = dateStr.replace(/-/g, '');
        const filename = `Laporan_Gabungan_Semua_Outlet_${cleanDate}.xls`;

        response.writeHead(200, {
          'content-type': 'application/vnd.ms-excel; charset=utf-8',
          'content-disposition': `attachment; filename="${filename}"`,
          'cache-control': 'no-cache',
        });
        response.end(html);
        return;
      }

      if (request.method === 'POST' && path === '/api/owner/clear-all-outlets-sales') {

        if (!ownerSession(request)) {
          sendJson(response, 401, { error: 'Sesi berakhir, masukkan PIN lagi.' });
          return;
        }
        for (const [outletId, { store }] of stores.entries()) {
          const nextState = await store.update((current) => clearAllOrders(current));
          broadcast(outletId, nextState);
        }
        sendJson(response, 200, { ok: true });
        return;
      }


      const outletApiMatch = path.match(/^\/api\/outlet\/([^/]+)(\/.+)?$/);
      if (!outletApiMatch) {
        sendJson(response, 404, { error: 'Route tidak ditemukan' });
        return;
      }

      const [, outletId, subPath = '/'] = outletApiMatch;
      const targetOutlet = stores.get(outletId);
      if (!targetOutlet) {
        sendJson(response, 404, { error: `Outlet '${outletId}' tidak ditemukan` });
        return;
      }

      const { outlet, store } = targetOutlet;

      if (request.method === 'POST' && subPath === '/admin/login') {
        const body = await readJson(request);
        const inputPin = String(body.pin ?? '').trim();
        if (inputPin !== outlet.adminPin) {
          sendJson(response, 401, { error: 'PIN Admin outlet tidak valid' });
          return;
        }
        const token = randomBytes(32).toString('hex');
        adminSessions.set(token, { outletId, expiresAt: Date.now() + adminSessionLifetimeMs });
        sendJson(response, 200, { ok: true, outlet: { id: outlet.id, name: outlet.name } }, {
          'set-cookie': `admin_session_${outletId}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200`,
        });
        return;
      }

      if (request.method === 'POST' && subPath === '/admin/logout') {
        const token = adminSession(request, outletId);
        if (token) adminSessions.delete(token);
        sendJson(response, 200, { ok: true }, {
          'set-cookie': `admin_session_${outletId}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`,
        });
        return;
      }

      if (request.method === 'GET' && subPath === '/admin/session') {
        const isAuth = Boolean(adminSession(request, outletId) || ownerSession(request));
        sendJson(response, 200, { authenticated: isAuth, outlet: { id: outlet.id, name: outlet.name } });
        return;
      }

      if (request.method === 'GET' && subPath === '/info') {
        sendJson(response, 200, { outlet: { id: outlet.id, name: outlet.name, address: outlet.address } });
        return;
      }

      if (request.method === 'GET' && subPath === '/state') {
        sendJson(response, 200, { ...publicState(store.get()), outletInfo: { id: outlet.id, name: outlet.name } });
        return;
      }

      if (request.method === 'GET' && subPath === '/events') {
        response.writeHead(200, {
          'content-type': 'text/event-stream; charset=utf-8',
          'cache-control': 'no-cache',
          connection: 'keep-alive',
        });
        const clients = clientsMap.get(outletId);
        clients.add(response);
        const payload = { ...publicState(store.get()), outletInfo: { id: outlet.id, name: outlet.name } };
        response.write(`data: ${JSON.stringify(payload)}\n\n`);
        request.on('close', () => clients.delete(response));
        return;
      }

      if (request.method === 'GET' && subPath === '/owner/state') {
        if (!ownerSession(request)) {
          sendJson(response, 401, { error: 'Sesi berakhir, masukkan PIN lagi.' });
          return;
        }
        sendJson(response, 200, {
          state: publicState(store.get()),
          outletInfo: { id: outlet.id, name: outlet.name },
          updatedAt: new Date().toISOString(),
        });
        return;
      }

      if (request.method === 'GET' && subPath === '/owner/export-sales') {
        if (!ownerSession(request)) {
          sendJson(response, 401, { error: 'Sesi berakhir, masukkan PIN lagi.' });
          return;
        }
        const state = store.get();
        const dateStr = url.searchParams.get('date') || state.businessDate;
        const summary = summarizeSales(state.orders, dateStr);

        const formatExcelDate = (str) => {
          try {
            const [y, m, d] = str.split('-');
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
            return `${d} ${months[parseInt(m, 10) - 1]} ${y}`;
          } catch {
            return str;
          }
        };
        const rp = (v) => 'Rp ' + new Intl.NumberFormat('id-ID').format(v);
        const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

        const formattedDate = formatExcelDate(dateStr);
        const headers = ['No', 'Nama Produk', 'Kategori', 'Harga', 'Qty Terjual', 'Total Revenue', 'Jumlah Transaksi', 'Rata-rata Qty/Trx', 'Total Profit'];
        const maxLens = headers.map((h) => h.length);

        let totalQty = 0;
        let totalRevenue = 0;
        let totalProfit = 0;

        const rowsData = [];
        summary.products.forEach((prod, index) => {
          totalQty += prod.quantity;
          totalRevenue += prod.revenue;
          totalProfit += prod.margin;
          const cells = [
            String(index + 1),
            prod.productName,
            prod.category || 'Lainnya',
            rp(prod.unitPrice),
            String(prod.quantity),
            rp(prod.revenue),
            String(prod.transactionCount),
            String(prod.avgQtyPerTrx),
            rp(prod.margin),
          ];
          cells.forEach((c, i) => { maxLens[i] = Math.max(maxLens[i], c.length); });
          rowsData.push(cells);
        });

        const totalCells = ['TOTAL', '', '', '', String(totalQty), rp(totalRevenue), String(summary.transactionCount), '', rp(totalProfit)];
        totalCells.forEach((c, i) => { maxLens[i] = Math.max(maxLens[i], c.length); });

        const colWidths = maxLens.map((len) => Math.max(40, Math.round(len * 7.5) + 20));

        let dataRows = '';
        rowsData.forEach((cells) => {
          dataRows += `<tr>
            <td style="text-align:center">${esc(cells[0])}</td>
            <td>${esc(cells[1])}</td>
            <td>${esc(cells[2])}</td>
            <td style="text-align:right">${esc(cells[3])}</td>
            <td style="text-align:center">${esc(cells[4])}</td>
            <td style="text-align:right">${esc(cells[5])}</td>
            <td style="text-align:center">${esc(cells[6])}</td>
            <td style="text-align:center">${esc(cells[7])}</td>
            <td style="text-align:right">${esc(cells[8])}</td>
          </tr>`;
        });

        const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
<head><meta charset="utf-8">
<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
<x:Name>Laporan ${esc(outlet.name)}</x:Name>
<x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
</x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
<style>
  td, th { font-family: Calibri, Arial, sans-serif; font-size: 11pt; mso-number-format:\\@; }
  th { background: #C00000; color: #FFFFFF; font-weight: bold; text-align: center; padding: 6px 8px; }
  td { padding: 4px 8px; border-bottom: 1px solid #E0E0E0; }
  .title { font-size: 14pt; font-weight: bold; }
  .subtitle { font-size: 10pt; color: #666666; }
  .total td { font-weight: bold; background: #F5F5F5; border-top: 2px solid #333333; }
</style>
</head><body>
<table>
  <col ${colWidths.map((w) => `width="${w}"`).join('><col ')}>
  <tr><td colspan="9" class="title">Laporan Penjualan - ${esc(outlet.name)}</td></tr>
  <tr><td colspan="9" class="subtitle">Periode: ${esc(formattedDate)}</td></tr>
  <tr><td colspan="9"></td></tr>
  <tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr>
  ${dataRows}
  <tr class="total">
    <td colspan="4" style="text-align:right;font-weight:bold">TOTAL</td>
    <td style="text-align:center;font-weight:bold">${totalQty}</td>
    <td style="text-align:right;font-weight:bold">${esc(rp(totalRevenue))}</td>
    <td style="text-align:center;font-weight:bold">${summary.transactionCount}</td>
    <td></td>
    <td style="text-align:right;font-weight:bold">${esc(rp(totalProfit))}</td>
  </tr>
</table>
</body></html>`;

        const cleanDate = dateStr.replace(/-/g, '');
        const filename = `Laporan_${outlet.id}_${cleanDate}.xls`;

        response.writeHead(200, {
          'content-type': 'application/vnd.ms-excel; charset=utf-8',
          'content-disposition': `attachment; filename="${filename}"`,
          'cache-control': 'no-cache',
        });
        response.end(html);
        return;
      }

      if (request.method === 'POST' && subPath === '/orders') {
        const body = await readJson(request);
        const { state: nextState, output } = await mutate(outletId, (current) => createOrder(current, body));
        sendJson(response, 201, { state: nextState, order: output.order });
        return;
      }

      const orderAction = subPath.match(/^\/orders\/([^/]+)\/(call|complete|cancel)$/);
      if (request.method === 'POST' && orderAction) {
        await readJson(request);
        const [, orderId, action] = orderAction;
        const actions = { call: callOrder, complete: completeOrder, cancel: cancelOrder };
        const { state: nextState, output } = await mutate(outletId, (current) => actions[action](current, orderId));
        sendJson(response, 200, { state: nextState, order: output.order });
        return;
      }

      if (request.method === 'POST' && subPath === '/reset') {
        const body = await readJson(request);
        if (!ownerAuthorized(request, body.pin, store)) {
          sendJson(response, 401, { error: 'PIN Pemilik tidak valid' });
          return;
        }
        const { state: nextState } = await mutate(outletId, (current) => resetQueue(current));
        sendJson(response, 200, { state: nextState });
        return;
      }

      if (request.method === 'POST' && subPath === '/sales/purge') {
        const body = await readJson(request);
        if (!ownerAuthorized(request, body.pin, store)) {
          sendJson(response, 401, { error: 'PIN Pemilik tidak valid' });
          return;
        }
        const { state: nextState } = await mutate(outletId, (current) => purgeOldOrders(current, body.daysToKeep || 30));
        sendJson(response, 200, { state: nextState });
        return;
      }

      if (request.method === 'POST' && subPath === '/sales/clear') {
        const body = await readJson(request);
        if (!ownerAuthorized(request, body.pin, store)) {
          sendJson(response, 401, { error: 'PIN Pemilik tidak valid' });
          return;
        }
        const { state: nextState } = await mutate(outletId, (current) => clearAllOrders(current));
        sendJson(response, 200, { state: nextState });
        return;
      }

      if (request.method === 'POST' && subPath === '/owner/pin') {
        const body = await readJson(request);
        if (!ownerSession(request)) {
          sendJson(response, 401, { error: 'Sesi berakhir, masukkan PIN lagi.' });
          return;
        }
        let changed = false;
        for (const [id] of stores.entries()) {
          const { output } = await mutate(id, (current) => updateOwnerPin(current, body.currentPin, body.newPin));
          if (output.state) changed = true;
        }
        const updatedTargetState = publicState(stores.get(outletId).store.get());
        sendJson(response, 200, { state: updatedTargetState, changed });
        return;
      }

      if (request.method === 'POST' && subPath === '/products') {
        const body = await readJson(request);
        const { state: nextState, output } = await mutate(outletId, (current) => addProduct(current, body));
        sendJson(response, 201, { state: nextState, product: output.product });
        return;
      }

      const productRoute = subPath.match(/^\/products\/([^/]+)$/);
      if (request.method === 'PATCH' && productRoute) {
        const body = await readJson(request);
        const { state: nextState, output } = await mutate(outletId, (current) => updateProduct(current, productRoute[1], body));
        sendJson(response, 200, { state: nextState, product: output.product });
        return;
      }

      if (request.method === 'POST' && subPath === '/tax-config') {
        const body = await readJson(request);
        if (!ownerSession(request)) {
          sendJson(response, 401, { error: 'Sesi berakhir, masukkan PIN lagi.' });
          return;
        }
        const { state: nextState, output } = await mutate(outletId, (current) => updateTaxConfig(current, body));
        sendJson(response, 200, { state: nextState, taxConfig: output.taxConfig });
        return;
      }

      if (request.method === 'POST' && subPath === '/media/upload') {
        const body = await readJson(request, 35_000_000);
        const { filename, dataUrl } = body;
        if (!dataUrl || typeof dataUrl !== 'string') {
          sendJson(response, 400, { error: 'Data file media tidak valid' });
          return;
        }
        const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (!match) {
          sendJson(response, 400, { error: 'Format data URL tidak valid' });
          return;
        }
        const [, mimeType, base64Data] = match;
        let ext = '';
        let type = '';
        if (mimeType.startsWith('video/mp4')) { ext = '.mp4'; type = 'video'; }
        else if (mimeType.startsWith('video/webm')) { ext = '.webm'; type = 'video'; }
        else if (mimeType.startsWith('image/png')) { ext = '.png'; type = 'image'; }
        else if (mimeType.startsWith('image/jpeg') || mimeType.startsWith('image/jpg')) { ext = '.jpg'; type = 'image'; }
        else if (mimeType.startsWith('image/webp')) { ext = '.webp'; type = 'image'; }
        else {
          sendJson(response, 400, { error: 'Format file tidak didukung. Gunakan MP4, WEBM, JPG, PNG, atau WEBP.' });
          return;
        }

        const mediaDir = join(publicDir, 'media');
        await mkdir(mediaDir, { recursive: true });
        const safeFilename = `uploaded-promo-${outletId}-${Date.now()}${ext}`;
        const filePath = join(mediaDir, safeFilename);
        const buffer = Buffer.from(base64Data, 'base64');
        await writeFile(filePath, buffer);

        const mediaUrl = `/media/${safeFilename}`;
        const { state: nextState, output } = await mutate(outletId, (current) => updatePromoMedia(current, {
          type,
          url: mediaUrl,
          filename: filename || safeFilename,
        }));

        sendJson(response, 200, { state: nextState, promoMedia: output.promoMedia });
        return;
      }

      if (request.method === 'POST' && subPath === '/media/reset') {
        const { state: nextState, output } = await mutate(outletId, (current) => resetPromoMedia(current));
        sendJson(response, 200, { state: nextState, promoMedia: output.promoMedia });
        return;
      }

      sendJson(response, 404, { error: 'Route tidak ditemukan' });
    } catch (error) {
      sendJson(response, error.status ?? 400, { error: error.message || 'Request gagal' });
    }
  });

  const keepAlive = setInterval(() => {
    for (const clients of clientsMap.values()) {
      for (const client of clients) client.write(': keep-alive\n\n');
    }
  }, 20_000);

  return {
    server,
    stores,
    listen(port = 3000, host = '0.0.0.0') {
      return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, host, () => {
          server.off('error', reject);
          resolve();
        });
      });
    },
    close() {
      clearInterval(keepAlive);
      for (const clients of clientsMap.values()) {
        for (const client of clients) client.end();
      }
      return new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    },
  };
}

async function start() {
  const example = JSON.parse(await readFile(join(PROJECT_DIR, 'data', 'state.example.json'), 'utf8'));
  const app = await createQueueServer({ initialState: example });
  const port = Number(process.env.PORT || 3000);
  await app.listen(port);
  console.log(`Coffee Queue Multi-Outlet aktif di http://localhost:${port}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  start().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
