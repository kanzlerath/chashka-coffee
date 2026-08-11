import { createBackendRuntime, type BackendRuntime } from './runtime'

type CronTask = (runtime: BackendRuntime) => Promise<void>

export const ANALYTICS_RETENTION_DAYS = 365

const cronTasks = {
  noop: async () => {
    console.log('Cron noop task completed.')
  },
  'db:ping': async ({ prisma }) => {
    await prisma.$queryRaw`SELECT 1`
    console.log('Cron db:ping task completed.')
  },
  'analytics:cleanup': async ({ prisma }) => {
    const cutoff = new Date(Date.now() - ANALYTICS_RETENTION_DAYS * 86_400_000)
    const result = await prisma.pageView.deleteMany({ where: { createdAt: { lt: cutoff } } })
    console.log(`Cron analytics:cleanup removed ${result.count} page views older than ${ANALYTICS_RETENTION_DAYS} days.`)
  },
} satisfies Record<string, CronTask>

export type CronTaskName = keyof typeof cronTasks

export async function runCronTask(taskName: string, runtime: BackendRuntime) {
  const task = cronTasks[taskName as CronTaskName]

  if (!task) {
    throw new Error(`Unknown cron task "${taskName}". Available tasks: ${Object.keys(cronTasks).join(', ')}`)
  }

  await task(runtime)
}

export async function main(argv: string[] = Bun.argv.slice(2)) {
  const [taskName] = argv

  if (!taskName) {
    console.error(`Cron task name is required. Available tasks: ${Object.keys(cronTasks).join(', ')}`)
    process.exit(1)
  }

  const runtime = createBackendRuntime()

  try {
    await runCronTask(taskName, runtime)
  } finally {
    await runtime.close()
  }
}

if (import.meta.main) {
  await main()
}
