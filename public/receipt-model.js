function requireText(value, label) {
  const text = String(value ?? '').trim();
  if (!text) throw new Error(`Snapshot ${label} tidak lengkap`);
  return text;
}

function requireMoney(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`Snapshot ${label} tidak valid`);
  return value;
}

export function buildReceipt({ order, outlet }) {
  if (!Array.isArray(order?.items) || !order.items.length) throw new Error('Snapshot item struk tidak lengkap');
  const items = order.items.map((item) => {
    const quantity = item.quantity;
    if (!Number.isSafeInteger(quantity) || quantity < 1) throw new Error('Snapshot jumlah item tidak valid');
    return {
      productId: requireText(item.productId, 'ID produk'),
      productName: requireText(item.productName, 'nama produk'),
      category: requireText(item.category, 'kategori'),
      unitPrice: requireMoney(item.unitPrice, 'harga produk'),
      quantity,
      subtotal: requireMoney(item.subtotal, 'subtotal item'),
    };
  });
  const subtotal = requireMoney(order.total, 'subtotal');
  const taxAmount = requireMoney(order.taxAmount ?? 0, 'pajak');
  const totalReceived = requireMoney(order.grandTotal ?? subtotal + taxAmount, 'total diterima');

  return {
    receiptId: requireText(order.id, 'ID transaksi'),
    queueNumber: requireText(order.queueNumber, 'nomor antrean'),
    timestamp: requireText(order.createdAt, 'waktu transaksi'),
    outlet: {
      id: requireText(outlet?.id, 'ID outlet'),
      name: requireText(outlet?.name, 'nama outlet'),
      address: String(outlet?.address ?? '').trim(),
    },
    items,
    subtotal,
    tax: {
      label: order.taxLabel ? String(order.taxLabel) : null,
      rate: Number(order.taxRate ?? 0),
      amount: taxAmount,
    },
    totalReceived,
    paymentMethod: order.paymentMethod === 'cash' ? 'Tunai' : requireText(order.paymentMethod, 'metode pembayaran'),
  };
}
