import 'dotenv/config'

import { createPrisma } from '../src/db'

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to seed the local database.')
}

const db = createPrisma(databaseUrl)

const menus = [
  'city-core',
  'city-signature',
  'apart-hotel',
  'park-central',
  'park-zaeltsovsky',
  'park-naberegnaya',
  'airport-domestic',
  'airport-international',
  'airport-arrivals',
] as const

type RestaurantSeed = {
  slug: string
  name: string
  format: 'CITY' | 'PARK' | 'AIRPORT' | 'APART_HOTEL'
  area: 'CITY' | 'PARK' | 'AIRPORT'
  city: string
  address: string
  phone: string
  menuSlug: (typeof menus)[number]
  isAtApartHotel?: boolean
}

type MenuItemSeed = {
  slug: string
  name: string
  description: string
  ingredients: string
  weightGrams: number
  priceKopecks: number
  calories: number
  proteins: number
  fats: number
  carbohydrates: number
  vegetarian?: boolean
  spicy?: boolean
  lactoseFree?: boolean
  glutenFree?: boolean
  light?: boolean
  badge?: 'NEW' | 'HIT' | 'SEASONAL' | 'SPECIAL'
  allergens: string[]
}

type MenuCategorySeed = {
  category: { slug: string; name: string; position: number }
  items: MenuItemSeed[]
}

const restaurants: RestaurantSeed[] = [
  { slug: 'krasny-prospekt', name: 'Чашка кофе — Красный проспект', format: 'CITY', area: 'CITY', city: 'Новосибирск', address: 'Красный проспект, 25', phone: '+7 (383) 123-20-20', menuSlug: 'city-core' },
  { slug: 'ulitsa-lenina', name: 'Чашка кофе — улица Ленина', format: 'CITY', area: 'CITY', city: 'Новосибирск', address: 'ул. Ленина, 12', phone: '+7 (383) 123-20-21', menuSlug: 'city-core' },
  { slug: 'akademgorodok', name: 'Чашка кофе — Академгородок', format: 'CITY', area: 'CITY', city: 'Новосибирск', address: 'проспект Академика Коптюга, 4', phone: '+7 (383) 123-20-22', menuSlug: 'city-core' },
  { slug: 'galereya-novosibirsk', name: 'Чашка кофе — Галерея Новосибирск', format: 'CITY', area: 'CITY', city: 'Новосибирск', address: 'ул. Гоголя, 13', phone: '+7 (383) 123-20-23', menuSlug: 'city-core' },
  { slug: 'rechnoy-vokzal', name: 'Чашка кофе — Речной вокзал', format: 'CITY', area: 'CITY', city: 'Новосибирск', address: 'ул. Большевистская, 12', phone: '+7 (383) 123-20-24', menuSlug: 'city-core' },
  { slug: 'ploshchad-lenina', name: 'Чашка кофе — площадь Ленина', format: 'CITY', area: 'CITY', city: 'Новосибирск', address: 'Красный проспект, 29', phone: '+7 (383) 123-20-25', menuSlug: 'city-signature' },
  { slug: 'vertical-apart-hotel', name: 'Чашка кофе — Vertical', format: 'APART_HOTEL', area: 'CITY', city: 'Новосибирск', address: 'ул. Советская, 8', phone: '+7 (383) 123-20-26', menuSlug: 'apart-hotel', isAtApartHotel: true },
  { slug: 'central-park', name: 'Чашка кофе — Центральный парк', format: 'PARK', area: 'PARK', city: 'Новосибирск', address: 'ул. Мичурина, 8', phone: '+7 (383) 123-20-27', menuSlug: 'park-central' },
  { slug: 'zaeltsovsky-park', name: 'Чашка кофе — Заельцовский парк', format: 'PARK', area: 'PARK', city: 'Новосибирск', address: 'ул. Парковая, 88', phone: '+7 (383) 123-20-28', menuSlug: 'park-zaeltsovsky' },
  { slug: 'mikhaylovskaya-naberegnaya', name: 'Чашка кофе — Михайловская набережная', format: 'PARK', area: 'PARK', city: 'Новосибирск', address: 'ул. Большевистская, 12Б', phone: '+7 (383) 123-20-29', menuSlug: 'park-naberegnaya' },
  { slug: 'tolmachevo-domestic', name: 'Чашка кофе — Толмачёво, вылеты по России', format: 'AIRPORT', area: 'AIRPORT', city: 'Обь', address: 'аэропорт Толмачёво, сектор A', phone: '+7 (383) 123-20-30', menuSlug: 'airport-domestic' },
  { slug: 'tolmachevo-international', name: 'Чашка кофе — Толмачёво, международные вылеты', format: 'AIRPORT', area: 'AIRPORT', city: 'Обь', address: 'аэропорт Толмачёво, сектор B', phone: '+7 (383) 123-20-31', menuSlug: 'airport-international' },
  { slug: 'tolmachevo-arrivals', name: 'Чашка кофе — Толмачёво, зал прилёта', format: 'AIRPORT', area: 'AIRPORT', city: 'Обь', address: 'аэропорт Толмачёво, зал прилёта', phone: '+7 (383) 123-20-32', menuSlug: 'airport-arrivals' },
]

