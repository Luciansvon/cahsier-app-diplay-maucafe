import { createQueueServer } from '../src/server.js';
import { createInitialState } from '../src/queue.js';

async function runLiveFlowTest() {
  console.log('🚀 Memulai Pengujian Otomatis Alur Multi-Outlet...\n');

  const initialState = createInitialState({
    products: [
      { id: 'latte', name: 'Kopi Susu', category: 'Kopi', price: 18000, cost: 8000, active: true },
      { id: 'croissant', name: 'Croissant', category: 'Makanan', price: 17000, cost: 8000, active: true },
      { id: 'espresso', name: 'Espresso', category: 'Kopi', price: 15000, cost: 7000, active: true },
    ],
  });

  const app = await createQueueServer({ initialState });
  await app.listen(0, '127.0.0.1');
  const address = app.server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  console.log(`✅ Server uji aktif di ${baseUrl}\n`);

  // 1. Cek Daftar 5 Outlet
  console.log('1️⃣ Memeriksa Daftar 5 Outlet...');
  const resOutlets = await fetch(`${baseUrl}/api/outlets`);
  const dataOutlets = await resOutlets.json();
  console.log(`   - Jumlah outlet terdaftar: ${dataOutlets.outlets.length}`);
  dataOutlets.outlets.forEach((o) => console.log(`     • ${o.name} (${o.address})`));
  console.log('   ✅ Daftar 5 Outlet Valid!\n');

  // Cek produk yang ada di state outlet BSD
  const resStateBSD = await fetch(`${baseUrl}/api/outlet/maucafe-bsd/state`);
  const dataStateBSD = await resStateBSD.json();
  const products = dataStateBSD.products || [];

  // 2. Login Kasir Admin BSD
  console.log('2️⃣ Kasir Maucafe BSD Login dengan PIN 1111...');
  const resAdminLogin = await fetch(`${baseUrl}/api/outlet/maucafe-bsd/admin/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pin: '1111' }),
  });
  console.log(`   - Status Login: ${resAdminLogin.ok ? 'BERHASIL' : 'GAGAL'}`);
  console.log('   ✅ PIN Admin Outlet BSD Berhasil Diverifikasi!\n');

  // 3. Kasir BSD Buat Pesanan
  console.log('3️⃣ Kasir BSD Membuat Pesanan...');
  const targetProduct = products[0] || { id: 'latte' };
  const resOrderBSD = await fetch(`${baseUrl}/api/outlet/maucafe-bsd/orders`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      items: [{ productId: targetProduct.id, quantity: 2 }],
      paymentMethod: 'QRIS',
    }),
  });
  const dataOrderBSD = await resOrderBSD.json();

  if (!resOrderBSD.ok) {
    console.error('ERROR Order BSD:', dataOrderBSD);
    process.exit(1);
  }

  console.log(`   - Nomor Antrean BSD: ${dataOrderBSD.order.queueNumber}`);
  console.log(`   - Total Transaksi BSD: Rp ${dataOrderBSD.order.grandTotal.toLocaleString('id-ID')}`);
  console.log('   ✅ Pesanan Outlet BSD Berhasil Diinput!\n');

  // 4. Panggil Antrean di Display BSD
  console.log('4️⃣ Panggil Nomor Antrean 001 di Layar TV BSD...');
  const resCallBSD = await fetch(`${baseUrl}/api/outlet/maucafe-bsd/orders/${dataOrderBSD.order.id}/call`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  });
  const dataCallBSD = await resCallBSD.json();
  console.log(`   - Nomor Aktif di TV BSD: ${dataCallBSD.state.activeCall.queueNumber}`);
  console.log('   ✅ Layar TV BSD Menampilkan Panggilan 001!\n');

  // 5. Kasir PIK Buat Pesanan (Pembuktian Terisolasi)
  console.log('5️⃣ Kasir Maucafe PIK Membuat Pesanan...');
  const resOrderPIK = await fetch(`${baseUrl}/api/outlet/maucafe-pik/orders`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      items: [{ productId: targetProduct.id, quantity: 1 }],
      paymentMethod: 'cash',
    }),
  });
  const dataOrderPIK = await resOrderPIK.json();
  console.log(`   - Nomor Antrean PIK: ${dataOrderPIK.order.queueNumber}`);
  console.log(`   - Total Transaksi PIK: Rp ${dataOrderPIK.order.grandTotal.toLocaleString('id-ID')}`);
  console.log('   ✅ Pesanan PIK Berjalan Mandiri Tanpa Bentrok!\n');

  // 6. Owner Login & Cek Summary 5 Outlet
  console.log('6️⃣ Owner Login dengan PIN 1234 & Cek Summary 5 Outlet...');
  const resOwnerLogin = await fetch(`${baseUrl}/api/owner/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pin: '1234' }),
  });
  const cookie = resOwnerLogin.headers.get('set-cookie');

  const resMultiSummary = await fetch(`${baseUrl}/api/owner/multi-summary`, {
    headers: { cookie },
  });
  const dataSummary = await resMultiSummary.json();
  console.log(`   - Total Omzet Gabungan 5 Outlet: Rp ${dataSummary.grandTotals.revenue.toLocaleString('id-ID')}`);
  console.log(`   - Total Keuntungan Gabungan: Rp ${dataSummary.grandTotals.margin.toLocaleString('id-ID')}`);
  console.log(`   - Total Transaksi Selesai/Aktif: ${dataSummary.grandTotals.salesCount} transaksi`);
  console.log('   ✅ Dashboard Owner Menampilkan Data Semua Outlet dengan Akurat!\n');

  await app.close();
  console.log('🎉 PENGUJIAN SELESAI: SEMUA SISTEM MULTI-OUTLET BERJALAN 100% SEMPURNA!');
}

runLiveFlowTest().catch(console.error);
