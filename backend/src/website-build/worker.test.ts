import { describe, expect, test } from 'bun:test'

import type { DbClient } from '../db'
import { createWebsiteBuildWorker } from './worker'

type State = {
  id: string
  requestedVersion: number
  completedVersion: number
  status: 'IDLE' | 'QUEUED' | 'BUILDING' | 'FAILED'
  requestedAt: Date | null
  startedAt: Date | null
  completedAt: Date | null
  lastAttemptAt: Date | null
  scheduledThroughAt: Date | null
  lastError: string | null
}

function buildDb(state: State) {
  let current = state
  const db = {
    websiteBuildState: {
      findUnique: async () => current,
      update: async ({ data }: { data: Partial<State> }) => {
        current = { ...current, ...data }
        return current
      },
      upsert: async () => current,
    },
    contentEntry: { findFirst: async () => null },
    product: { findFirst: async () => null },
    jobOpening: { findFirst: async () => null },
  } as unknown as DbClient

  return { db, state: () => current, change: (changes: Partial<State>) => { current = { ...current, ...changes } } }
}

describe('website build worker', () => {
  test('builds the queued version after the debounce window', async () => {
    const requestedAt = new Date('2026-08-07T12:00:00.000Z')
    const fixture = buildDb({ id: 'global', requestedVersion: 1, completedVersion: 0, status: 'QUEUED', requestedAt, startedAt: null, completedAt: null, lastAttemptAt: null, scheduledThroughAt: null, lastError: null })
    let currentTime = new Date('2026-08-07T12:00:30.000Z')
    let builds = 0
    const worker = createWebsiteBuildWorker({ db: fixture.db, debounceMs: 45_000, retryMs: 300_000, now: () => currentTime, buildRelease: async () => { builds += 1 } })

    expect(await worker.runOnce()).toBe(false)
    expect(builds).toBe(0)

    currentTime = new Date('2026-08-07T12:00:46.000Z')
    expect(await worker.runOnce()).toBe(true)
    expect(builds).toBe(1)
    expect(fixture.state()).toMatchObject({ completedVersion: 1, status: 'IDLE' })
  })

  test('queues one follow-up build when content changes during a build', async () => {
    const requestedAt = new Date('2026-08-07T12:00:00.000Z')
    const fixture = buildDb({ id: 'global', requestedVersion: 1, completedVersion: 0, status: 'QUEUED', requestedAt, startedAt: null, completedAt: null, lastAttemptAt: null, scheduledThroughAt: null, lastError: null })
    const worker = createWebsiteBuildWorker({
      db: fixture.db,
      debounceMs: 0,
      retryMs: 300_000,
      now: () => new Date('2026-08-07T12:01:00.000Z'),
      buildRelease: async () => { fixture.change({ requestedVersion: 2, requestedAt: new Date('2026-08-07T12:01:00.000Z') }) },
    })

    await worker.runOnce()
    expect(fixture.state()).toMatchObject({ completedVersion: 1, requestedVersion: 2, status: 'QUEUED' })
  })
})
