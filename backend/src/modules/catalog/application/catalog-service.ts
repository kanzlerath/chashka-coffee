import type { RestaurantListQuery, UpsertMenuCategoryRequest, UpsertMenuItemRequest, UpsertMenuRequest, UpsertRestaurantRequest } from '@chashka-coffee/contracts'

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

  listAdminMenus() { return this.repository.listAdminMenus() }
  createMenu(input: UpsertMenuRequest) { return this.repository.createMenu(input) }
  updateMenu(id: string, input: UpsertMenuRequest) { return this.repository.updateMenu(id, input) }
  getAdminMenuDetail(id: string) { return this.repository.getAdminMenuDetail(id) }
  createCategory(menuId: string, input: UpsertMenuCategoryRequest) { return this.repository.createCategory(menuId, input) }
  createItem(categoryId: string, input: UpsertMenuItemRequest) { return this.repository.createItem(categoryId, input) }
}
