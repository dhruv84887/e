import type { CartItem } from '../types'

export function isCartItemAvailable(item: CartItem) {
  const stock = item.variant ? Math.min(item.variant.stock, item.product.stock) : item.product.stock
  return item.available !== false && item.product.isActive !== false && item.product.isAvailable !== false && !(item.variantId && !item.variant) && stock >= item.quantity
}
