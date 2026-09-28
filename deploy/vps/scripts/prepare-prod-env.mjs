import { randomBytes } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'

const productionValues = {
  APP_DIR: '/srv/chashka-coffee/prod/app',
  UPLOADS_DIR: '/srv/chashka-coffee/prod/uploads',
  WEBSITE_RELEASES_DIR: '/srv/chashka-coffee/prod/website-releases',
  BACKEND_ENV_FILE: '.env.prod',
  WEBSITE_HOST: 'chashkacoffee.ru',
  WEBAPP_HOST: 'admin.chashkacoffee.ru',
  API_HOST: 'api.chashkacoffee.ru',
  PUBLIC_SITE_URL: 'https://chashkacoffee.ru',
  PUBLIC_API_URL: 'https://api.chashkacoffee.ru',
  PUBLIC_WEBAPP_URL: 'https://admin.chashkacoffee.ru',
  VITE_API_URL: 'https://api.chashkacoffee.ru',
  VITE_PUBLIC_SITE_URL: 'https://chashkacoffee.ru',
  POSTGRES_DB: 'chashka_coffee_prod',
  CORS_ORIGINS: 'https://chashkacoffee.ru,https://www.chashkacoffee.ru,https://admin.chashkacoffee.ru',
  COOKIE_SECURE: 'true',
  NODE_ENV: 'production',
  YOOKASSA_RETURN_URL: 'https://chashkacoffee.ru/order',
  YOOKASSA_TEST_MODE: 'true',
}

export function renderProdEnv(devEnv, { postgresPassword, jwtSecret }) {
  const lines = devEnv.split(/\r?\n/)
  const keys = new Map()

  for (const [index, line] of lines.entries()) {
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=/.exec(line)
    if (!match) continue
    if (keys.has(match[1])) throw new Error(`Duplicate DEV env key: ${match[1]}`)
    keys.set(match[1], index)
  }

  for (const key of ['POSTGRES_USER', 'POSTGRES_PASSWORD', 'DATABASE_URL', 'JWT_SECRET']) {
    if (!keys.has(key)) throw new Error(`Missing DEV env key: ${key}`)
  }

  const postgresUser = lines[keys.get('POSTGRES_USER')].split('=', 2)[1]
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(postgresUser)) {
    throw new Error('POSTGRES_USER must be a simple PostgreSQL identifier')
  }

  const values = {
    ...productionValues,
    POSTGRES_PASSWORD: postgresPassword,
    DATABASE_URL: `postgresql://${postgresUser}:${postgresPassword}@postgres:5432/chashka_coffee_prod?schema=public`,
    JWT_SECRET: jwtSecret,
  }

  for (const [key, value] of Object.entries(values)) {
    const index = keys.get(key)
    if (index === undefined) lines.push(`${key}=${value}`)
    else lines[index] = `${key}=${value}`
  }

  for (const [key, index] of keys) {
    if (/\b(?:dev|api-dev|admin-dev)\.chashkacoffee\.ru\b/.test(lines[index])) {
      throw new Error(`Production env still contains a DEV hostname in ${key}`)
    }
  }

  return `${lines.join('\n').replace(/\n*$/, '')}\n`
}

export async function createProdEnv(devPath, prodPath) {
  const devEnv = await readFile(devPath, 'utf8')
  const prodEnv = renderProdEnv(devEnv, {
    postgresPassword: randomBytes(24).toString('hex'),
    jwtSecret: randomBytes(32).toString('hex'),
  })
  await writeFile(prodPath, prodEnv, { encoding: 'utf8', flag: 'wx', mode: 0o600 })
}

if (import.meta.main) {
  const [devPath, prodPath] = process.argv.slice(2)
  if (!devPath || !prodPath) {
    console.error('Usage: bun prepare-prod-env.mjs DEV_ENV_PATH PROD_ENV_PATH')
    process.exitCode = 2
  } else {
    try {
      await createProdEnv(devPath, prodPath)
      console.log(`Created production environment at ${prodPath}`)
    } catch (error) {
      console.error(error.message)
      process.exitCode = 1
    }
  }
}
