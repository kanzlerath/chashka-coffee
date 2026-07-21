import {
  createStaffUserRequestSchema,
  staffUserDeleteResponseSchema,
  staffUserListResponseSchema,
  staffUserResponseSchema,
  updateStaffUserRequestSchema,
  type UserDto,
  type UserRole,
} from '@chashka-coffee/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { AdminField, AdminFormIntro, AdminPageHeader } from '@/components/admin'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/features/auth'

type TeamPageProps = { mode?: 'list' | 'create' | 'edit'; userId?: string }
type StaffDraft = { displayName: string; email: string; password: string; role: UserRole }
const emptyDraft: StaffDraft = { displayName: '', email: '', password: '', role: 'EDITOR' }

export function TeamPage({ mode = 'list', userId }: TeamPageProps) {
  if (mode === 'list') return <TeamList />
  return <StaffEditor mode={mode} userId={userId} />
}

function useStaff() {
  const { api } = useAuth()
  return useQuery({ queryKey: ['admin', 'staff'], queryFn: () => api.request('/api/admin/users', staffUserListResponseSchema) })
}

function TeamList() {
  const { user: currentUser } = useAuth()
  const staff = useStaff()

  return (
    <section className="admin-page">
      <AdminPageHeader
        eyebrow="Настройки"
        title="Команда и доступы"
        description="Добавляйте сотрудников, меняйте роли и закрывайте доступ. Регистрации на сайте нет: учётную запись создаёт только администратор."
        actions={<Button asChild><Link to="/team/new">Добавить сотрудника</Link></Button>}
      />
      <Card>
        <CardHeader><CardTitle>Сотрудники</CardTitle><CardDescription>{staff.data ? `${staff.data.users.length} учётных записей` : 'Загружаем список…'}</CardDescription></CardHeader>
        <CardContent className="admin-directory-list">
          {staff.data?.users.map((user) => (
            <Link className="admin-directory-row" key={user.id} params={{ userId: user.id }} to="/team/$userId">
              <span className="admin-person-avatar">{initials(user)}</span>
              <span><strong>{user.displayName ?? 'Имя не указано'}</strong><small>{user.email}</small></span>
              <span className="admin-role-badge">{user.role === 'ADMIN' ? 'Администратор' : 'Редактор'}</span>
              {currentUser?.id === user.id ? <small className="admin-current-user">Это вы</small> : null}
            </Link>
          ))}
          {staff.isError ? <p className="admin-state-message admin-state-error">Не удалось загрузить сотрудников.</p> : null}
        </CardContent>
      </Card>
      <div className="admin-help-note"><strong>Как выбрать роль?</strong><p>Редактор работает с ресторанами и меню. Администратор дополнительно управляет публикациями, заявками, сотрудниками и настройками сайта.</p></div>
    </section>
  )
}

