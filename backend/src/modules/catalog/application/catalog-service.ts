import type { RestaurantListQuery, UpsertRestaurantRequest } from '@chashka-coffee/contracts'

import type { CatalogRepository } from './ports'

export class CatalogService {
  constructor(private readonly repository: CatalogRepository) {}

  listRestaurants(query: RestaurantListQuery) {
    return this.repository.findRestaurants(query)
  }

  getRestaurantMenu(slug: string) {
    return this.repository.findRestaurantMenu(slug)
  }

  listAdminRestaurants() {
    return this.repository.listAdminRestaurants()
  }

  createRestaurant(input: UpsertRestaurantRequest) {
    return this.repository.createRestaurant(input)
  }

  updateRestaurant(id: string, input: UpsertRestaurantRequest) {
    return this.repository.updateRestaurant(id, input)
  }

  deleteRestaurant(id: string) {
    return this.repository.deleteRestaurant(id)
  }
}