const itemTemplates: MenuCategorySeed[] = [
  {
    category: { slug: 'breakfast', name: 'Завтраки', position: 10 },
    items: [
      { slug: 'avocado-toast', name: 'Тост с авокадо и яйцом пашот', description: 'Хрустящий хлеб, авокадо и яйцо пашот.', ingredients: 'Хлеб на закваске, авокадо, яйцо, лимонный сок.', weightGrams: 220, priceKopecks: 55000, calories: 520, proteins: 18, fats: 27, carbohydrates: 46, vegetarian: true, badge: 'NEW', allergens: ['egg', 'gluten'] },
      { slug: 'berry-oatmeal', name: 'Овсяная каша с ягодами', description: 'Овсянка на миндальном молоке со свежими ягодами.', ingredients: 'Овсяные хлопья, миндальное молоко, ягоды, мёд.', weightGrams: 300, priceKopecks: 42000, calories: 410, proteins: 10, fats: 14, carbohydrates: 61, vegetarian: true, badge: 'HIT', allergens: ['nuts'] },
      { slug: 'ricotta-syrniki', name: 'Сырники из рикотты', description: 'Подаём с ягодным соусом и сметаной.', ingredients: 'Рикотта, яйцо, рисовая мука, сметана.', weightGrams: 200, priceKopecks: 49000, calories: 560, proteins: 24, fats: 25, carbohydrates: 58, vegetarian: true, allergens: ['egg', 'milk'] },
    ],
  },
  {
    category: { slug: 'hot-dishes', name: 'Горячее', position: 20 },
    items: [
      { slug: 'shakshuka', name: 'Шакшука с томатами', description: 'Яйца, запечённые в пряном томатном соусе.', ingredients: 'Яйцо, томаты, болгарский перец, зелень.', weightGrams: 300, priceKopecks: 54000, calories: 470, proteins: 22, fats: 28, carbohydrates: 35, spicy: true, badge: 'HIT', allergens: ['egg'] },
      { slug: 'salmon-scramble', name: 'Скрэмбл с лососем', description: 'Нежный скрэмбл со слабосолёным лососем.', ingredients: 'Яйцо, лосось, сливки, зелёное масло.', weightGrams: 240, priceKopecks: 62000, calories: 620, proteins: 29, fats: 44, carbohydrates: 21, allergens: ['egg', 'fish', 'milk'] },
      { slug: 'green-omelette', name: 'Омлет с зеленью', description: 'Омлет со шпинатом, брокколи и зеленью.', ingredients: 'Яйцо, шпинат, брокколи, томаты черри.', weightGrams: 240, priceKopecks: 45000, calories: 420, proteins: 26, fats: 24, carbohydrates: 20, vegetarian: true, light: true, allergens: ['egg'] },
    ],
  },
  {
    category: { slug: 'coffee', name: 'Кофе', position: 30 },
    items: [
      { slug: 'cappuccino', name: 'Капучино', description: 'Эспрессо и воздушное молоко.', ingredients: 'Кофе, молоко.', weightGrams: 300, priceKopecks: 29000, calories: 140, proteins: 7, fats: 7, carbohydrates: 11, vegetarian: true, allergens: ['milk'] },
      { slug: 'filter-coffee', name: 'Фильтр-кофе', description: 'Сезонное зерно собственной обжарки.', ingredients: 'Кофе, вода.', weightGrams: 300, priceKopecks: 24000, calories: 4, proteins: 0, fats: 0, carbohydrates: 0, vegetarian: true, lactoseFree: true, glutenFree: true, light: true, allergens: [] },
      { slug: 'cocoa', name: 'Какао', description: 'Насыщенный какао-напиток на молоке.', ingredients: 'Какао, молоко, шоколад.', weightGrams: 300, priceKopecks: 33000, calories: 260, proteins: 10, fats: 12, carbohydrates: 28, vegetarian: true, allergens: ['milk'] },
    ],
  },
]

