import { resolve } from 'node:path'

import { createBackendRuntime, type BackendRuntime } from './runtime'
import { createWebsiteBuildWorker } from './website-build/worker'

const repositoryRoot = resolve(import.meta.dir, '../..')

export async function runWorker(runtime: BackendRuntime) {
  const worker = createWebsiteBuildWorker({
    db: runtime.prisma,
    debounceMs: runtime.env.WEBSITE_BUILD_DEBOUNCE_SECONDS * 1_000,
    retryMs: runtime.env.WEBSITE_BUILD_RETRY_SECONDS * 1_000,
    buildRelease: async () => {
      const buildProcess = Bun.spawn(['bun', 'deploy/vps/scripts/build-website-release.mjs'], {
        cwd: repositoryRoot,
        env: process.env,
        stdin: 'inherit',
        stdout: 'inherit',
        stderr: 'inherit',
      })
      const exitCode = await buildProcess.exited
      if (exitCode !== 0) throw new Error(`Static website build exited with code ${exitCode}`)
    },
  })
  let stopping = false
  const stop = () => { stopping = true }
  process.once('SIGINT', stop)
  process.once('SIGTERM', stop)

  console.log('Website build worker started.')
  while (!stopping) {
    await worker.runOnce()
    if (stopping) break
    await new Promise((resolve) => setTimeout(resolve, runtime.env.WEBSITE_BUILD_POLL_SECONDS * 1_000))
  }
}

export async function main() {
  const runtime = createBackendRuntime()

  try {
    await runWorker(runtime)
  } finally {
    await runtime.close()
  }
}

if (import.meta.main) {
  await main()
}
