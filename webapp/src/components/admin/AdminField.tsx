import type { ReactNode } from 'react'

export function AdminField({
  label,
  hint,
  required,
  children,
}: {
  label: string
  hint?: string
  required?: boolean
  children: ReactNode
}) {
  return (
    <label className="admin-field">
      <span className="admin-field-label">
        {label}
        {required ? <em> · обязательно</em> : null}
      </span>
      {children}
      {hint ? <small className="admin-field-hint">{hint}</small> : null}
    </label>
  )
}

export function AdminFormIntro({ children }: { children: ReactNode }) {
  return <p className="admin-form-intro">{children}</p>
}
