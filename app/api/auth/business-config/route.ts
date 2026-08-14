// Lets a logged-in tenant (customer or member — no role restriction for
// this first pass) enter their business's presoft-api url/key once, so
// app/api/presoft/** can start syncing for that tenant. Saves api_key
// encrypted (pgp_sym_encrypt) into the master-admin DB, then reissues the
// session cookie with hasApiConfig: true so proxy.ts stops redirecting
// here on the next navigation.
import { NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, signSessionToken, verifySessionToken } from '@/lib/auth/jwt'
import { query } from '@/lib/db/master-admin'

export async function POST(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value
  const user = token ? verifySessionToken(token) : null
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const apiUrl = body?.apiUrl
  const apiKey = body?.apiKey

  if (typeof apiUrl !== 'string' || typeof apiKey !== 'string' || !apiUrl.trim() || !apiKey.trim()) {
    return NextResponse.json({ error: 'API URL and API key are required' }, { status: 400 })
  }

  const passphrase = process.env.MASTER_ADMIN_ENCRYPTION_PASSPHRASE
  if (!passphrase) {
    return NextResponse.json({ error: 'Server misconfigured: MASTER_ADMIN_ENCRYPTION_PASSPHRASE is not set' }, { status: 500 })
  }

  try {
    await query(
      `UPDATE business SET api_url = $1, api_key = pgp_sym_encrypt($2, $3) WHERE business_id = $4`,
      [apiUrl.trim(), apiKey.trim(), passphrase, user.businessId]
    )
  } catch (err) {
    console.error('business-config UPDATE failed:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown DB error' }, { status: 500 })
  }

  const refreshedToken = signSessionToken({ ...user, hasApiConfig: true })
  const response = NextResponse.json({ ok: true })
  response.cookies.set(SESSION_COOKIE, refreshedToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: '/',
  })
  return response
}
