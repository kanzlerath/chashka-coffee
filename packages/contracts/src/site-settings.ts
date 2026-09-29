import { z } from 'zod'

const imageUrlSchema = z.string().trim().min(1).max(2_048).refine((value) => value.startsWith('/') || /^https?:\/\//.test(value), 'Expected an absolute URL or a site-relative path')

export const siteHeaderPreviewSchema = z.object({
  id: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(80),
  href: z.string().trim().min(1).max(500),
  imageUrl: imageUrlSchema,
  imageAlt: z.string().trim().max(240),
}).strict()
export type SiteHeaderPreview = z.infer<typeof siteHeaderPreviewSchema>

const phoneSchema = z.string().trim().min(5).max(40).refine((value) => /^\+?[\d\s()–-]+$/.test(value) && value.replace(/\D/g, '').length >= 10, 'Введите полный номер телефона')

export const contactCardSchema = z.object({
  title: z.string().trim().min(1).max(80),
  phone: phoneSchema,
  email: z.email().max(254),
  hours: z.string().trim().min(1).max(100),
}).strict()
export type ContactCard = z.infer<typeof contactCardSchema>
export const footerContactSchema = z.object({ phone: phoneSchema, email: z.email().max(254) }).strict()
export type FooterContact = z.infer<typeof footerContactSchema>

export const defaultContactCards: ContactCard[] = [
  { title: 'Банкеты и события', phone: '+7 (383) 123-20-20', email: 'events@chashkacoffee.ru', hours: 'Ежедневно · 10:00–21:00' },
  { title: 'Десерты', phone: '+7 (383) 123-20-20', email: 'sbis-ivanov@denisivanov.ru', hours: 'Ежедневно · 09:00–21:00' },
  { title: 'Франшиза', phone: '+7 (383) 123-20-20', email: 'franchise@chashkacoffee.ru', hours: 'Пн–Пт · 09:00–18:00' },
  { title: 'Вакансии', phone: '+7 (383) 123-20-20', email: 'team@chashkacoffee.ru', hours: 'Пн–Пт · 10:00–18:00' },
]
export const defaultFooterContact: FooterContact = { phone: '+7 (383) 123–20–20', email: 'hello@chashkacoffee.ru' }

export const siteSettingsSchema = z.object({
  headerPreviews: z.array(siteHeaderPreviewSchema).max(16),
  coffeeOrdersEnabled: z.boolean().default(true),
  contactCards: z.array(contactCardSchema).min(1).max(12).default(defaultContactCards),
  footerContact: footerContactSchema.default(defaultFooterContact),
  updatedAt: z.string().datetime(),
})
export type SiteSettings = z.infer<typeof siteSettingsSchema>

export const upsertSiteSettingsRequestSchema = siteSettingsSchema.omit({ updatedAt: true }).strict()
export type UpsertSiteSettingsRequest = z.infer<typeof upsertSiteSettingsRequestSchema>
export const siteSettingsResponseSchema = z.object({ settings: siteSettingsSchema })
