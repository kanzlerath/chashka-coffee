import { z } from 'zod'

const uuidSchema = z.uuid()
const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)

export const restaurantFormatSchema = z.enum(['CITY', 'PARK', 'AIRPORT', 'APART_HOTEL'])
export type RestaurantFormat = z.infer<typeof restaurantFormatSchema>

export const restaurantAreaSchema = z.enum(['CITY', 'PARK', 'AIRPORT'])
export type RestaurantArea = z.infer<typeof restaurantAreaSchema>

export const dietaryMarkSchema = z.enum([
  'VEGETARIAN',
  'SPICY',
  'LACTOSE_FREE',
  'GLUTEN_FREE',
  'LIGHT',
])
export type DietaryMark = z.infer<typeof dietaryMarkSchema>

export const marketingBadgeSchema = z.enum(['NEW', 'HIT', 'SEASONAL', 'SPECIAL'])
export type MarketingBadge = z.infer<typeof marketingBadgeSchema>

export const restaurantSummarySchema = z.object({
  id: uuidSchema,
  slug: slugSchema,
  name: z.string().trim().min(1).max(180),
  format: restaurantFormatSchema,
  area: restaurantAreaSchema,
  isAtApartHotel: z.boolean(),
  city: z.string().trim().min(1).max(100),
  address: z.string().trim().min(1).max(300),
  phone: z.string().trim().min(1).max(40),
  openingHoursLabel: z.string().trim().min(1).max(180),
  coverImageUrl: z.url().nullable(),
})
export type RestaurantSummary = z.infer<typeof restaurantSummarySchema>

export const restaurantListQuerySchema = z.object({
  area: restaurantAreaSchema.optional(),
  apartHotel: z.enum(['true', 'false']).optional(),
})
export type RestaurantListQuery = z.infer<typeof restaurantListQuerySchema>

export const restaurantListResponseSchema = z.object({
  restaurants: z.array(restaurantSummarySchema),
})
export type RestaurantListResponse = z.infer<typeof restaurantListResponseSchema>

const nullableText = (max: number) => z.string().trim().max(max).nullable()
const nullableUrl = z.url().nullable()
const nullableTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable()

export const restaurantOpeningHoursEntrySchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  opensAt: nullableTime,
  closesAt: nullableTime,
  isClosed: z.boolean(),
}).strict()
export type RestaurantOpeningHoursEntry = z.infer<typeof restaurantOpeningHoursEntrySchema>

export const adminRestaurantSchema = z.object({
  id: uuidSchema,
  slug: slugSchema,
  name: z.string().trim().min(1).max(180),
  format: restaurantFormatSchema,
  area: restaurantAreaSchema,
  isAtApartHotel: z.boolean(),
  city: z.string().trim().min(1).max(100),
  address: z.string().trim().min(1).max(300),
  phone: z.string().trim().min(1).max(40),
  description: nullableText(4_000),
  coverImageUrl: nullableUrl,
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
  yandexMapsUrl: nullableUrl,
  twoGisUrl: nullableUrl,
  openingHours: z.array(restaurantOpeningHoursEntrySchema).max(7),
  menuId: uuidSchema.nullable(),
  menuName: z.string().trim().min(1).max(180).nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})
export type AdminRestaurant = z.infer<typeof adminRestaurantSchema>

export const upsertRestaurantRequestSchema = adminRestaurantSchema.omit({
  id: true,
  menuId: true,
  menuName: true,
  createdAt: true,
  updatedAt: true,
}).strict()
export type UpsertRestaurantRequest = z.infer<typeof upsertRestaurantRequestSchema>

export const adminRestaurantListResponseSchema = z.object({
  restaurants: z.array(adminRestaurantSchema),
})
export const adminRestaurantResponseSchema = z.object({ restaurant: adminRestaurantSchema })
export const assignRestaurantMenuRequestSchema = z.object({ menuId: uuidSchema.nullable() }).strict()
export type AssignRestaurantMenuRequest = z.infer<typeof assignRestaurantMenuRequestSchema>
export const restaurantMenuAssignmentResponseSchema = z.object({ menuId: uuidSchema.nullable() })
export const upsertRestaurantMenuItemOverrideRequestSchema = z.object({
  description: nullableText(1_000), ingredients: nullableText(2_000),
  weightGrams: z.number().int().positive().nullable(), priceKopecks: z.number().int().nonnegative().nullable(),
}).strict()
export type UpsertRestaurantMenuItemOverrideRequest = z.infer<typeof upsertRestaurantMenuItemOverrideRequestSchema>
export const adminRestaurantMenuDetailResponseSchema = z.object({
  menu: z.object({ id: uuidSchema, name: z.string().trim().min(1).max(180) }),
  categories: z.array(z.object({
    id: uuidSchema, name: z.string().trim().min(1).max(100),
    items: z.array(z.object({
      id: uuidSchema, name: z.string().trim().min(1).max(180),
      description: nullableText(1_000), ingredients: nullableText(2_000), weightGrams: z.number().int().positive().nullable(), priceKopecks: z.number().int().nonnegative(),
      overridden: z.boolean(),
    })),
  })),
})
export type AdminRestaurantMenuDetailResponse = z.infer<typeof adminRestaurantMenuDetailResponseSchema>
export const operationSuccessResponseSchema = z.object({ success: z.literal(true) })

