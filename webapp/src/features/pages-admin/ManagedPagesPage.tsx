import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { managedPageKeySchema, managedPageListResponseSchema, managedPageResponseSchema, upsertManagedPageRequestSchema, type ManagedPageKey, type UpsertManagedPageRequest } from '@chashka-coffee/contracts'
import { Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { AdminField, AdminFormIntro, AdminPageHeader } from '@/components/admin'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { BlockEditor } from '@/features/content-admin'
import { useAuth } from '@/features/auth'

const labels: Record<ManagedPageKey, string> = { HOME: 'Главная', COFFEE: 'Кофе', RESTAURANTS: 'Рестораны', DELIVERY: 'Доставка', APP: 'Приложение', LOYALTY: 'Лояльность', CERTIFICATES: 'Сертификаты', BAKERY: 'Кондитерская', FRANCHISE: 'Франшиза', JOBS: 'Вакансии', CONTACTS: 'Контакты', ABOUT: 'О нас', BANQUETS: 'Банкеты', PROMOTIONS: 'Акции' }

export function ManagedPagesPage({ mode = 'list', pageKey }: { mode?: 'list' | 'edit'; pageKey?: string }) {
  const { api } = useAuth()
  const queryClient = useQueryClient()
  const parsedKey = pageKey ? managedPageKeySchema.safeParse(pageKey).data : undefined
  const [draft, setDraft] = useState<UpsertManagedPageRequest>({ key: parsedKey ?? 'ABOUT', title: labels[parsedKey ?? 'ABOUT'], blocks: [] })
  const pages = useQuery({ queryKey: ['admin', 'pages'], queryFn: () => api.request('/api/admin/pages', managedPageListResponseSchema) })
  const selected = parsedKey ? pages.data?.pages.find((item) => item.key === parsedKey) : undefined

  useEffect(() => {
    if (!parsedKey) return
    setDraft(selected ? { key: selected.key, title: selected.title, blocks: selected.blocks } : { key: parsedKey, title: labels[parsedKey], blocks: [] })
  }, [parsedKey, selected])

  const save = useMutation({
    mutationFn: () => api.request(`/api/admin/pages/${parsedKey}`, managedPageResponseSchema, { method: 'PUT', body: upsertManagedPageRequestSchema.parse(draft) }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'pages'] }),
  })

  if (mode === 'list') return <section className="admin-page admin-content-workspace">
    <AdminPageHeader eyebrow="Страницы" title="Содержание разделов" description="Выберите страницу, чтобы изменить её тексты, изображения и смысловые блоки." />
    <Card><CardHeader><CardTitle>Разделы сайта</CardTitle><CardDescription>Вёрстка страниц защищена от случайных изменений — здесь редактируется только содержание.</CardDescription></CardHeader><CardContent className="admin-directory-list">
      {managedPageKeySchema.options.map((key) => {
        const configured = pages.data?.pages.some((item) => item.key === key)
        return <Link className="admin-directory-row admin-directory-row-simple" key={key} to="/pages/$pageKey" params={{ pageKey: key }}>
          <span className="admin-directory-main"><strong>{labels[key]}</strong><small>{configured ? 'Есть индивидуальные настройки' : 'Сейчас используется базовое содержание'}</small></span>
          <span className={configured ? 'admin-status-pill' : 'admin-status-pill admin-status-muted'}>{configured ? 'Настроена' : 'Базовая'}</span>
          <span className="admin-row-action">Открыть</span>
        </Link>
      })}
      {pages.isError ? <p className="admin-state-message admin-state-error">Не удалось загрузить страницы.</p> : null}
    </CardContent></Card>
  </section>

  if (!parsedKey) return <section className="admin-page"><AdminPageHeader eyebrow="Страницы" title="Страница не найдена" description="Ссылка содержит неизвестный раздел." actions={<Button asChild variant="outline"><Link to="/pages">К списку страниц</Link></Button>} /></section>
  if (pages.isPending) return <section className="admin-page"><p className="admin-state-message">Загружаем страницу…</p></section>

  return <section className="admin-page admin-content-workspace admin-page-editor">
    <AdminPageHeader eyebrow="Страницы" title={labels[parsedKey]} description="Изменяйте блоки сверху вниз — в том же порядке они появляются на сайте." actions={<Button asChild variant="outline"><Link to="/pages">К списку страниц</Link></Button>} />
    <Card className="admin-editor-surface"><CardHeader><CardTitle>Содержание страницы</CardTitle><CardDescription>Скрытые блоки сохраняются в редакторе, но не показываются посетителям.</CardDescription></CardHeader><CardContent>
      <form className="admin-form-stack" onSubmit={(event) => { event.preventDefault(); save.mutate() }}>
        <AdminFormIntro>Название используется как главный заголовок. Каждый блок ниже можно включать, скрывать и переставлять.</AdminFormIntro>
        <AdminField label="Название страницы" required hint={`Например: ${labels[parsedKey]}`}><Input required value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} /></AdminField>
        <BlockEditor blocks={draft.blocks} onChange={(blocks) => setDraft((current) => ({ ...current, blocks }))} />
        {save.isError ? <p className="admin-state-message admin-state-error">Не удалось сохранить страницу. Проверьте обязательные поля блоков.</p> : null}
        <div className="admin-form-actions"><Button disabled={save.isPending} size="lg" type="submit">{save.isPending ? 'Сохраняем…' : 'Сохранить страницу'}</Button><Button asChild variant="outline"><Link to="/pages">Отмена</Link></Button></div>
      </form>
    </CardContent></Card>
  </section>
}
