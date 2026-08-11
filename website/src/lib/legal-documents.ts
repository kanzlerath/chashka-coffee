export const LEGAL_EFFECTIVE_DATE = '11 августа 2026'
export const LEGAL_SUPPORT_EMAIL = 'support@chashkacoffee.ru'
export const PREMIUM_BONUS_OFFER_URL = 'https://cards.premiumbonus.su/DIB_Len21sibsib/public-offer-agreement'

export type LegalDocumentCategory = 'Основное' | 'Персональные данные' | 'Покупки и программы'

export type LegalDocumentEntry = {
  number: string
  title: string
  shortTitle: string
  href: string
  category: LegalDocumentCategory
  summary: string
  effectiveDate: string
}

export type LegalSection = {
  id: string
  heading: string
  paragraphs: string[]
  bullets?: string[]
  note?: string
  links?: Array<{ label: string; href: string; external?: boolean }>
}

export const legalDocuments: LegalDocumentEntry[] = [
  {
    number: '01',
    title: 'Сведения об организациях',
    shortTitle: 'Реквизиты',
    href: '/requisites',
    category: 'Основное',
    summary: 'Кто владеет сайтом, принимает заявки, продаёт кофе и исполняет заказы кондитерской.',
    effectiveDate: LEGAL_EFFECTIVE_DATE,
  },
  {
    number: '02',
    title: 'Условия использования сайта',
    shortTitle: 'Условия сайта',
    href: '/terms',
    category: 'Основное',
    summary: 'Правила работы публичного сайта, личного кабинета и внешних сервисов.',
    effectiveDate: LEGAL_EFFECTIVE_DATE,
  },
  {
    number: '03',
    title: 'Политика обработки персональных данных',
    shortTitle: 'Конфиденциальность',
    href: '/privacy',
    category: 'Персональные данные',
    summary: 'Какие данные получает сайт, зачем они нужны, кому передаются и как защищаются.',
    effectiveDate: LEGAL_EFFECTIVE_DATE,
  },
  {
    number: '04',
    title: 'Согласие на обработку персональных данных',
    shortTitle: 'Согласие на данные',
    href: '/consent',
    category: 'Персональные данные',
    summary: 'Отдельное согласие для заявок, обращений, откликов и других форм сайта.',
    effectiveDate: LEGAL_EFFECTIVE_DATE,
  },
  {
    number: '05',
    title: 'Согласие на рекламные сообщения',
    shortTitle: 'Рекламные сообщения',
    href: '/advertising-consent',
    category: 'Персональные данные',
    summary: 'Добровольное согласие на предложения по SMS, электронной почте и в других каналах.',
    effectiveDate: LEGAL_EFFECTIVE_DATE,
  },
  {
    number: '06',
    title: 'Использование cookies и аналитики',
    shortTitle: 'Cookies',
    href: '/cookies',
    category: 'Персональные данные',
    summary: 'Необходимое хранилище браузера, обезличенная статистика и Яндекс Метрика.',
    effectiveDate: LEGAL_EFFECTIVE_DATE,
  },
  {
    number: '07',
    title: 'Обращения по персональным данным',
    shortTitle: 'Удаление данных',
    href: '/data-request',
    category: 'Персональные данные',
    summary: 'Как запросить доступ, исправление, отзыв согласия, удаление профиля или данных.',
    effectiveDate: LEGAL_EFFECTIVE_DATE,
  },
  {
    number: '08',
    title: 'Публичная оферта интернет-магазина кофе',
    shortTitle: 'Оферта магазина',
    href: '/offer',
    category: 'Покупки и программы',
    summary: 'Оплата, самовывоз, отмена и возврат заказов зерна, дрипов и капсул.',
    effectiveDate: LEGAL_EFFECTIVE_DATE,
  },
  {
    number: '09',
    title: 'Условия программы лояльности',
    shortTitle: 'Лояльность',
    href: '/loyalty-rules',
    category: 'Покупки и программы',
    summary: 'Короткая навигация к условиям внешнего сервиса PremiumBonus.',
    effectiveDate: LEGAL_EFFECTIVE_DATE,
  },
  {
    number: '10',
    title: 'Правила подарочных сертификатов',
    shortTitle: 'Сертификаты',
    href: '/certificate-rules',
    category: 'Покупки и программы',
    summary: 'Бумажные и пластиковые сертификаты, частичное использование и возврат остатка.',
    effectiveDate: LEGAL_EFFECTIVE_DATE,
  },
  {
    number: '11',
    title: 'Общие правила акций',
    shortTitle: 'Акции',
    href: '/promotion-rules',
    category: 'Покупки и программы',
    summary: 'Как читать сроки, территорию и специальные условия каждого предложения.',
    effectiveDate: LEGAL_EFFECTIVE_DATE,
  },
]

export function getLegalDocument(href: string) {
  const document = legalDocuments.find((entry) => entry.href === href)
  if (!document) throw new Error(`Unknown legal document: ${href}`)
  return document
}
