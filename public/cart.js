export function addToCart(items, product, quantity = 1) {
  if (items.some(row => row.product.stall_id !== product.stall_id)) {
    throw new Error('El carrito admite productos de un solo puesto.');
  }
  const current = items.find(row => row.product.id === product.id);
  return setQuantity(items, product, (current?.quantity ?? 0) + quantity);
}

export function setQuantity(items, product, quantity) {
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > product.stock || quantity > 999) {
    throw new Error('La cantidad supera el stock o no es válida.');
  }
  const others = items.filter(row => row.product.id !== product.id);
  if (!quantity) return others;
  if (others.length >= 12) throw new Error('Puedes agregar hasta 12 productos distintos.');
  if (items.some(row => row.product.id === product.id)) {
    return items.map(row => row.product.id === product.id ? { product, quantity } : row);
  }
  return [...others, { product, quantity }];
}

export const subtotal = items => items.reduce((total, row) => total + row.product.price_cents * row.quantity, 0);

export function filterCatalog(products, category, search, stallId) {
  const normalize = value => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
  const term = normalize(search);
  return products.filter(product => (!category || product.category === category)
    && (!stallId || product.stall_id === stallId)
    && normalize(product.name + ' ' + product.stalls.name).includes(term));
}
