import type {
  DietaryMark,
  RestaurantListQuery,
  RestaurantListResponse,
  RestaurantMenuResponse,
  RestaurantSummary,
} from '@chashka-coffee/contracts'

import type { DbClient } from '../../../db'
import type { CatalogRepository } from '../application/ports'

function openingHoursLabel(openingHours: { dayOfWeek: number; opensAt: string | null; closesAt: string | null; isClosed: boolean }[]) {
  const weekday = openingHours.find((entry) => entry.dayOfWeek === 1) ?? openingHours[0]
  if (!weekday || weekday.isClosed || !weekday.opensAt || !weekday.closesAt) return 'Уточняйте часы работы'
  return `Пн–Вс: ${weekday.opensAt}–${weekday.closesAt}`
}

function toRestaurantSummary(restaurant: {
  id: string; slug: string; name: string; format: 'CITY' | 'PARK' | 'AIRPORT' | 'APART_HOTEL'; area: 'CITY' | 'PARK' | 'AIRPORT'; isAtApartHotel: boolean; city: string; address: string; phone: string; coverImageUrl: string | null; openingHours: { dayOfWeek: number; opensAt: string | null; closesAt: string | null; isClosed: boolean }[]
}): RestaurantSummary {
  return {
    id: restaurant.id,
    slug: restaurant.slug,
    name: restaurant.name,
    format: restaurant.format,
    area: restaurant.area,
    isAtApartHotel: restaurant.isAtApartHotel,
    city: restaurant.city,
    address: restaurant.address,
    phone: restaurant.phone,
    openingHoursLabel: openingHoursLabel(restaurant.openingHours),
    coverImageUrl: restaurant.coverImageUrl,
  }
}

function dietaryMarks(item: { isVegetarian: boolean; isSpicy: boolean; isLactoseFree: boolean; isGlutenFree: boolean; isLight: boolean }): DietaryMark[] {
  return [
    item.isVegetarian ? 'VEGETARIAN' : null,
    item.isSpicy ? 'SPICY' : null,
    item.isLactoseFree ? 'LACTOSE_FREE' : null,
    item.isGlutenFree ? 'GLUTEN_FREE' : null,
    item.isLight ? 'LIGHT' : null,
  ].filter((mark): mark is DietaryMark => mark !== null)
}

export function createPrismaCatalogRepository(db: DbClient): CatalogRepository {
  return {
    async findRestaurants(query: RestaurantListQuery): Promise<RestaurantListResponse> {
      const restaurants = await db.restaurant.findMany({
        where: {
          ...(query.area ? { area: query.area } : {}),
          ...(query.apartHotel ? { isAtApartHotel: query.apartHotel === 'true' } : {}),
        },
        include: { openingHours: true },
        orderBy: [{ area: 'asc' }, { name: 'asc' }],
      })

      return { restaurants: restaurants.map(toRestaurantSummary) }
    },

    async findRestaurantMenu(slug: string): Promise<RestaurantMenuResponse | null> {
      const restaurant = await db.restaurant.findUnique({
        where: { slug },
        include: {
          openingHours: true,
          menuItemOverrides: true,
          menuAssignments: {
            include: {
              menu: {
                include: {
                  categories: {
                    orderBy: { position: 'asc' },
                    include: {
                      items: {
                        orderBy: { position: 'asc' },
                        include: { allergens: { include: { allergen: true } } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      })
      const assignment = restaurant?.menuAssignments[0]
      if (!restaurant || !assignment) return null

      const overrides = new Map(restaurant.menuItemOverrides.map((override) => [override.menuItemId, override]))
      return {
        restaurant: toRestaurantSummary(restaurant),
        menu: { id: assignment.menu.id, slug: assignment.menu.slug, name: assignment.menu.name },
        categories: assignment.menu.categories.map((category) => ({
          id: category.id,
          slug: category.slug,
          name: category.name,
          position: category.position,
          items: category.items.map((item) => {
            const override = overrides.get(item.id)
            return {
              id: item.id,
              slug: item.slug,
              name: item.name,
              description: override?.description ?? item.description,
              ingredients: override?.ingredients ?? item.ingredients,
              weightGrams: override?.weightGrams ?? item.weightGrams,
              priceKopecks: override?.priceKopecks ?? item.priceKopecks,
              calories: item.calories,
              proteins: item.proteins === null ? null : Number(item.proteins),
              fats: item.fats === null ? null : Number(item.fats),
              carbohydrates: item.carbohydrates === null ? null : Number(item.carbohydrates),
              allergens: item.allergens.map(({ allergen }) => allergen.name),
              dietaryMarks: dietaryMarks(item),
              marketingBadge: item.marketingBadge,
              imageUrl: item.imageUrl,
            }
          }),
        })),
      }
    },
  }
}
