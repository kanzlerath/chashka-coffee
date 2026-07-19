export class CatalogConflictError extends Error {
  constructor(public readonly kind: 'restaurant_slug') {
    super(kind)
  }
}
