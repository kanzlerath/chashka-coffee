import type { ContentEntry } from '@chashka-coffee/contracts'

export const JOURNAL_PAGE_SIZE = 6

type PublicationDates = Pick<ContentEntry, 'startsAt' | 'createdAt'>

export function getPublicationDate(entry: PublicationDates) {
  return entry.startsAt ?? entry.createdAt
}

export function formatCardDate(value: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Novosibirsk',
  }).format(new Date(value))
}

export function formatPublicationDate(value: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Novosibirsk',
  }).format(new Date(value))
}

export function journalPageHref(page: number) {
  return page <= 1 ? '/journal' : `/journal/page/${page}`
}
