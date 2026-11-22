import { seoPageListResponseSchema, seoPageResponseSchema, upsertSeoPageRequestSchema, type SeoPage } from '@chashka-coffee/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { AdminField, AdminPageHeader } from '@/components/admin'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/features/auth'

export function SeoPagesPage() {
  const api = useAuth().api
  const client = useQueryClient()
  const pages = useQuery({ queryKey: ['admin', 'seo'], queryFn: () => api.request('/api/admin/seo', seoPageListResponseSchema) })
  const save = useMutation({ mutationFn: (page: SeoPage) => api.request(`/api/admin/seo/${encodeURIComponent(page.key)}`, seoPageResponseSchema, { method: 'PUT', body: upsertSeoPageRequestSchema.parse(page) }), onSuccess: () => { void client.invalidateQueries({ queryKey: ['admin', 'seo'] }) } })
  if (pages.isPending) return <section className="admin-page"><AdminPageHeader eyebrow="Страницы" title="SEO страниц" /><p className="admin-state-message">Загружаем страницы…</p></section>
  if (pages.isError) return <section className="admin-page"><AdminPageHeader eyebrow="Страницы" title="SEO страниц" /><p className="admin-state-message admin-state-error">Не удалось загрузить страницы.</p></section>
  return <section className="admin-page"><AdminPageHeader eyebrow="Страницы" title="SEO страниц" description="Настройки применяются к поисковой выдаче и превью социальных сетей после пересборки публичного сайта." /><div className="admin-form-stack">{pages.data.pages.map((page) => <SeoCard key={page.key} page={page} saving={save.isPending} onSave={(next) => save.mutate(next)} />)}</div></section>
}

function SeoCard({ page, saving, onSave }: { page: SeoPage; saving: boolean; onSave: (page: SeoPage) => void }) {
  const [draft, setDraft] = useState(page)
  return <Card><CardHeader><CardTitle>{page.label}</CardTitle><p className="admin-field-hint">{page.path}</p></CardHeader><CardContent><form className="admin-form-stack" onSubmit={(event) => { event.preventDefault(); onSave(draft) }}><AdminField label="SEO title" hint="До 180 символов. Пусто — использовать заголовок страницы."><Input value={draft.title ?? ''} onChange={(e) => setDraft({ ...draft, title: e.target.value || null })} /></AdminField><AdminField label="SEO description" hint="Короткое описание для поисковой выдачи."><Textarea value={draft.description ?? ''} onChange={(e) => setDraft({ ...draft, description: e.target.value || null })} /></AdminField><AdminField label="Изображение для соцсетей"><Input value={draft.imageUrl ?? ''} placeholder="/images/…" onChange={(e) => setDraft({ ...draft, imageUrl: e.target.value || null })} /></AdminField><Button type="submit" disabled={saving}>{saving ? 'Сохраняем…' : 'Сохранить SEO'}</Button></form></CardContent></Card>
}
