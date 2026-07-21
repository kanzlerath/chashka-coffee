import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { jobOpeningListResponseSchema, jobOpeningResponseSchema, operationSuccessResponseSchema, upsertJobOpeningRequestSchema, type JobOpening, type UpsertJobOpeningRequest } from '@chashka-coffee/contracts'
import { Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { AdminField, AdminFormIntro, AdminPageHeader } from '@/components/admin'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/features/auth'
import { nullableDraftText } from '@/lib/form-drafts'
import { toPublicSlug } from '@/lib/slugify'

const empty: UpsertJobOpeningRequest = { slug: '', title: '', department: null, location: 'Новосибирск', employmentType: null, description: null, isPublished: false, position: 10 }
const toDraft = (opening: JobOpening): UpsertJobOpeningRequest => { const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...draft } = opening; return draft }

export function JobsPage({ mode = 'list', openingId }: { mode?: 'list' | 'create' | 'edit'; openingId?: string }) {
  const { api } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<UpsertJobOpeningRequest>(empty)
  const openings = useQuery({ queryKey: ['admin', 'jobs'], queryFn: () => api.request('/api/admin/jobs', jobOpeningListResponseSchema) })
  const selected = mode === 'edit' ? openings.data?.openings.find((opening) => opening.id === openingId) : undefined

  useEffect(() => {
    if (mode === 'create') setDraft({ ...empty })
    if (selected) setDraft(toDraft(selected))
  }, [mode, selected?.id])

  const save = useMutation({
    mutationFn: () => {
      const payload = upsertJobOpeningRequestSchema.parse({ ...draft, slug: draft.slug.trim() || toPublicSlug(draft.title) })
      return selected
        ? api.request(`/api/admin/jobs/${selected.id}`, jobOpeningResponseSchema, { method: 'PUT', body: payload })
        : api.request('/api/admin/jobs', jobOpeningResponseSchema, { method: 'POST', body: payload })
    },
    onSuccess: async ({ opening }) => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'jobs'] })
      await navigate({ to: '/jobs/$openingId', params: { openingId: opening.id } })
    },
  })
  const remove = useMutation({ mutationFn: () => api.request(`/api/admin/jobs/${selected!.id}`, operationSuccessResponseSchema, { method: 'DELETE' }), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['admin', 'jobs'] }); await navigate({ to: '/jobs' }) } })
  const change = <K extends keyof UpsertJobOpeningRequest>(key: K, value: UpsertJobOpeningRequest[K]) => setDraft((current) => ({ ...current, [key]: value }))

  if (mode === 'list') return <section className="admin-page">
    <AdminPageHeader eyebrow="Публикация" title="Вакансии" description="Позиции, которые посетители видят на сайте и по которым могут оставить отклик." actions={<Button asChild><Link to="/jobs/new">Добавить вакансию</Link></Button>} />
    <Card><CardHeader><CardTitle>Все вакансии</CardTitle><CardDescription>Каждая вакансия открывается на отдельной странице редактирования.</CardDescription></CardHeader><CardContent className="admin-directory-list">
      {openings.isPending ? <p className="admin-empty-state">Загружаем вакансии…</p> : null}
      {openings.data?.openings.map((opening) => <Link className="admin-directory-row admin-directory-row-simple" key={opening.id} to="/jobs/$openingId" params={{ openingId: opening.id }}>
        <span className="admin-directory-main"><strong>{opening.title}</strong><small>{[opening.department, opening.location, opening.employmentType].filter(Boolean).join(' · ') || 'Дополнительные сведения не заполнены'}</small></span>
        <span className={opening.isPublished ? 'admin-status-pill' : 'admin-status-pill admin-status-muted'}>{opening.isPublished ? 'На сайте' : 'Черновик'}</span>
        <span className="admin-row-action">Редактировать</span>
      </Link>)}
      {!openings.isPending && openings.data?.openings.length === 0 ? <p className="admin-empty-state">Вакансий пока нет.</p> : null}
      {openings.isError ? <p className="admin-state-message admin-state-error">Не удалось загрузить вакансии.</p> : null}
    </CardContent></Card>
  </section>

  if (mode === 'edit' && openings.isPending) return <section className="admin-page"><p className="admin-state-message">Загружаем вакансию…</p></section>
  if (mode === 'edit' && !selected) return <section className="admin-page"><AdminPageHeader eyebrow="Вакансии" title="Вакансия не найдена" description="Возможно, она была удалена или ссылка устарела." actions={<Button asChild variant="outline"><Link to="/jobs">К списку</Link></Button>} /></section>

  return <section className="admin-page admin-page-editor">
    <AdminPageHeader eyebrow="Вакансии" title={selected?.title ?? 'Новая вакансия'} description="Заполните понятное название, условия и описание. Публикацию можно включить после проверки текста." actions={<Button asChild variant="outline"><Link to="/jobs">К списку вакансий</Link></Button>} />
    <Card className="admin-editor-surface"><CardHeader><CardTitle>Информация о вакансии</CardTitle><CardDescription>Эти данные увидит кандидат на сайте.</CardDescription></CardHeader><CardContent>
      <form className="admin-form-stack" onSubmit={(event) => { event.preventDefault(); save.mutate() }}>
        <AdminFormIntro>Сначала заполните содержание, затем включите публикацию в конце формы.</AdminFormIntro>
        <AdminField label="Название вакансии" required hint="Например: Бариста в ресторан на Красном проспекте"><Input required placeholder="Бариста" value={draft.title} onChange={(event) => change('title', event.target.value)} /></AdminField>
        <div className="admin-form-grid-2"><AdminField label="Направление" hint="Отдел или команда, к которой относится позиция."><Input placeholder="Ресторанная команда" value={draft.department ?? ''} onChange={(event) => change('department', nullableDraftText(event.target.value))} /></AdminField><AdminField label="Город или ресторан"><Input placeholder="Новосибирск" value={draft.location ?? ''} onChange={(event) => change('location', nullableDraftText(event.target.value))} /></AdminField></div>
        <AdminField label="Тип занятости" hint="Например: полная занятость, сменный график."><Input placeholder="Полная занятость" value={draft.employmentType ?? ''} onChange={(event) => change('employmentType', nullableDraftText(event.target.value))} /></AdminField>
        <AdminField label="Описание" required hint="Расскажите о задачах, условиях, ожиданиях и способе отклика."><Textarea required className="min-h-56" placeholder="Что предстоит делать, кого мы ищем и что предлагаем…" value={draft.description ?? ''} onChange={(event) => change('description', nullableDraftText(event.target.value))} /></AdminField>
        <label className="admin-check-row"><input checked={draft.isPublished} type="checkbox" onChange={(event) => change('isPublished', event.target.checked)} /><span><strong>Показывать вакансию на сайте</strong><small>{draft.isPublished ? 'Вакансия доступна посетителям.' : 'Пока сохраняется как черновик.'}</small></span></label>
        <details className="admin-advanced-fields"><summary>Технические настройки</summary><div className="admin-form-grid-2 pt-4"><AdminField label="Адрес страницы" hint="Можно оставить пустым — создастся автоматически."><Input placeholder="barista" value={draft.slug} onChange={(event) => change('slug', event.target.value)} /></AdminField><AdminField label="Порядок в списке" hint="Меньшее число поднимает вакансию выше."><Input min={0} type="number" value={draft.position} onChange={(event) => change('position', Number(event.target.value))} /></AdminField></div></details>
        {save.isError ? <p className="admin-state-message admin-state-error">Не удалось сохранить вакансию. Проверьте обязательные поля.</p> : null}
        <div className="admin-form-actions"><Button disabled={save.isPending} size="lg" type="submit">{save.isPending ? 'Сохраняем…' : selected ? 'Сохранить изменения' : 'Создать вакансию'}</Button><Button asChild variant="outline"><Link to="/jobs">Отмена</Link></Button></div>
      </form>
    </CardContent></Card>
    {selected ? <Card className="admin-danger-zone"><CardHeader><CardTitle>Удаление вакансии</CardTitle><CardDescription>Вакансия сразу исчезнет с сайта и из списка админки.</CardDescription></CardHeader><CardContent><Button disabled={remove.isPending} variant="destructive" onClick={() => { if (window.confirm(`Удалить вакансию «${selected.title}»?`)) remove.mutate() }}>{remove.isPending ? 'Удаляем…' : 'Удалить вакансию'}</Button>{remove.isError ? <p className="admin-state-message admin-state-error">Не удалось удалить вакансию.</p> : null}</CardContent></Card> : null}
  </section>
}
