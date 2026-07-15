import {
  adminRestaurantListResponseSchema,
  adminRestaurantResponseSchema,
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
}
