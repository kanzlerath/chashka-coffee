import { defaultContactCards, defaultFooterContact, siteSettingsResponseSchema, upsertSiteSettingsRequestSchema, type ContactCard, type FooterContact, type SiteSettings } from '@chashka-coffee/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { AdminDraftRecovery, AdminField, AdminPageHeader } from '@/components/admin'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/features/auth'
import { useEditorDraft } from '@/hooks/use-editor-draft'

export function ContactsSettingsPage() {
  const { api } = useAuth()
  const queryClient = useQueryClient()
  const settings = useQuery({ queryKey: ['admin', 'site-settings'], queryFn: () => api.request('/api/admin/site-settings', siteSettingsResponseSchema) })
  if (settings.isPending) return <section className="admin-page"><AdminPageHeader eyebrow="Общие блоки" title="Контакты" /><p className="admin-state-message">Загружаем контакты…</p></section>
  if (settings.isError) return <section className="admin-page"><AdminPageHeader eyebrow="Общие блоки" title="Контакты" /><p className="admin-state-message admin-state-error">Не удалось загрузить контакты.</p></section>
  return <ContactsForm initial={settings.data.settings} api={api} queryClient={queryClient} />
}

function ContactsForm({ initial, api, queryClient }: { initial: SiteSettings; api: ReturnType<typeof useAuth>['api']; queryClient: ReturnType<typeof useQueryClient> }) {
  const editor = useEditorDraft({ key: 'site-contacts', initialValue: { cards: initial.contactCards ?? defaultContactCards, footer: initial.footerContact ?? defaultFooterContact }, sourceVersion: initial.updatedAt })
  const { draft, setDraft } = editor
  const { cards, footer } = draft
  const save = useMutation({
    mutationFn: async () => {
      const latest = await api.request('/api/admin/site-settings', siteSettingsResponseSchema)
      return api.request('/api/admin/site-settings', siteSettingsResponseSchema, { method: 'PUT', body: upsertSiteSettingsRequestSchema.parse({ headerPreviews: latest.settings.headerPreviews, coffeeOrdersEnabled: latest.settings.coffeeOrdersEnabled, contactCards: cards, footerContact: footer }) })
    },
    onSuccess: ({ settings }) => { const saved = { cards: settings.contactCards, footer: settings.footerContact }; editor.markSaved(saved); setDraft(saved); void queryClient.invalidateQueries({ queryKey: ['admin', 'site-settings'] }) },
  })
  const changeCard = (index: number, patch: Partial<ContactCard>) => setDraft((current) => ({ ...current, cards: current.cards.map((card, position) => position === index ? { ...card, ...patch } : card) }))
  const changeFooter = (patch: Partial<FooterContact>) => setDraft((current) => ({ ...current, footer: { ...current.footer, ...patch } }))

  return <section className="admin-page admin-content-workspace">
    <AdminPageHeader eyebrow="Общие блоки" title="Контакты" description="Данные для страницы контактов и подвала сайта. Изменения появятся после пересборки публичного сайта." />
    {editor.recovery && <AdminDraftRecovery savedAt={editor.recovery.savedAt} onRestore={editor.restore} onDiscard={editor.discardRecovery} />}
    <form className="admin-form-stack" onSubmit={(event) => { event.preventDefault(); save.mutate() }}>
      <Card><CardHeader><CardTitle>Страница контактов</CardTitle><CardDescription>Каждое направление показывается отдельным блоком. Телефон и почта становятся кликабельными ссылками.</CardDescription></CardHeader><CardContent className="admin-form-stack">
        {cards.map((card, index) => <section className="admin-form-subsection admin-form-stack" key={index}>
          <h3 className="admin-field-heading">Направление {index + 1}</h3>
          <AdminField label="Название" required><Input required maxLength={80} value={card.title} onChange={(event) => changeCard(index, { title: event.target.value })} /></AdminField>
          <AdminField label="Телефон" required><Input required type="tel" value={card.phone} onChange={(event) => changeCard(index, { phone: event.target.value })} /></AdminField>
          <AdminField label="Электронная почта" required><Input required type="email" value={card.email} onChange={(event) => changeCard(index, { email: event.target.value })} /></AdminField>
          <AdminField label="Часы работы" required><Input required maxLength={100} value={card.hours} onChange={(event) => changeCard(index, { hours: event.target.value })} /></AdminField>
          <Button type="button" variant="outline" disabled={cards.length === 1} onClick={() => setDraft((current) => ({ ...current, cards: current.cards.filter((_, position) => position !== index) }))}>Удалить направление</Button>
        </section>)}
        <Button type="button" variant="outline" disabled={cards.length >= 12} onClick={() => setDraft((current) => ({ ...current, cards: [...current.cards, { title: '', phone: '', email: '', hours: '' }] }))}>Добавить направление</Button>
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Контакты в подвале</CardTitle></CardHeader><CardContent className="admin-form-stack">
        <AdminField label="Телефон" required><Input required type="tel" value={footer.phone} onChange={(event) => changeFooter({ phone: event.target.value })} /></AdminField>
        <AdminField label="Электронная почта" required><Input required type="email" value={footer.email} onChange={(event) => changeFooter({ email: event.target.value })} /></AdminField>
      </CardContent></Card>
      {save.isError && <p className="admin-state-message admin-state-error">Не удалось сохранить контакты. Проверьте заполнение полей.</p>}
      <div className="admin-form-actions"><Button type="submit" disabled={save.isPending}>{save.isPending ? 'Сохраняем…' : 'Сохранить контакты'}</Button></div>
    </form>
  </section>
}
