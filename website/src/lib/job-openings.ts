import type { JobOpening, JobOpeningRestaurant } from '@chashka-coffee/contracts'

export type JobOpeningCard = {
  slug: string
  title: string
  place: string
  terms: string
  description: string
  restaurant: JobOpeningRestaurant | null
}

type PublicJobOpening = Pick<JobOpening, 'slug' | 'title' | 'department' | 'location' | 'employmentType' | 'description' | 'restaurant'>

const genericDescription = 'Условия и задачи уточнит рекрутер. Оставьте отклик — свяжемся и расскажем о графике, оплате и формате работы.'

export const normalizeJobOpening = (opening: PublicJobOpening): JobOpeningCard => ({
  slug: opening.slug,
  title: opening.title,
  place: opening.restaurant ? `${opening.restaurant.name} · ${opening.restaurant.address}` : [opening.department, opening.location].filter(Boolean).join(' · ') || 'Чашка кофе',
  terms: opening.employmentType || 'Условия обсуждаются',
  description: opening.description?.trim() || genericDescription,
  restaurant: opening.restaurant,
})

export const fallbackJobOpenings: JobOpeningCard[] = [
  {
    slug: 'barista',
    title: 'Бариста',
    place: 'Чашка кофе · Красный проспект, 25',
    terms: 'от 45 000 ₽',
    description: 'Готовить напитки по рецептурам, помогать гостям выбирать кофе и поддерживать порядок на станции.\n\nСменный график, питание на смене, обучение с наставником. Опыт не обязателен.',
    restaurant: { id: 'fallback-krasny-prospekt', name: 'Чашка кофе', address: 'Красный проспект, 25' },
  },
  {
    slug: 'manager',
    title: 'Менеджер зала',
    place: 'Красный проспект',
    terms: 'от 55 000 ₽',
    description: 'Организовывать смену, помогать команде в зале и решать вопросы гостей.\n\nНужен опыт в гостеприимстве. График, оплата, питание и обучение — на встрече с управляющим.',
    restaurant: { id: 'fallback-krasny-prospekt', name: 'Чашка кофе', address: 'Красный проспект, 25' },
  },
  {
    slug: 'pastry-chef',
    title: 'Кондитер',
    place: 'Собственное производство',
    terms: 'по итогам встречи',
    description: 'Готовить торты и десерты по технологическим картам, работать с заготовками и соблюдать чистоту процессов.\n\nОборудованный цех, поддержка шеф-кондитера. Опыт приветствуется; график и оплату обсудим лично.',
    restaurant: null,
  },
]
