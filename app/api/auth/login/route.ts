// Proxies credentials to presoft-api's login endpoint, then sets the JWT it
// returns as an httpOnly cookie on THIS origin. The browser never sees the
// token directly — keeps it off localStorage/client JS and avoids the
// cross-origin cookie issues of the dashboard (:3000) talking straight to
// presoft-api (:4000).
import { NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE } from '@/lib/auth/jwt'
import { PRESOFT_API_URL, presoftApiHeaders } from '@/lib/presoft-api'

const SESSION_MAX_AGE = 60 * 60 * 24 * 7 // 7 days — matches presoft-api's default JWT_EXPIRES_IN

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const email = body?.email
  const password = body?.password

  if (typeof email !== 'string' || typeof password !== 'string') {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
  }

  let apiRes: Response
  try {
    apiRes = await fetch(`${PRESOFT_API_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: presoftApiHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ email, password }),
    })
  } catch {
    return NextResponse.json({ error: 'Unable to reach the auth service' }, { status: 502 })
  }

  const data = await apiRes.json().catch(() => ({}) as { error?: string; token?: string; user?: unknown })

  if (!apiRes.ok || !data.token) {
    return NextResponse.json({ error: data.error ?? 'Invalid email or password' }, { status: apiRes.status || 401 })
  }

  // Debug only — remove once done debugging. No password hash here: this
  // route never receives one, presoft-api only returns id/userId/email/
  // name/role in its login response.

  const response = NextResponse.json({ user: data.user })
  response.cookies.set(SESSION_COOKIE, data.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  })
  return response
}
