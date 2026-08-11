// Verifies the JWT presoft-api's POST /api/v1/auth/login issues. Server-only:
// imported by the client bundle, this throws at build time instead of
// silently leaking JWT_SECRET to the browser.
import 'server-only'
import jwt from 'jsonwebtoken'

export const SESSION_COOKIE = 'session'

export interface SessionUser {
  sub: number
  userId: string
  email: string
  role: string
  name: string
}

export function verifySessionToken(token: string): SessionUser | null {
  const secret = process.env.JWT_SECRET
  if (!secret) return null
  try {
    return jwt.verify(token, secret) as unknown as SessionUser
  } catch {
    return null
  }
}