function StaffEditor({ mode, userId }: Required<Pick<TeamPageProps, 'mode'>> & { userId?: string }) {
  const { api, user: currentUser } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const staff = useStaff()
  const selected = staff.data?.users.find((user) => user.id === userId)
  const [draft, setDraft] = useState<StaffDraft>(emptyDraft)

  useEffect(() => {
    if (mode === 'edit' && selected) {
      setDraft({ displayName: selected.displayName ?? '', email: selected.email, password: '', role: selected.role })
    }
  }, [mode, selected])

  const save = useMutation({
    mutationFn: () => mode === 'create'
      ? api.request('/api/admin/users', staffUserResponseSchema, { method: 'POST', body: createStaffUserRequestSchema.parse({ ...draft, displayName: draft.displayName || undefined }) })
      : api.request(`/api/admin/users/${userId}`, staffUserResponseSchema, { method: 'PUT', body: updateStaffUserRequestSchema.parse({ ...draft, displayName: draft.displayName || null }) }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'staff'] })
      if (currentUser?.id === userId) {
        await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] })
      }
      await navigate({ to: '/team' })
    },
  })
  const remove = useMutation({
    mutationFn: () => api.request(`/api/admin/users/${userId}`, staffUserDeleteResponseSchema, { method: 'DELETE' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'staff'] })
      await navigate({ to: '/team' })
    },
  })

  if (mode === 'edit' && staff.isPending) return <section className="admin-page"><p className="admin-state-message">Загружаем сотрудника…</p></section>
  if (mode === 'edit' && !selected) return <section className="admin-page"><AdminPageHeader eyebrow="Команда" title="Сотрудник не найден" description="Возможно, доступ уже был удалён." actions={<Button asChild variant="outline"><Link to="/team">Вернуться к команде</Link></Button>} /></section>

  const isSelf = currentUser?.id === userId
  return (
    <section className="admin-page admin-page-editor">
      <AdminPageHeader
        eyebrow="Команда"
        title={mode === 'create' ? 'Новый сотрудник' : selected?.displayName ?? selected?.email ?? 'Сотрудник'}
        description={mode === 'create' ? 'Создайте учётную запись и передайте временный пароль сотруднику безопасным способом.' : 'Измените имя, роль или пароль. Новый пароль завершит все активные сеансы этого сотрудника.'}
        actions={<Button asChild variant="outline"><Link to="/team">К списку сотрудников</Link></Button>}
      />
      <Card className="admin-editor-surface">
        <CardHeader><CardTitle>Данные для входа</CardTitle><CardDescription>Все поля подписаны так, как их увидит сотрудник.</CardDescription></CardHeader>
        <CardContent>
          <form className="admin-form-stack" onSubmit={(event) => { event.preventDefault(); save.mutate() }}>
            <AdminFormIntro>Имя отображается в админке. E-mail используется как логин.</AdminFormIntro>
            <div className="admin-form-grid-2">
              <AdminField label="Имя сотрудника" hint="Например: Анна Петрова"><Input placeholder="Анна Петрова" value={draft.displayName} onChange={(event) => setDraft((value) => ({ ...value, displayName: event.target.value }))} /></AdminField>
              <AdminField label="E-mail для входа" hint="На этот адрес сотрудник будет входить в админку" required><Input required type="email" placeholder="name@chashkacoffee.ru" value={draft.email} onChange={(event) => setDraft((value) => ({ ...value, email: event.target.value }))} /></AdminField>
            </div>
            <AdminField label={mode === 'create' ? 'Временный пароль' : 'Новый пароль'} hint={mode === 'create' ? 'Не короче 8 символов. Передайте его сотруднику лично или в защищённом чате.' : 'Оставьте поле пустым, если пароль менять не нужно.'} required={mode === 'create'}>
              <Input minLength={8} required={mode === 'create'} type="password" autoComplete="new-password" placeholder={mode === 'create' ? 'Минимум 8 символов' : 'Оставить текущий пароль'} value={draft.password} onChange={(event) => setDraft((value) => ({ ...value, password: event.target.value }))} />
            </AdminField>
            <AdminField label="Уровень доступа" hint="Администратор может управлять сотрудниками, заявками и публикациями.">
              <select value={draft.role} onChange={(event) => setDraft((value) => ({ ...value, role: event.target.value as UserRole }))}><option value="EDITOR">Редактор — рестораны и меню</option><option value="ADMIN">Администратор — полный доступ</option></select>
            </AdminField>
            {save.isError ? <p className="admin-state-message admin-state-error">Не удалось сохранить. Проверьте e-mail, пароль и убедитесь, что в команде остаётся хотя бы один администратор.</p> : null}
            <div className="admin-form-actions"><Button disabled={save.isPending} size="lg" type="submit">{save.isPending ? 'Сохраняем…' : mode === 'create' ? 'Создать сотрудника' : 'Сохранить изменения'}</Button></div>
          </form>
        </CardContent>
      </Card>
      {mode === 'edit' ? (
        <Card className="admin-danger-zone">
          <CardHeader><CardTitle>Закрыть доступ</CardTitle><CardDescription>{isSelf ? 'Собственную учётную запись удалить нельзя.' : 'Сотрудник больше не сможет войти. Это действие нельзя отменить.'}</CardDescription></CardHeader>
          <CardContent><Button disabled={isSelf || remove.isPending} variant="destructive" onClick={() => { if (window.confirm(`Удалить доступ для ${selected?.displayName ?? selected?.email}?`)) remove.mutate() }}>{remove.isPending ? 'Удаляем…' : 'Удалить сотрудника'}</Button>{remove.isError ? <p className="admin-state-message admin-state-error">Не удалось удалить сотрудника. Последнего администратора удалить нельзя.</p> : null}</CardContent>
        </Card>
      ) : null}
    </section>
  )
}

function initials(user: UserDto) {
  return (user.displayName ?? user.email).split(/[\s@]/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('')
}
