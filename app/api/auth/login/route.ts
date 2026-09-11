import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getClientByUsername } from '@/lib/db/tenant'
import { signSession, SESSION_COOKIE_NAME, SESSION_MAX_AGE } from '@/lib/auth/session'

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const username = typeof body?.username === 'string' ? body.username.trim() : ''
  const password = typeof body?.password === 'string' ? body.password : ''

  if (!username || !password) {
    return NextResponse.json({ error: 'Username and password are required' }, { status: 400 })
  }

  const client = await getClientByUsername(username)
  if (!client) {
    return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 })
  }

  const ok = await bcrypt.compare(password, client.passwordHash)
  if (!ok) {
    return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 })
  }

  if (client.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'This account has been suspended. Contact Presoft.' }, { status: 403 })
  }
  if (client.expiresAt && client.expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: 'This license has expired. Contact Presoft.' }, { status: 403 })
  }

  const token = await signSession({
    clientId: client.id,
    name: client.name,
    apiUrl: client.apiUrl,
    apiKey: client.apiKey,
    companyId: client.companyId,
  })

  const res = NextResponse.json({ ok: true })
  res.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  })
  return res
}
