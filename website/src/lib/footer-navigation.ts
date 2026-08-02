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
      { label: 'Кондитерская', href: '/bakery' },
      { label: 'Банкеты', href: '/banquets' },
      { label: 'Корпоративным клиентам', href: '/corporate' },
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
      { label: '+7 (383) 123–20–20', href: 'tel:+73831232020' },
      { label: 'hello@chashkacoffee.ru', href: 'mailto:hello@chashkacoffee.ru' },
      { label: 'Все контакты', href: '/contacts' },
    ],
  },
]

export const footerLegalLinks: FooterLink[] = [
  { label: 'Конфиденциальность', href: '/privacy' },
  { label: 'Согласие на обработку данных', href: '/consent' },
  { label: 'Условия использования', href: '/terms' },
  { label: 'Правила лояльности', href: '/loyalty-rules' },
  { label: 'Правила сертификатов', href: '/certificate-rules' },
  { label: 'Правила акций', href: '/promotion-rules' },
]
