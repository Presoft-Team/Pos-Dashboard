// Signs and verifies this app's own session JWT (previously issued by
// presoft-api's POST /api/v1/auth/login; now this app authenticates
// directly against the master-admin Postgres DB and mints the token
// itself). Server-only: imported by the client bundle, this throws at
// build time instead of silently leaking JWT_SECRET to the browser.
import 'server-only'
import jwt from 'jsonwebtoken'

export const SESSION_COOKIE = 'session'
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7 // 7 days

export interface SessionUser {
  sub: number
  userId: string
  email: string
  role: string
  name: string
  businessId: number
  accountType: 'customer' | 'member'
  hasApiConfig: boolean
}

export function signSessionToken(payload: SessionUser): string {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET is not set')
  // Callers that re-sign a token by spreading a previously-verified
  // SessionUser (e.g. business-config's route, after updating
  // hasApiConfig) carry over the iat/exp jsonwebtoken injected into the
  // decoded payload — jwt.sign() throws if the payload already has `exp`
  // while `expiresIn` is also passed, so strip both defensively here.
  const { iat: _iat, exp: _exp, ...clean } = payload as SessionUser & { iat?: number; exp?: number }
  return jwt.sign(clean, secret, { expiresIn: SESSION_MAX_AGE_SECONDS })
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
