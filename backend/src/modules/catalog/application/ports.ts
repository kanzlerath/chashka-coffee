import type {
  AdminRestaurant,
  AdminMenu,
  AdminMenuDetailResponse,
  RestaurantListQuery,
  RestaurantListResponse,
  RestaurantMenuResponse,
  UpsertRestaurantRequest,
  AssignRestaurantMenuRequest,
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
  assignRestaurantMenu(id: string, input: AssignRestaurantMenuRequest): Promise<string | null | undefined>
  listAdminMenus(): Promise<AdminMenu[]>
  createMenu(input: UpsertMenuRequest): Promise<AdminMenu>
  updateMenu(id: string, input: UpsertMenuRequest): Promise<AdminMenu | null>
  getAdminMenuDetail(id: string): Promise<AdminMenuDetailResponse | null>
  createCategory(menuId: string, input: UpsertMenuCategoryRequest): Promise<string | null>
  createItem(categoryId: string, input: UpsertMenuItemRequest): Promise<string | null>
  updateItem(id: string, input: UpsertMenuItemRequest): Promise<string | null>
}
