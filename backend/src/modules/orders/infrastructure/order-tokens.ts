import { createHash, randomBytes } from 'node:crypto'

export function createOrderPublicNumber() {
  return `CK-${new Date().toISOString().slice(2, 10).replaceAll('-', '')}-${randomBytes(3).toString('hex').toUpperCase()}`
}

export function createOrderAccessToken(idempotencyKey: string, publicNumber: string) {
  return createHash('sha256').update(`${idempotencyKey}:${publicNumber}`).digest('base64url')
}

export function hashOrderAccessToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}
