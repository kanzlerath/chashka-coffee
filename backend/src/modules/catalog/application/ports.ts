import type {
  AdminRestaurant,
  AdminMenu,
  RestaurantListQuery,
  RestaurantListResponse,
  RestaurantMenuResponse,
  UpsertRestaurantRequest,
  UpsertMenuRequest,
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
}
