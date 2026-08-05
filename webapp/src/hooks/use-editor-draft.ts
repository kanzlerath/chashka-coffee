import { useBlocker } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'

import {
  formDraftStorageKey,
  parseStoredFormDraft,
  serializeFormDraft,
  type StoredFormDraft,
} from '@/lib/form-drafts'

type EditorDraftOptions<T> = {
  key: string
  initialValue: T
  sourceVersion: string
  enabled?: boolean
}

export function useEditorDraft<T>({ key, initialValue, sourceVersion, enabled = true }: EditorDraftOptions<T>) {
  const [draft, setDraftState] = useState(initialValue)
  const [recovery, setRecovery] = useState<StoredFormDraft<T> | null>(null)
  const [hydratedStorageKey, setHydratedStorageKey] = useState<string | null>(null)
  const baselineRef = useRef(JSON.stringify(initialValue))
  const allowNavigationRef = useRef(false)
  const storageKey = formDraftStorageKey(key)
  const serializedDraft = useMemo(() => JSON.stringify(draft), [draft])
  // The baseline is an imperative save snapshot; updating it must not cause a render of the editor.
  // eslint-disable-next-line react-hooks/refs
  const isDirty = enabled && serializedDraft !== baselineRef.current

  useEffect(() => {
    baselineRef.current = JSON.stringify(initialValue)
    allowNavigationRef.current = false
    // A newly resolved entity version starts a fresh local editing session.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraftState(initialValue)
    const stored = parseStoredFormDraft<T>(window.localStorage.getItem(storageKey))
    setRecovery(stored?.sourceVersion === sourceVersion && JSON.stringify(stored.value) !== baselineRef.current ? stored : null)
    setHydratedStorageKey(storageKey)
    // The source version is the explicit boundary; object identity changes alone must not erase typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceVersion, storageKey])

  useEffect(() => {
    if (!enabled || hydratedStorageKey !== storageKey || recovery) return
    if (!isDirty) {
      window.localStorage.removeItem(storageKey)
      return
    }
    const timer = window.setTimeout(() => {
      window.localStorage.setItem(storageKey, serializeFormDraft(sourceVersion, draft))
    }, 450)
    return () => window.clearTimeout(timer)
  }, [draft, enabled, hydratedStorageKey, isDirty, recovery, sourceVersion, storageKey])

  useBlocker({
    enableBeforeUnload: isDirty,
    shouldBlockFn: () => {
      if (!isDirty || allowNavigationRef.current) return false
      return !window.confirm('Есть несохранённые изменения. Покинуть страницу и оставить черновик?')
    },
  })

  const setDraft: Dispatch<SetStateAction<T>> = useCallback((next) => {
    allowNavigationRef.current = false
    setDraftState(next)
  }, [])

  const restore = useCallback(() => {
    if (!recovery) return
    setDraftState(recovery.value)
    setRecovery(null)
  }, [recovery])

  const discardRecovery = useCallback(() => {
    window.localStorage.removeItem(storageKey)
    setRecovery(null)
  }, [storageKey])

  const markSaved = useCallback((savedValue?: T) => {
    const value = savedValue ?? draft
    baselineRef.current = JSON.stringify(value)
    allowNavigationRef.current = true
    window.localStorage.removeItem(storageKey)
    setRecovery(null)
  }, [draft, storageKey])

  return { draft, setDraft, isDirty, recovery, restore, discardRecovery, markSaved }
}