export const adminMenuSchema = z.object({
  id: uuidSchema,
  slug: slugSchema,
  name: z.string().trim().min(1).max(180),
  description: nullableText(2_000),
  categoryCount: z.number().int().nonnegative(),
  restaurantCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})
export type AdminMenu = z.infer<typeof adminMenuSchema>
export const upsertMenuRequestSchema = adminMenuSchema.omit({ id: true, categoryCount: true, restaurantCount: true, createdAt: true, updatedAt: true }).strict()
export type UpsertMenuRequest = z.infer<typeof upsertMenuRequestSchema>
export const adminMenuListResponseSchema = z.object({ menus: z.array(adminMenuSchema) })
export const adminMenuResponseSchema = z.object({ menu: adminMenuSchema })
export const createdIdResponseSchema = z.object({ id: uuidSchema })

export const upsertMenuCategoryRequestSchema = z.object({
  slug: slugSchema,
  name: z.string().trim().min(1).max(100),
  position: z.number().int().nonnegative(),
}).strict()
export type UpsertMenuCategoryRequest = z.infer<typeof upsertMenuCategoryRequestSchema>

export const upsertMenuItemRequestSchema = z.object({
  slug: slugSchema,
  name: z.string().trim().min(1).max(180),
  description: nullableText(1_000),
  ingredients: nullableText(2_000),
  weightGrams: z.number().int().positive().nullable(),
  priceKopecks: z.number().int().nonnegative(),
  calories: z.number().int().nonnegative().nullable(),
  proteins: z.number().nonnegative().nullable(),
  fats: z.number().nonnegative().nullable(),
  carbohydrates: z.number().nonnegative().nullable(),
  isVegetarian: z.boolean(), isSpicy: z.boolean(), isLactoseFree: z.boolean(), isGlutenFree: z.boolean(), isLight: z.boolean(),
  marketingBadge: marketingBadgeSchema.nullable(), imageUrl: nullableUrl, position: z.number().int().nonnegative(),
}).strict()
export type UpsertMenuItemRequest = z.infer<typeof upsertMenuItemRequestSchema>

export const adminMenuDetailResponseSchema = z.object({
  menu: adminMenuSchema,
  categories: z.array(z.object({
    id: uuidSchema, slug: slugSchema, name: z.string().trim().min(1).max(100), position: z.number().int().nonnegative(),
    items: z.array(z.object({
      id: uuidSchema,
      slug: slugSchema,
      name: z.string().trim().min(1).max(180),
      description: nullableText(1_000),
      ingredients: nullableText(2_000),
      weightGrams: z.number().int().positive().nullable(),
      priceKopecks: z.number().int().nonnegative(),
      calories: z.number().int().nonnegative().nullable(),
      proteins: z.number().nonnegative().nullable(),
      fats: z.number().nonnegative().nullable(),
      carbohydrates: z.number().nonnegative().nullable(),
      isVegetarian: z.boolean(),
      isSpicy: z.boolean(),
      isLactoseFree: z.boolean(),
      isGlutenFree: z.boolean(),
      isLight: z.boolean(),
      marketingBadge: marketingBadgeSchema.nullable(),
      imageUrl: nullableUrl,
      position: z.number().int().nonnegative(),
    })),
  })),
})
export type AdminMenuDetailResponse = z.infer<typeof adminMenuDetailResponseSchema>

export const menuItemSchema = z.object({
  id: uuidSchema,
  slug: slugSchema,
  name: z.string().trim().min(1).max(180),
  description: z.string().trim().min(1).max(1000).nullable(),
  ingredients: z.string().trim().min(1).max(2000).nullable(),
  weightGrams: z.number().int().positive().nullable(),
  priceKopecks: z.number().int().nonnegative(),
  calories: z.number().int().nonnegative().nullable(),
  proteins: z.number().nonnegative().nullable(),
  fats: z.number().nonnegative().nullable(),
  carbohydrates: z.number().nonnegative().nullable(),
  allergens: z.array(z.string().trim().min(1).max(80)).max(20),
  dietaryMarks: z.array(dietaryMarkSchema).max(5),
  marketingBadge: marketingBadgeSchema.nullable(),
  imageUrl: z.url().nullable(),
})
export type MenuItem = z.infer<typeof menuItemSchema>

export const menuCategorySchema = z.object({
  id: uuidSchema,
  slug: slugSchema,
  name: z.string().trim().min(1).max(100),
  position: z.number().int().nonnegative(),
  items: z.array(menuItemSchema),
})
export type MenuCategory = z.infer<typeof menuCategorySchema>

export const restaurantMenuResponseSchema = z.object({
  restaurant: restaurantSummarySchema,
  menu: z.object({
    id: uuidSchema,
    slug: slugSchema,
    name: z.string().trim().min(1).max(180),
  }),
  categories: z.array(menuCategorySchema),
})
export type RestaurantMenuResponse = z.infer<typeof restaurantMenuResponseSchema>
