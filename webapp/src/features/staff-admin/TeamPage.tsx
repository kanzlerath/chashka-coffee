import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createStaffUserRequestSchema, staffUserListResponseSchema, staffUserResponseSchema, type CreateStaffUserRequest } from '@chashka-coffee/contracts'
import { useMemo, useState } from 'react'

import { AdminPageHeader } from '@/components/admin'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/features/auth'

const emptyDraft: CreateStaffUserRequest = { email: '', password: '', displayName: undefined, role: 'EDITOR' }

export function TeamPage() {
  const { api } = useAuth()
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState(emptyDraft)
  const staff = useQuery({ queryKey: ['admin', 'staff'], queryFn: () => api.request('/api/admin/users', staffUserListResponseSchema) })
  const create = useMutation({
    mutationFn: () => api.request('/api/admin/users', staffUserResponseSchema, { method: 'POST', body: createStaffUserRequestSchema.parse(draft) }),
    onSuccess: () => { setDraft(emptyDraft); void queryClient.invalidateQueries({ queryKey: ['admin', 'staff'] }) },
  })
  const canSubmit = useMemo(() => draft.email.length > 0 && draft.password.length >= 8, [draft])

  return <section className="admin-page">
    <AdminPageHeader eyebrow="Настройки" title="Команда и доступы" description="Регистрации в админке нет — доступ появляется только после приглашения сотрудника." />
    <div className="grid gap-6 lg:grid-cols-[1.05fr_.95fr]">
    <Card><CardHeader><CardTitle>Сотрудники</CardTitle><CardDescription>Пользователи, у которых есть доступ к админке.</CardDescription></CardHeader><CardContent className="grid gap-2">
      {staff.isPending && <CardDescription>Загружаем сотрудников…</CardDescription>}
      {staff.data?.users.map((user) => <div key={user.id} className="flex items-center justify-between gap-4 rounded-xl border p-4"><div><strong>{user.displayName ?? user.email}</strong><p className="mt-1 text-sm text-muted-foreground">{user.email}</p></div><span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold">{user.role === 'ADMIN' ? 'Администратор' : 'Редактор'}</span></div>)}
      {staff.isError && <p className="text-sm text-destructive">Не удалось загрузить сотрудников.</p>}
    </CardContent></Card>
    <Card><CardHeader><CardTitle>Выдать доступ</CardTitle><CardDescription>Передай временный пароль сотруднику безопасным способом.</CardDescription></CardHeader><CardContent>
      <form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); create.mutate() }}>
        <label className="grid gap-1.5 text-sm font-medium">Имя<Input value={draft.displayName ?? ''} onChange={(event) => setDraft((value) => ({ ...value, displayName: event.target.value || undefined }))} /></label>
        <label className="grid gap-1.5 text-sm font-medium">E-mail<Input required type="email" value={draft.email} onChange={(event) => setDraft((value) => ({ ...value, email: event.target.value }))} /></label>
        <label className="grid gap-1.5 text-sm font-medium">Временный пароль<Input required minLength={8} type="password" value={draft.password} onChange={(event) => setDraft((value) => ({ ...value, password: event.target.value }))} /></label>
        <label className="grid gap-1.5 text-sm font-medium">Роль<select value={draft.role} onChange={(event) => setDraft((value) => ({ ...value, role: event.target.value as CreateStaffUserRequest['role'] }))}><option value="EDITOR">Редактор</option><option value="ADMIN">Администратор</option></select></label>
        {create.isError && <p className="text-sm text-destructive">Не удалось выдать доступ. Возможно, этот e-mail уже добавлен.</p>}
        <Button type="submit" size="lg" disabled={!canSubmit || create.isPending}>{create.isPending ? 'Создаём…' : 'Выдать доступ'}</Button>
      </form>
    </CardContent></Card>
    </div>
  </section>
}
