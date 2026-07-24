export function summarizeSales(orders = [], businessDate) {
  const transactions = orders
    .filter((order) => order.businessDate === businessDate)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const counted = transactions.filter((order) => order.status !== 'cancelled');
  const paymentTotals = { cash: 0, QRIS: 0 };
  const products = new Map();
  let totalCost = 0;
  let totalTax = 0;

  for (const order of counted) {
    paymentTotals[order.paymentMethod] = (paymentTotals[order.paymentMethod] ?? 0) + (order.grandTotal ?? order.total);
    totalTax += order.taxAmount ?? 0;
    const orderId = order.id || order.queueNumber || order.createdAt;

    for (const item of order.items) {
      const itemCost = (item.unitCost ?? 0) * item.quantity;
      totalCost += itemCost;
      const value = products.get(item.productId) ?? {
        productId: item.productId,
        productName: item.productName,
        category: item.category || 'Lainnya',
        unitPrice: item.price ?? (item.quantity > 0 ? Math.round(item.subtotal / item.quantity) : 0),
        quantity: 0,
        revenue: 0,
        cost: 0,
        orders: new Set(),
      };
      value.quantity += item.quantity;
      value.revenue += item.subtotal;
      value.cost += itemCost;
      value.orders.add(orderId);
      products.set(item.productId, value);
    }
  }

  const revenue = counted.reduce((sum, order) => sum + order.total, 0);
  const productList = [...products.values()]
    .map((p) => {
      const transactionCount = p.orders.size;
      const avgQtyPerTrx = transactionCount > 0 ? (p.quantity / transactionCount).toFixed(2).replace('.', ',') : '0,00';
      const margin = p.revenue - p.cost;
      return {
        productId: p.productId,
        productName: p.productName,
        category: p.category,
        unitPrice: p.unitPrice,
        quantity: p.quantity,
        revenue: p.revenue,
        cost: p.cost,
        margin,
        transactionCount,
        avgQtyPerTrx,
      };
    })
    .sort((left, right) => right.quantity - left.quantity || left.productName.localeCompare(right.productName));

  return {
    revenue,
    totalCost,
    margin: revenue - totalCost,
    totalTax,
    grandRevenue: revenue + totalTax,
    transactionCount: counted.length,
    paymentTotals,
    products: productList,
    transactions,
  };
}

