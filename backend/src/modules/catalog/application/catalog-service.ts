import type { RestaurantListQuery } from '@chashka-coffee/contracts'

import type { CatalogRepository } from './ports'

export class CatalogService {
  constructor(private readonly repository: CatalogRepository) {}

  listRestaurants(query: RestaurantListQuery) {
    return this.repository.findRestaurants(query)
  }

  getRestaurantMenu(slug: string) {
    return this.repository.findRestaurantMenu(slug)
  }
}