const openingHours = [
  { dayOfWeek: 0, opensAt: '08:00', closesAt: '22:00' },
  { dayOfWeek: 1, opensAt: '07:30', closesAt: '22:00' },
  { dayOfWeek: 2, opensAt: '07:30', closesAt: '22:00' },
  { dayOfWeek: 3, opensAt: '07:30', closesAt: '22:00' },
  { dayOfWeek: 4, opensAt: '07:30', closesAt: '22:00' },
  { dayOfWeek: 5, opensAt: '07:30', closesAt: '23:00' },
  { dayOfWeek: 6, opensAt: '08:00', closesAt: '23:00' },
]

async function resetCatalog() {
  await db.homepageDayPart.deleteMany()
  await db.homepageDaySection.deleteMany()
  await db.homepageBestseller.deleteMany()
  await db.homepageSlide.deleteMany()
  await db.menuItemOverride.deleteMany()
  await db.restaurantOpeningHours.deleteMany()
  await db.restaurantScheduleException.deleteMany()
  await db.restaurantMenu.deleteMany()
  await db.menuItemAllergen.deleteMany()
  await db.menuItem.deleteMany()
  await db.menuCategory.deleteMany()
  await db.menu.deleteMany()
  await db.allergen.deleteMany()
  await db.restaurant.deleteMany()
}

