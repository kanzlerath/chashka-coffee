import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { managedPageKeySchema, managedPageListResponseSchema, managedPageResponseSchema, upsertManagedPageRequestSchema, type ManagedPageKey, type UpsertManagedPageRequest } from '@chashka-coffee/contracts'
import { useEffect, useState } from 'react'

import { AdminPageHeader } from '@/components/admin'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { BlockEditor } from '@/features/content-admin'
import { useAuth } from '@/features/auth'

const labels: Record<ManagedPageKey, string> = { HOME: 'Главная', COFFEE: 'Кофе', RESTAURANTS: 'Рестораны', DELIVERY: 'Доставка', APP: 'Приложение', LOYALTY: 'Лояльность', CERTIFICATES: 'Сертификаты', BAKERY: 'Кондитерская', FRANCHISE: 'Франшиза', JOBS: 'Вакансии', CONTACTS: 'Контакты', ABOUT: 'О нас', BANQUETS: 'Банкеты', PROMOTIONS: 'Акции' }

export function ManagedPagesPage() {
  const { api } = useAuth(); const queryClient = useQueryClient(); const [key, setKey] = useState<ManagedPageKey>('ABOUT'); const [draft, setDraft] = useState<UpsertManagedPageRequest>({ key: 'ABOUT', title: labels.ABOUT, blocks: [] })
  const pages = useQuery({ queryKey: ['admin', 'pages'], queryFn: () => api.request('/api/admin/pages', managedPageListResponseSchema) })
  useEffect(() => { const page = pages.data?.pages.find((item) => item.key === key); setDraft(page ? { key: page.key, title: page.title, blocks: page.blocks } : { key, title: labels[key], blocks: [] }) }, [key, pages.data])
  const save = useMutation({ mutationFn: () => api.request(`/api/admin/pages/${key}`, managedPageResponseSchema, { method: 'PUT', body: upsertManagedPageRequestSchema.parse(draft) }), onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'pages'] }) })
  return <section className="admin-page admin-content-workspace">
    <AdminPageHeader eyebrow="Страницы" title="Смысловые блоки" description="Редактируйте тексты, изображения, галереи и призывы к действию, не меняя вёрстку сайта." />
    <div className="grid gap-6 lg:grid-cols-[minmax(15rem,.48fr)_minmax(0,1.52fr)]">
      <Card className="admin-resource-list"><CardHeader><CardTitle>Разделы сайта</CardTitle><CardDescription>Основная композиция фиксирована; здесь меняется содержимое.</CardDescription></CardHeader><CardContent className="grid gap-1">{managedPageKeySchema.options.map((pageKey) => <button className="admin-list-row" data-selected={key === pageKey || undefined} key={pageKey} type="button" onClick={() => setKey(pageKey)}><span><b>{labels[pageKey]}</b><small>{pages.data?.pages.some((item) => item.key === pageKey) ? 'Настроена' : 'Используется базовое содержимое'}</small></span></button>)}</CardContent></Card>
      <Card className="admin-editor-card"><CardHeader><CardTitle>{labels[key]}</CardTitle><CardDescription>Скрытые блоки остаются в редакторе, но не попадают на публичную страницу.</CardDescription></CardHeader><CardContent><form className="grid gap-5" onSubmit={(event) => { event.preventDefault(); save.mutate() }}><label className="grid gap-1.5 text-sm font-medium">Название страницы<Input required value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} /></label><BlockEditor blocks={draft.blocks} onChange={(blocks) => setDraft((current) => ({ ...current, blocks }))} />{save.isError ? <p className="text-sm text-destructive">Не удалось сохранить страницу. Проверьте обязательные поля блоков.</p> : null}<Button disabled={save.isPending} size="lg" type="submit">{save.isPending ? 'Сохраняем…' : 'Сохранить страницу'}</Button></form></CardContent></Card>
    </div>
  </section>
}
