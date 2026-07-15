import {
  adminRestaurantListResponseSchema,
  adminRestaurantResponseSchema,
  assignRestaurantMenuRequestSchema, restaurantMenuAssignmentResponseSchema,
  adminMenuListResponseSchema, adminMenuDetailResponseSchema, adminMenuResponseSchema, createdIdResponseSchema,
  upsertMenuRequestSchema, upsertMenuCategoryRequestSchema, upsertMenuItemRequestSchema,
  type UpsertMenuRequest, type UpsertMenuCategoryRequest, type UpsertMenuItemRequest,
  upsertRestaurantRequestSchema,
  type UpsertRestaurantRequest,
} from '@chashka-coffee/contracts'
import type { AuthApi } from '@/features/auth'

export class CatalogAdminApi {
  private readonly auth: Pick<AuthApi, 'request'>

  constructor(auth: Pick<AuthApi, 'request'>) {
    this.auth = auth
  }

  listRestaurants() {
    return this.auth.request('/api/admin/restaurants', adminRestaurantListResponseSchema)
  }

  createRestaurant(input: UpsertRestaurantRequest) {
    return this.auth.request('/api/admin/restaurants', adminRestaurantResponseSchema, {
      method: 'POST', body: upsertRestaurantRequestSchema.parse(input),
    })
  }

  updateRestaurant(id: string, input: UpsertRestaurantRequest) {
    return this.auth.request(`/api/admin/restaurants/${id}`, adminRestaurantResponseSchema, {
      method: 'PUT', body: upsertRestaurantRequestSchema.parse(input),
    })
  }

  assignRestaurantMenu(id: string, menuId: string | null) {
    return this.auth.request(`/api/admin/restaurants/${id}/menu`, restaurantMenuAssignmentResponseSchema, {
      method: 'PUT', body: assignRestaurantMenuRequestSchema.parse({ menuId }),
    })
  }

  listMenus() { return this.auth.request('/api/admin/menus', adminMenuListResponseSchema) }
  getMenu(id: string) { return this.auth.request(`/api/admin/menus/${id}/detail`, adminMenuDetailResponseSchema) }
  createMenu(input: UpsertMenuRequest) { return this.auth.request('/api/admin/menus', adminMenuResponseSchema, { method: 'POST', body: upsertMenuRequestSchema.parse(input) }) }
  createCategory(menuId: string, input: UpsertMenuCategoryRequest) { return this.auth.request(`/api/admin/menus/${menuId}/categories`, createdIdResponseSchema, { method: 'POST', body: upsertMenuCategoryRequestSchema.parse(input) }) }
  createItem(categoryId: string, input: UpsertMenuItemRequest) { return this.auth.request(`/api/admin/categories/${categoryId}/items`, createdIdResponseSchema, { method: 'POST', body: upsertMenuItemRequestSchema.parse(input) }) }
  updateItem(id: string, input: UpsertMenuItemRequest) { return this.auth.request(`/api/admin/items/${id}`, createdIdResponseSchema, { method: 'PUT', body: upsertMenuItemRequestSchema.parse(input) }) }
}
