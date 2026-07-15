import type {
  AdminRestaurant,
  AdminMenu,
  RestaurantListQuery,
  RestaurantListResponse,
  RestaurantMenuResponse,
  UpsertRestaurantRequest,
  UpsertMenuRequest,
  UpsertMenuCategoryRequest,
  UpsertMenuItemRequest,
} from '@chashka-coffee/contracts'

export type CatalogRepository = {
  findRestaurants(query: RestaurantListQuery): Promise<RestaurantListResponse>
  findRestaurantMenu(slug: string): Promise<RestaurantMenuResponse | null>
  listAdminRestaurants(): Promise<AdminRestaurant[]>
  createRestaurant(input: UpsertRestaurantRequest): Promise<AdminRestaurant>
  updateRestaurant(id: string, input: UpsertRestaurantRequest): Promise<AdminRestaurant | null>
  deleteRestaurant(id: string): Promise<boolean>
  listAdminMenus(): Promise<AdminMenu[]>
  createMenu(input: UpsertMenuRequest): Promise<AdminMenu>
  updateMenu(id: string, input: UpsertMenuRequest): Promise<AdminMenu | null>
  createCategory(menuId: string, input: UpsertMenuCategoryRequest): Promise<string | null>
  createItem(categoryId: string, input: UpsertMenuItemRequest): Promise<string | null>
}
