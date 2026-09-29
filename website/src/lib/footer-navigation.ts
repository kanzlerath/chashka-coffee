export type FooterLink = {
  label: string
  href: string
  external?: true
}

export type FooterGroup = {
  title: string
  links: FooterLink[]
}

export const CATERING_URL = 'https://catering-denisivanov.ru/'

export const footerGroups: FooterGroup[] = [
  {
    title: 'Гостям',
    links: [
      { label: 'Рестораны', href: '/restaurants' },
      { label: 'Меню', href: '/menu' },
      { label: 'Доставка', href: '/delivery' },
      { label: 'Приложение', href: '/app' },
      { label: 'Программа лояльности', href: '/loyalty' },
      { label: 'Сертификаты', href: '/certificates' },
    ],
  },
  {
    title: 'Для повода',
    links: [
      { label: 'Кофе для дома', href: '/coffee' },
      { label: 'Десерты', href: '/bakery' },
      { label: 'Банкеты', href: '/banquets' },
      { label: 'Кейтеринг', href: CATERING_URL, external: true },
    ],
  },
  {
    title: 'Узнать больше',
    links: [
      { label: 'Акции', href: '/promotions' },
      { label: 'События', href: '/events' },
      { label: 'Журнал', href: '/journal' },
      { label: 'О нас', href: '/about' },
      { label: 'Франшиза', href: '/franchise' },
      { label: 'Вакансии', href: '/jobs' },
    ],
  },
  {
    title: 'На связи',
    links: [
      { label: defaultFooterContact.phone, href: `tel:${defaultFooterContact.phone.replace(/[^+\d]/g, '')}` },
      { label: defaultFooterContact.email, href: `mailto:${defaultFooterContact.email}` },
      { label: 'Все контакты', href: '/contacts' },
    ],
  },
]

export const footerLegalLinks: FooterLink[] = [
  { label: 'Все документы', href: '/legal' },
  { label: 'Реквизиты', href: '/requisites' },
  { label: 'Конфиденциальность', href: '/privacy' },
  { label: 'Согласие на обработку данных', href: '/consent' },
  { label: 'Согласие на рекламу', href: '/advertising-consent' },
  { label: 'Cookies и аналитика', href: '/cookies' },
  { label: 'Обращения по данным', href: '/data-request' },
  { label: 'Условия использования', href: '/terms' },
  { label: 'Оферта магазина', href: '/offer' },
  { label: 'Правила лояльности', href: '/loyalty-rules' },
  { label: 'Правила сертификатов', href: '/certificate-rules' },
  { label: 'Правила акций', href: '/promotion-rules' },
]
import { defaultFooterContact } from '@chashka-coffee/contracts'
