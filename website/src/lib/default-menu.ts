import type { RestaurantSummary } from '@chashka-coffee/contracts'

export const selectDefaultMenuRestaurant = (restaurants: RestaurantSummary[]) =>
  restaurants.find(({ hasMenu }) => hasMenu) ?? null
