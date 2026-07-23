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
