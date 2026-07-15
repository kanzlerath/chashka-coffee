import type {
  AdminRestaurant,
  AdminMenu,
  AdminMenuDetailResponse,
  RestaurantListQuery,
  RestaurantListResponse,
  RestaurantMenuResponse,
  RestaurantDetail,
  UpsertRestaurantRequest,
  AssignRestaurantMenuRequest,
  AdminRestaurantMenuDetailResponse,
  UpsertRestaurantMenuItemOverrideRequest,
  UpsertMenuRequest,
  UpsertMenuCategoryRequest,
  UpsertMenuItemRequest,
  RestaurantScheduleException,
  UpsertRestaurantScheduleExceptionRequest,
} from '@chashka-coffee/contracts'

export type CatalogRepository = {
  findRestaurants(query: RestaurantListQuery): Promise<RestaurantListResponse>
  findRestaurantMenu(slug: string): Promise<RestaurantMenuResponse | null>
  findRestaurantDetail(slug: string): Promise<RestaurantDetail | null>
  listAdminRestaurants(): Promise<AdminRestaurant[]>
  createRestaurant(input: UpsertRestaurantRequest): Promise<AdminRestaurant>
  updateRestaurant(id: string, input: UpsertRestaurantRequest): Promise<AdminRestaurant | null>
  deleteRestaurant(id: string): Promise<boolean>
  assignRestaurantMenu(id: string, input: AssignRestaurantMenuRequest): Promise<string | null | undefined>
  getAdminRestaurantMenuDetail(id: string): Promise<AdminRestaurantMenuDetailResponse | null>
  upsertRestaurantMenuItemOverride(restaurantId: string, itemId: string, input: UpsertRestaurantMenuItemOverrideRequest): Promise<boolean>
  deleteRestaurantMenuItemOverride(restaurantId: string, itemId: string): Promise<boolean>
  listAdminMenus(): Promise<AdminMenu[]>
  createMenu(input: UpsertMenuRequest): Promise<AdminMenu>
  updateMenu(id: string, input: UpsertMenuRequest): Promise<AdminMenu | null>
  getAdminMenuDetail(id: string): Promise<AdminMenuDetailResponse | null>
  createCategory(menuId: string, input: UpsertMenuCategoryRequest): Promise<string | null>
  createItem(categoryId: string, input: UpsertMenuItemRequest): Promise<string | null>
  updateItem(id: string, input: UpsertMenuItemRequest): Promise<string | null>
  listRestaurantScheduleExceptions(restaurantId: string): Promise<RestaurantScheduleException[] | null>
  upsertRestaurantScheduleException(restaurantId: string, input: UpsertRestaurantScheduleExceptionRequest): Promise<RestaurantScheduleException | null>
  deleteRestaurantScheduleException(restaurantId: string, exceptionId: string): Promise<boolean>
}
