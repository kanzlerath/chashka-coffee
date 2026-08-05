import type { ContentEntry, Product } from '@chashka-coffee/contracts'

export function createContentStaticPaths(entries: ContentEntry[]) {
  return entries.map((entry) => ({
    params: { slug: entry.slug },
    props: { entry },
  }))
}

export function createProductStaticPaths(products: Product[]) {
  return products.map((product) => ({
    params: { slug: product.slug },
    props: {
      product,
      related: products.filter((candidate) => candidate.slug !== product.slug),
    },
  }))
}
