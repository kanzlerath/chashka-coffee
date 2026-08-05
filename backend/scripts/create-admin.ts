import 'dotenv/config'

import { createPrisma } from '../src/db'

const [email, password] = process.argv.slice(2)

if (!email || !password) {
  throw new Error('Usage: bun scripts/create-admin.ts <email> <password>')
}

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is required.')

const db = createPrisma(databaseUrl)

try {
  const passwordHash = await Bun.password.hash(password, { algorithm: 'argon2id' })
  const user = await db.user.upsert({
    where: { email: email.trim().toLowerCase() },
    create: { email: email.trim().toLowerCase(), passwordHash, displayName: 'Никита Лужков', role: 'ADMIN', roles: ['SUPER_ADMIN'] },
    update: { passwordHash, displayName: 'Никита Лужков', role: 'ADMIN', roles: ['SUPER_ADMIN'] },
    select: { id: true, email: true, roles: true },
  })
  console.log(`Super admin ready: ${user.email} (${user.roles.join(', ')})`)
} finally {
  await db.$disconnect()
}
