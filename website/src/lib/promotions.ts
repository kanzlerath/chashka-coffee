import type { ContentEntry } from '@chashka-coffee/contracts'

export type PromotionCardEntry = Pick<ContentEntry,
  'slug' | 'title' | 'excerpt' | 'imageUrl' | 'ctaLabel' | 'ctaUrl' | 'startsAt' | 'endsAt'
>

type PromotionActionInput = Pick<PromotionCardEntry, 'slug' | 'ctaLabel' | 'ctaUrl'>
type PromotionPeriodInput = Pick<PromotionCardEntry, 'startsAt' | 'endsAt'>

export function promotionAction(entry: PromotionActionInput) {
  const href = entry.ctaUrl ?? `/promotions/${entry.slug}`

  return {
    label: entry.ctaLabel ?? 'Подробнее',
    href,
    external: /^https?:\/\//i.test(href),
  }
}

export function promotionPeriodLabel(entry: PromotionPeriodInput) {
  const format = (value: string) => new Date(value).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    timeZone: 'Asia/Novosibirsk',
  })

  if (entry.startsAt && entry.endsAt) return `С ${format(entry.startsAt)} до ${format(entry.endsAt)}`
  if (entry.endsAt) return `До ${format(entry.endsAt)}`
  if (entry.startsAt) return `С ${format(entry.startsAt)}`
  return 'Актуальное предложение'
}
