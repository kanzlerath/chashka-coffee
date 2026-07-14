import type {
  RestaurantListQuery,
  RestaurantListResponse,
  RestaurantMenuResponse,
} from '@chashka-coffee/contracts'

export type CatalogRepository = {
  findRestaurants(query: RestaurantListQuery): Promise<RestaurantListResponse>
  findRestaurantMenu(slug: string): Promise<RestaurantMenuResponse | null>
}
