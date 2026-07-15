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
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})
export type AdminRestaurant = z.infer<typeof adminRestaurantSchema>

export const upsertRestaurantRequestSchema = adminRestaurantSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).strict()
export type UpsertRestaurantRequest = z.infer<typeof upsertRestaurantRequestSchema>

export const adminRestaurantListResponseSchema = z.object({
  restaurants: z.array(adminRestaurantSchema),
})
export const adminRestaurantResponseSchema = z.object({ restaurant: adminRestaurantSchema })

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