async function seed() {
  await resetCatalog()

  await db.allergen.createMany({
    data: [
      { slug: 'egg', name: 'Яйцо' },
      { slug: 'fish', name: 'Рыба' },
      { slug: 'gluten', name: 'Глютен' },
      { slug: 'milk', name: 'Молоко' },
      { slug: 'nuts', name: 'Орехи' },
    ],
  })

  for (const [menuIndex, menuSlug] of menus.entries()) {
    await db.menu.create({
      data: {
        slug: menuSlug,
        name: menuSlug.replaceAll('-', ' '),
        categories: {
          create: itemTemplates.map(({ category, items }) => ({
            ...category,
            items: {
              create: items.map((item, itemIndex) => ({
                slug: item.slug,
                name: item.name,
                description: item.description,
                ingredients: item.ingredients,
                weightGrams: item.weightGrams,
                priceKopecks: item.priceKopecks + menuIndex * 1000,
                calories: item.calories,
                proteins: item.proteins,
                fats: item.fats,
                carbohydrates: item.carbohydrates,
                isVegetarian: item.vegetarian ?? false,
                isSpicy: item.spicy ?? false,
                isLactoseFree: item.lactoseFree ?? false,
                isGlutenFree: item.glutenFree ?? false,
                isLight: item.light ?? false,
                marketingBadge: item.badge,
                position: (itemIndex + 1) * 10,
                allergens: {
                  create: item.allergens.map((slug) => ({ allergen: { connect: { slug } } })),
                },
              })),
            },
          })),
        },
      },
    })
  }

  for (const restaurant of restaurants) {
    const createdRestaurant = await db.restaurant.create({
      data: {
        slug: restaurant.slug,
        name: restaurant.name,
        format: restaurant.format,
        area: restaurant.area,
        isAtApartHotel: restaurant.isAtApartHotel ?? false,
        city: restaurant.city,
        address: restaurant.address,
        phone: restaurant.phone,
        description: 'Тестовая запись для локальной разработки сайта «Чашка кофе».',
        openingHours: { createMany: { data: openingHours } },
        menuAssignments: { create: { menu: { connect: { slug: restaurant.menuSlug } } } },
      },
    })

    if (restaurant.slug === 'krasny-prospekt') {
      const toast = await db.menuItem.findFirstOrThrow({
        where: { slug: 'avocado-toast', category: { menu: { slug: restaurant.menuSlug } } },
      })

      await db.menuItemOverride.create({
        data: {
          restaurantId: createdRestaurant.id,
          menuItemId: toast.id,
          priceKopecks: 59000,
          description: 'Тост с авокадо и яйцом пашот — специальная подача на Красном проспекте.',
        },
      })
    }
  }

  const homepageItems = await db.menuItem.findMany({
    where: {
      category: { menu: { slug: 'city-core' } },
      slug: { in: ['avocado-toast', 'cappuccino', 'ricotta-syrniki', 'filter-coffee'] },
    },
  })
  const homepageItemsBySlug = new Map(homepageItems.map((item) => [item.slug, item.id]))

  await db.homepageSlide.createMany({
    data: [
      {
        mediaType: 'IMAGE',
        mediaUrl: '/images/home-morning-v2.png',
        eyebrow: 'С хорошего кофе',
        title: 'Начните день\nв своём ритме',
        description: 'Завтрак, любимый кофе и немного времени для себя.',
        ctaLabel: 'Открыть меню',
        ctaUrl: '/restaurants/krasny-prospekt/menu',
        durationSeconds: 7,
        isPublished: true,
        position: 10,
      },
      {
        mediaType: 'IMAGE',
        mediaUrl: '/images/home-breakfast.png',
        eyebrow: 'В каждом районе',
        title: 'Место, куда\nхочется зайти',
        description: 'Встретиться, поработать или просто сделать паузу.',
        ctaLabel: 'Найти кофейню',
        ctaUrl: '/restaurants',
        durationSeconds: 7,
        isPublished: true,
        position: 20,
      },
      {
        mediaType: 'IMAGE',
        mediaUrl: '/images/restaurants-hero.png',
        eyebrow: 'Любимое — ближе',
        title: 'Кофе и еда\nс доставкой',
        description: 'Привезём из ближайшей «Чашки кофе» бережно и вовремя.',
        ctaLabel: 'Заказать доставку',
        ctaUrl: '/delivery',
        durationSeconds: 7,
        isPublished: true,
        position: 30,
      },
    ],
  })

  const homepageBestsellerSeeds = [
    { slug: 'avocado-toast', badge: 'Хит', position: 10 },
    { slug: 'cappuccino', badge: 'Классика', position: 20 },
    { slug: 'ricotta-syrniki', badge: 'Любимое', position: 30 },
    { slug: 'filter-coffee', badge: 'Новинка', position: 40 },
  ]

  await db.homepageBestseller.createMany({
    data: homepageBestsellerSeeds.flatMap(({ slug, badge, position }) => {
      const menuItemId = homepageItemsBySlug.get(slug)
      return menuItemId ? [{ menuItemId, badge, position, isPublished: true }] : []
    }),
  })

  await db.homepageDaySection.create({
    data: {
      title: 'Поводы\nзайти сегодня',
      description: 'Сначала завтрак, потом встреча, а вечером — время для себя. Выбирайте свой ритм.',
      isPublished: true,
      parts: {
        create: [
          { label: 'Утро', title: 'Завтраки\nдо 12:00', description: 'Медленные утра и кофе, который не нужно торопить.', ctaUrl: '/restaurants/krasny-prospekt/menu', position: 10, isPublished: true },
          { label: 'Днём', title: 'Встречи\nв городе', description: 'Ресторан рядом, когда нужно место для своих людей.', ctaUrl: '/restaurants', position: 20, isPublished: true },
          { label: 'Вечером', title: 'События\nи музыка', description: 'Поводы задержаться дольше обычного.', ctaUrl: '/events', position: 30, isPublished: true },
        ],
      },
    },
  })

  const [restaurantCount, menuCount, itemCount] = await Promise.all([
    db.restaurant.count(),
    db.menu.count(),
    db.menuItem.count(),
  ])

  console.log(`Seeded ${restaurantCount} restaurants, ${menuCount} menus, ${itemCount} menu items.`)
}

try {
  await seed()
} finally {
  await db.$disconnect()
}
