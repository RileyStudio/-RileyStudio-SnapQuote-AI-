// Shared by the New Estimate form, the Review screen, and the public quote
// page's local-storage fallback, so subtotal math is calculated exactly once.

export function computeSubtotals(lineItems = []) {
  const laborSubtotal = lineItems
    .filter((item) => item.type === 'labor')
    .reduce((sum, item) => sum + (Number(item.qty) || 0) * (Number(item.unit_price) || 0), 0);

  const materialsSubtotal = lineItems
    .filter((item) => item.type === 'material')
    .reduce((sum, item) => sum + (Number(item.qty) || 0) * (Number(item.unit_price) || 0), 0);

  return { laborSubtotal, materialsSubtotal };
}

// LineItemsTable was originally built for the customer quote view's
// separate materials/labor arrays (qty+unit_cost, hours+rate). The
// contractor-side New Estimate form instead produces one unified array
// ({description, qty, unit_price, type}) per the line-item editor spec.
// This adapts the unified shape into what LineItemsTable already expects,
// so that component didn't need to change for two slightly different
// data shapes.
export function toLineItemsTableFormat(lineItems = []) {
  const materials = lineItems
    .filter((item) => item.type === 'material')
    .map((item) => ({ description: item.description, qty: item.qty, unit_cost: item.unit_price }));

  const labor = lineItems
    .filter((item) => item.type === 'labor')
    .map((item) => ({ description: item.description, hours: item.qty, rate: item.unit_price }));

  return { materials, labor };
}
