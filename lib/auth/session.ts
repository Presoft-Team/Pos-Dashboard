// Signed-cookie session for the per-client login. Same approach as the
// license-portal app (jose, HS256), but the payload here carries the
// RESOLVED AutoCount tenant config directly — it's baked in at login time
// so ordinary requests never need a DB round-trip, only /api/auth/login
// touches Postgres. See lib/presoft-api.ts's getApiConfig(), which reads
// this session first and falls back to PRESOFT_API_URL/KEY env vars.
import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

const COOKIE_NAME = 'dashboard_session'
const SESSION_TTL_SECONDS = 60 * 60 * 12 // 12 hours

export interface DashboardSessionPayload {
  clientId: string
  name: string
  apiUrl: string
  apiKey: string
  companyId: string
}

function getSecretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET
  if (!secret) {
    throw new Error('SESSION_SECRET is not set — add it to .env and restart the server')
  }
  return new TextEncoder().encode(secret)
}

export async function signSession(payload: DashboardSessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecretKey())
}

export async function verifySession(token: string): Promise<DashboardSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey())
    if (
      typeof payload.clientId !== 'string' ||
      typeof payload.name !== 'string' ||
      typeof payload.apiUrl !== 'string' ||
      typeof payload.apiKey !== 'string' ||
      typeof payload.companyId !== 'string'
    ) {
      return null
    }
    return {
      clientId: payload.clientId,
      name: payload.name,
      apiUrl: payload.apiUrl,
      apiKey: payload.apiKey,
      companyId: payload.companyId,
    }
  } catch {
    return null
  }
}

// Server Components / Route Handlers only (uses next/headers). Returns
// null if there's no session or SESSION_SECRET isn't set — callers should
// treat that the same as "no DB-based tenant, fall back to env config".
export async function getDashboardSession(): Promise<DashboardSessionPayload | null> {
  if (!process.env.SESSION_SECRET) return null
  const store = await cookies()
  const token = store.get(COOKIE_NAME)?.value
  if (!token) return null
  return verifySession(token)
}

export const SESSION_COOKIE_NAME = COOKIE_NAME
export const SESSION_MAX_AGE = SESSION_TTL_SECONDS
