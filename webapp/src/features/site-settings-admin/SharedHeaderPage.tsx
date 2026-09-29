import { siteSettingsResponseSchema, upsertSiteSettingsRequestSchema, type SiteHeaderPreview } from '@chashka-coffee/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { AdminField, AdminPageHeader } from '@/components/admin'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Typography } from '@/components/ui/typography'
import { useAuth } from '@/features/auth'
import { AdminImageField } from '@/features/media-admin'

const defaultHeaderPreviews: SiteHeaderPreview[] = [
  { id: 'service-delivery', label: 'Доставка', href: '/delivery', imageUrl: '/images/home-hero-v1.png', imageAlt: 'Доставка из Чашки кофе' },
  { id: 'service-app', label: 'Приложение', href: '/app', imageUrl: '/images/home-morning-v2.png', imageAlt: 'Приложение Чашки кофе' },
  { id: 'occasion-bakery', label: 'Десерты', href: '/bakery', imageUrl: '/images/home-breakfast.png', imageAlt: 'Десерты Чашки кофе' },
  { id: 'occasion-banquets', label: 'Банкеты', href: '/banquets', imageUrl: '/images/restaurants-hero.png', imageAlt: 'Банкет в ресторане Чашка кофе' },
  { id: 'reading-journal', label: 'Журнал', href: '/journal', imageUrl: '/images/home-morning-v2.png', imageAlt: 'Журнал Чашки кофе' },
  { id: 'reading-promotions', label: 'Акции', href: '/promotions', imageUrl: '/images/home-breakfast.png', imageAlt: 'Акции Чашки кофе' },
  { id: 'company-about', label: 'О сети', href: '/about', imageUrl: '/images/restaurants-hero.png', imageAlt: 'Интерьер Чашки кофе' },
  { id: 'company-franchise', label: 'Франшиза', href: '/franchise', imageUrl: '/images/home-hero-v1.png', imageAlt: 'Франшиза Чашки кофе' },
]

const mergePreviews = (saved: SiteHeaderPreview[]) => defaultHeaderPreviews.map((fallback) => {
  const current = saved.find((item) => item.id === fallback.id)
  if (!current) return fallback
  return fallback.id === 'occasion-bakery' ? { ...current, label: fallback.label, href: fallback.href } : current
})

export function SharedHeaderPage() {
  const { api } = useAuth()
  const queryClient = useQueryClient()
  const settings = useQuery({ queryKey: ['admin', 'site-settings'], queryFn: () => api.request('/api/admin/site-settings', siteSettingsResponseSchema) })
  if (settings.isPending) return <section className="admin-page"><AdminPageHeader eyebrow="Общие блоки" title="Шапка и выпадающее меню" /><Typography className="admin-state-message" variant="bodySm">Загружаем настройки…</Typography></section>
  return <SharedHeaderForm initialPreviews={mergePreviews(settings.data?.settings.headerPreviews ?? [])} initialCoffeeOrdersEnabled={settings.data?.settings.coffeeOrdersEnabled ?? true} loadError={settings.isError} api={api} queryClient={queryClient} />
}

function SharedHeaderForm({ initialPreviews, initialCoffeeOrdersEnabled, loadError, api, queryClient }: { initialPreviews: SiteHeaderPreview[]; initialCoffeeOrdersEnabled: boolean; loadError: boolean; api: ReturnType<typeof useAuth>['api']; queryClient: ReturnType<typeof useQueryClient> }) {
  const [previews, setPreviews] = useState(initialPreviews)
  const [coffeeOrdersEnabled, setCoffeeOrdersEnabled] = useState(initialCoffeeOrdersEnabled)
  const save = useMutation({
    mutationFn: async () => {
      const latest = await api.request('/api/admin/site-settings', siteSettingsResponseSchema)
      return api.request('/api/admin/site-settings', siteSettingsResponseSchema, { method: 'PUT', body: upsertSiteSettingsRequestSchema.parse({ headerPreviews: previews, coffeeOrdersEnabled, contactCards: latest.settings.contactCards, footerContact: latest.settings.footerContact }) })
    },
    onSuccess: ({ settings: saved }) => { setPreviews(mergePreviews(saved.headerPreviews)); setCoffeeOrdersEnabled(saved.coffeeOrdersEnabled); void queryClient.invalidateQueries({ queryKey: ['admin', 'site-settings'] }) },
  })
  const update = (index: number, next: SiteHeaderPreview) => setPreviews((current) => current.map((item, itemIndex) => itemIndex === index ? next : item))

  return <section className="admin-page admin-content-workspace">
    <AdminPageHeader eyebrow="Общие блоки" title="Шапка и выпадающее меню" description="Эти фотографии видны на всех страницах сайта. Замена одного кадра не затрагивает другие места." />
    <Card className="admin-editor-surface"><CardHeader><CardTitle>Превью разделов</CardTitle><CardDescription>Фотографии сгруппированы так же, как в раскрывающемся меню сайта.</CardDescription></CardHeader><CardContent>
      <form className="admin-form-stack" onSubmit={(event) => { event.preventDefault(); save.mutate() }}>
        <section className="rounded-xl border border-border bg-muted/30 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="grid gap-1"><Typography variant="bodySmMedium">Онлайн-заказ кофе</Typography><Typography tone="muted" variant="bodySm">Когда выключен, корзина и добавление кофе в неё скрыты для всех посетителей. Уже открытые страницы и прямые запросы также не смогут создать или оплатить заказ.</Typography></div>
            <label className="flex shrink-0 cursor-pointer items-center gap-3"><Typography as="span" className="hidden sm:inline" variant="bodySmMedium">{coffeeOrdersEnabled ? 'Включён' : 'Выключен'}</Typography><Switch checked={coffeeOrdersEnabled} onCheckedChange={setCoffeeOrdersEnabled} /></label>
          </div>
        </section>
        <div className="admin-shared-preview-grid">{previews.map((preview, index) => <section className="admin-shared-preview" key={preview.id}>
          <header><Typography variant="caption" tone="muted">{index < 2 ? 'Сервис' : index < 4 ? 'Для повода' : index < 6 ? 'Читать и узнавать' : 'О компании'}</Typography><Typography variant="bodySmMedium">{preview.label}</Typography></header>
          <AdminImageField compact required value={preview.imageUrl} onChange={(imageUrl) => imageUrl && update(index, { ...preview, imageUrl })} />
          <AdminField label="Описание фотографии" hint="Нужно для скринридеров и случаев, когда изображение не загрузилось."><Input value={preview.imageAlt} onChange={(event) => update(index, { ...preview, imageAlt: event.target.value })} /></AdminField>
        </section>)}</div>
        {loadError || save.isError ? <Typography className="admin-state-message admin-state-error" variant="bodySm">Не удалось сохранить настройки шапки.</Typography> : null}
        <div className="admin-form-actions"><Button disabled={save.isPending} size="lg" type="submit">{save.isPending ? 'Сохраняем…' : 'Сохранить меню'}</Button></div>
      </form>
    </CardContent></Card>
  </section>
}
