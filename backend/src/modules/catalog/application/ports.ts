import type {
  AdminRestaurant,
  RestaurantListQuery,
  RestaurantListResponse,
  RestaurantMenuResponse,
  UpsertRestaurantRequest,
} from '@chashka-coffee/contracts'

export type CatalogRepository = {
  findRestaurants(query: RestaurantListQuery): Promise<RestaurantListResponse>
  findRestaurantMenu(slug: string): Promise<RestaurantMenuResponse | null>
  listAdminRestaurants(): Promise<AdminRestaurant[]>
  createRestaurant(input: UpsertRestaurantRequest): Promise<AdminRestaurant>
  updateRestaurant(id: string, input: UpsertRestaurantRequest): Promise<AdminRestaurant | null>
  deleteRestaurant(id: string): Promise<boolean>
}
