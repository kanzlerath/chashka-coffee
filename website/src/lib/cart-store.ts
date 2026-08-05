export type CartLine = {
  variantId: string
  productSlug: string
  productName: string
  variantLabel: string
  imageUrl: string | null
  unitPriceKopecks: number
  quantity: number
}

const storageKey = 'chashka_coffee_cart_v1'
const changedEvent = 'coffee-cart:changed'

export function normalizeCartLines(value: unknown): CartLine[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((candidate): CartLine[] => {
    if (!candidate || typeof candidate !== 'object') return []
    const line = candidate as Partial<CartLine>
    if (
      typeof line.variantId !== 'string'
      || typeof line.productSlug !== 'string'
      || typeof line.productName !== 'string'
      || typeof line.variantLabel !== 'string'
      || !(typeof line.imageUrl === 'string' || line.imageUrl === null)
      || !Number.isInteger(line.unitPriceKopecks)
      || !Number.isInteger(line.quantity)
    ) return []
    return [{
      variantId: line.variantId,
      productSlug: line.productSlug,
      productName: line.productName,
      variantLabel: line.variantLabel,
      imageUrl: line.imageUrl,
      unitPriceKopecks: Math.max(0, line.unitPriceKopecks!),
      quantity: Math.min(20, Math.max(1, line.quantity!)),
    }]
  }).slice(0, 50)
}

export function getCart(): CartLine[] {
  if (typeof window === 'undefined') return []
  try { return normalizeCartLines(JSON.parse(localStorage.getItem(storageKey) ?? '[]')) }
  catch { return [] }
}

export function saveCart(lines: CartLine[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(storageKey, JSON.stringify(normalizeCartLines(lines)))
  document.dispatchEvent(new CustomEvent(changedEvent))
}

export function addCartItem(item: Omit<CartLine, 'quantity'>) {
  const lines = getCart()
  const existing = lines.find((line) => line.variantId === item.variantId)
  if (existing) existing.quantity = Math.min(20, existing.quantity + 1)
  else lines.push({ ...item, quantity: 1 })
  saveCart(lines)
}

export function updateCartQuantity(variantId: string, quantity: number) {
  if (quantity <= 0) return removeCartItem(variantId)
  saveCart(getCart().map((line) => line.variantId === variantId
    ? { ...line, quantity: Math.min(20, Math.max(1, quantity)) }
    : line))
}

export function removeCartItem(variantId: string) {
  saveCart(getCart().filter((line) => line.variantId !== variantId))
}

export function clearCart() { saveCart([]) }
export function cartItemCount(lines = getCart()) { return lines.reduce((sum, line) => sum + line.quantity, 0) }
export function cartTotal(lines = getCart()) { return lines.reduce((sum, line) => sum + line.unitPriceKopecks * line.quantity, 0) }
export function onCartChanged(listener: () => void) {
  document.addEventListener(changedEvent, listener)
  return () => document.removeEventListener(changedEvent, listener)
}
