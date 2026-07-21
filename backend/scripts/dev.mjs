const port = Number.parseInt(process.env.PORT ?? '3000', 10)
const baseUrl = `http://localhost:${port}`

async function hasHealthyBackend() {
  try {
    const response = await fetch(`${baseUrl}/health`, {
      signal: AbortSignal.timeout(750),
    })
    return response.ok && (await response.json()).status === 'ok'
  } catch {
    return false
  }
}

if (await hasHealthyBackend()) {
  console.log(`Backend already running on ${baseUrl}/`)
  process.exit(0)
}

let probe
try {
  probe = Bun.serve({ port, fetch: () => new Response('port probe') })
  await probe.stop(true)
} catch (error) {
  if (error && typeof error === 'object' && 'code' in error && error.code === 'EADDRINUSE') {
    console.error(`Port ${port} is occupied by another process, but it is not a healthy Chashka Coffee backend.`)
    console.error(`Check the process with: lsof -nP -iTCP:${port} -sTCP:LISTEN`)
    process.exit(1)
  }
  throw error
}

const generate = Bun.spawn(['bun', 'run', 'prisma:generate'], {
  cwd: process.cwd(),
  env: process.env,
  stdin: 'inherit',
  stdout: 'inherit',
  stderr: 'inherit',
})
const generateExitCode = await generate.exited
if (generateExitCode !== 0) process.exit(generateExitCode)

// Generation can overlap with a restart of another watcher launched earlier.
if (await hasHealthyBackend()) {
  console.log(`Backend already running on ${baseUrl}/`)
  process.exit(0)
}

const server = Bun.spawn(['bun', '--watch', 'src/index.ts'], {
  cwd: process.cwd(),
  env: process.env,
  stdin: 'inherit',
  stdout: 'inherit',
  stderr: 'inherit',
})

process.exit(await server.exited)
