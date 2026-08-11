import { describe, expect, test } from 'bun:test'

import type { BackendRuntime } from './runtime'
import { ANALYTICS_RETENTION_DAYS, runCronTask } from './cron'

const runtime = {} as BackendRuntime

describe('runCronTask', () => {
  test('runs the noop task', async () => {
    await expect(runCronTask('noop', runtime)).resolves.toBeUndefined()
  })

  test('rejects unknown tasks', async () => {
    await expect(runCronTask('missing', runtime)).rejects.toThrow('Unknown cron task')
  })

  test('deletes analytics page views older than the retention period', async () => {
    let deleteWhere: { createdAt: { lt: Date } } | undefined
    const analyticsRuntime = {
      prisma: {
        pageView: {
          deleteMany: async (args: { where: { createdAt: { lt: Date } } }) => {
            deleteWhere = args.where
            return { count: 4 }
          },
        },
      },
    } as unknown as BackendRuntime
    const before = Date.now()

    await runCronTask('analytics:cleanup', analyticsRuntime)

    const expected = before - ANALYTICS_RETENTION_DAYS * 86_400_000
    expect(deleteWhere).toBeDefined()
    expect(Math.abs(deleteWhere!.createdAt.lt.getTime() - expected)).toBeLessThan(1_000)
  })
})
