import { spawn } from 'node:child_process'

import { publishWebsiteRelease } from './website-release.mjs'

const releasesDir = process.env.WEBSITE_RELEASES_DIR
if (!releasesDir) throw new Error('WEBSITE_RELEASES_DIR is required')
const stagingDir = process.env.WEBSITE_BUILD_STAGING_DIR
if (!stagingDir) throw new Error('WEBSITE_BUILD_STAGING_DIR is required')

const release = await publishWebsiteRelease({
  releasesDir,
  stagingDir,
  build: async (outDir) => {
    const exitCode = await run('bun', ['run', 'build:website'], {
      ...process.env,
      WEBSITE_BUILD_OUT_DIR: outDir,
    })
    if (exitCode !== 0) throw new Error(`Astro build exited with code ${exitCode}`)
  },
})

console.log(`Published website release ${release}`)

function run(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: process.cwd(), env, stdio: 'inherit' })
    child.once('error', reject)
    child.once('exit', (code) => resolve(code ?? 1))
  })
}
