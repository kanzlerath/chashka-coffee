import type { DbClient } from '../db'
import { websiteBuildStateId } from './queue'

const earliestTime = new Date(0)

export type WebsiteReleaseBuilder = () => Promise<void>

export type WebsiteBuildWorkerOptions = {
  db: DbClient
  buildRelease: WebsiteReleaseBuilder
  debounceMs: number
  retryMs: number
  now?: () => Date
}

export function createWebsiteBuildWorker(options: WebsiteBuildWorkerOptions) {
  const now = options.now ?? (() => new Date())

  async function queueDueScheduledContent() {
    const state = await options.db.websiteBuildState.findUnique({ where: { id: websiteBuildStateId } })
    const since = state?.scheduledThroughAt ?? earliestTime
    const until = now()

    const due = await findDueScheduledContent(options.db, since, until)
    if (!due) return

    await options.db.websiteBuildState.upsert({
      where: { id: websiteBuildStateId },
      create: {
        id: websiteBuildStateId,
        requestedVersion: 1,
        status: 'QUEUED',
        requestedAt: until,
        scheduledThroughAt: until,
      },
      update: {
        requestedVersion: { increment: 1 },
        status: 'QUEUED',
        requestedAt: until,
        scheduledThroughAt: until,
        lastError: null,
      },
    })
  }

  async function runOnce() {
    await queueDueScheduledContent()
    const state = await options.db.websiteBuildState.findUnique({ where: { id: websiteBuildStateId } })
    if (!state || state.requestedVersion <= state.completedVersion) return false

    const startedAt = now()
    const earliestStart = new Date((state.requestedAt ?? startedAt).getTime() + options.debounceMs)
    if (startedAt < earliestStart) return false

    if (state.lastAttemptAt && state.status === 'FAILED' && startedAt.getTime() < state.lastAttemptAt.getTime() + options.retryMs) {
      return false
    }

    const targetVersion = state.requestedVersion
    await options.db.websiteBuildState.update({
      where: { id: websiteBuildStateId },
      data: { status: 'BUILDING', startedAt, lastAttemptAt: startedAt, lastError: null },
    })

    try {
      await options.buildRelease()
      const completedAt = now()
      const latest = await options.db.websiteBuildState.findUnique({ where: { id: websiteBuildStateId } })
      await options.db.websiteBuildState.update({
        where: { id: websiteBuildStateId },
        data: {
          completedVersion: targetVersion,
          completedAt,
          status: latest && latest.requestedVersion > targetVersion ? 'QUEUED' : 'IDLE',
          lastError: null,
        },
      })
      console.log(`Website build ${targetVersion} published.`)
      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await options.db.websiteBuildState.update({
        where: { id: websiteBuildStateId },
        data: { status: 'FAILED', lastError: message.slice(0, 4_000) },
      })
      console.error(`Website build ${targetVersion} failed`, error)
      return false
    }
  }

  return { runOnce }
}

async function findDueScheduledContent(db: DbClient, since: Date, until: Date) {
  const dateRange = { gt: since, lte: until }
  const [content, products, jobs] = await Promise.all([
    db.contentEntry.findFirst({
      where: {
        OR: [
          { status: 'SCHEDULED', publishAt: dateRange },
          { status: { in: ['PUBLISHED', 'SCHEDULED'] }, startsAt: dateRange },
          { status: { in: ['PUBLISHED', 'SCHEDULED'] }, endsAt: dateRange },
        ],
      },
      select: { id: true },
    }),
    db.product.findFirst({ where: { status: 'SCHEDULED', publishAt: dateRange }, select: { id: true } }),
    db.jobOpening.findFirst({ where: { status: 'SCHEDULED', publishAt: dateRange }, select: { id: true } }),
  ])
  return Boolean(content || products || jobs)
}
