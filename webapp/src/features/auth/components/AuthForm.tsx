import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { LoginForm } from './LoginForm'
import { emptyDraft, type AuthDraft } from './form-model'

export function AuthForm() {
  const draft: AuthDraft = emptyDraft

  function updateDraft(_nextDraft: Partial<AuthDraft>) {}

  return (
    <Card className="w-full" aria-label="Authentication">
      <CardHeader>
        <CardTitle>Вход в админку</CardTitle>
        <CardDescription>Доступ выдаёт администратор. Самостоятельной регистрации нет.</CardDescription>
      </CardHeader>
      <CardContent>
        <LoginForm draft={draft} onDraftChange={updateDraft} />
      </CardContent>
    </Card>
  )
}
