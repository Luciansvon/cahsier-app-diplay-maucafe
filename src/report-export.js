function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function rupiah(value) {
  return `Rp ${new Intl.NumberFormat('id-ID').format(value ?? 0)}`;
}

function displayDate(value) {
  const match = String(value ?? '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return String(value ?? '');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  return `${match[3]} ${months[Number(match[2]) - 1]} ${match[1]}`;
}

function safeFilenamePart(value) {
  return String(value ?? 'Laporan')
    .replace(/[^A-Za-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 100) || 'Laporan';
}

export function buildSalesWorkbook({
  title,
  date,
  summary,
  filenamePrefix = 'Laporan',
}) {
  const metrics = [
    ['Penjualan Bersih', summary.revenue],
    ['Total Diterima', summary.grandRevenue],
    ['Total HPP', summary.totalCost],
    ['Laba Kotor', summary.margin],
    ['Biaya Operasional', summary.operatingExpenses],
    ['Profit Bersih', summary.netProfit],
  ];
  const rows = (summary.products ?? []).map((product, index) => `
    <tr>
      <td class="center">${index + 1}</td>
      <td>${escapeHtml(product.productName)}</td>
      <td>${escapeHtml(product.category || 'Lainnya')}</td>
      <td class="money">${escapeHtml(rupiah(product.unitPrice))}</td>
      <td class="center">${product.quantity}</td>
      <td class="money">${escapeHtml(rupiah(product.revenue))}</td>
      <td class="money">${escapeHtml(rupiah(product.cost))}</td>
      <td class="money">${escapeHtml(rupiah(product.margin))}</td>
      <td class="center">${product.transactionCount}</td>
      <td class="center">${escapeHtml(product.avgQtyPerTrx)}</td>
    </tr>`).join('');
  const metricRows = metrics.map(([label, value]) => `
    <tr><td colspan="8" class="metric-label">${label}</td><td colspan="2" class="money metric-value">${escapeHtml(rupiah(value))}</td></tr>`).join('');
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
<head><meta charset="utf-8">
<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
<x:Name>Laporan Penjualan</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
</x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
<style>
td,th{font-family:Calibri,Arial,sans-serif;font-size:11pt;mso-number-format:\\@;padding:4px 8px;border-bottom:1px solid #e0e0e0}
th{background:#c00000;color:#fff;font-weight:bold;text-align:center}.title{font-size:14pt;font-weight:bold}
.subtitle{color:#666}.center{text-align:center}.money{text-align:right}.metric-label{text-align:right;font-weight:bold}
.metric-value{font-weight:bold}.net{background:#f5f5f5;border-top:2px solid #333}
</style></head><body><table>
<tr><td colspan="10" class="title">Laporan Penjualan - ${escapeHtml(title)}</td></tr>
<tr><td colspan="10" class="subtitle">Periode: ${escapeHtml(displayDate(date))}</td></tr>
<tr><td colspan="10"></td></tr>
<tr><th>No</th><th>Nama Produk</th><th>Kategori</th><th>Harga</th><th>Qty</th><th>Penjualan Bersih</th><th>HPP</th><th>Laba Kotor</th><th>Transaksi</th><th>Rata-rata Qty/Trx</th></tr>
${rows}
<tr><td colspan="8" class="metric-label">Jumlah Transaksi</td><td colspan="2" class="center metric-value">${summary.transactionCount ?? 0}</td></tr>
${metricRows}
</table></body></html>`;
  return {
    filename: `${safeFilenamePart(filenamePrefix)}_${String(date ?? '').replace(/-/g, '')}.xls`,
    html,
  };
}
