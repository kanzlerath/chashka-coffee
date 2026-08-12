import type { Product, ProductVariant } from '@chashka-coffee/contracts'

export function availableVariants(product: Pick<Product, 'variants'>): ProductVariant[] {
  const available = product.variants.filter((variant) => variant.isAvailable)
  return available.length ? available : product.variants
}

export function productFromPrice(product: Pick<Product, 'variants'>): number | null {
  const prices = availableVariants(product).map((variant) => variant.priceKopecks).filter((price) => price > 0)
  return prices.length ? Math.min(...prices) : null
}
