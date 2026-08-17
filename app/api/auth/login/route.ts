// Authenticates against the master-admin Postgres DB (customer = business
// admin/owner, member = staff under a customer) instead of proxying to
// presoft-api. Password check happens in SQL via pgcrypto's crypt() so no
// bcrypt npm dependency is needed — the DB already hashes with
// crypt(pw, gen_salt('bf')) at signup time.
import { NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, signSessionToken, type SessionUser } from '@/lib/auth/jwt'
import { query } from '@/lib/db/master-admin'

interface CustomerRow {
  id: number
  name: string
  email: string
  business_id: number
  password_ok: boolean
}

interface MemberRow {
  id: number
  name: string
  email: string
  role: string | null
  business_id: number
  password_ok: boolean
}

interface BusinessConfigRow {
  api_url: string | null
  has_api_key: boolean
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const email = body?.email
  const password = body?.password

  if (typeof email !== 'string' || typeof password !== 'string') {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
  }

  const invalidCredentials = () => NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })

  let payload: SessionUser

  const customerRows = await query<CustomerRow>(
    `SELECT id, name, email, business_id, (password_hash = crypt($2, password_hash)) AS password_ok
     FROM customer WHERE email = $1`,
    [email, password]
  )

  if (customerRows.length > 0) {
    const row = customerRows[0]
    if (!row.password_ok) return invalidCredentials()

    payload = await buildPayload({
      sub: row.id,
      email: row.email,
      name: row.name,
      role: 'admin',
      businessId: row.business_id,
      accountType: 'customer',
    })
  } else {
    const memberRows = await query<MemberRow>(
      `SELECT m.id, m.name, m.email, m.role, c.business_id,
              (m.password_hash = crypt($2, m.password_hash)) AS password_ok
       FROM member m
       JOIN customer c ON c.id = m.admin_id
       WHERE m.email = $1
       ORDER BY m.id
       LIMIT 1`,
      [email, password]
    )

    if (memberRows.length === 0) return invalidCredentials()
    const row = memberRows[0]
    if (!row.password_ok) return invalidCredentials()

    payload = await buildPayload({
      sub: row.id,
      email: row.email,
      name: row.name,
      role: row.role ?? 'staff',
      businessId: row.business_id,
      accountType: 'member',
    })
  }

  const token = signSessionToken(payload)
  const response = NextResponse.json({ user: payload, hasApiConfig: payload.hasApiConfig })
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: '/',
  })
  return response
}

async function buildPayload(base: {
  sub: number
  email: string
  name: string
  role: string
  businessId: number
  accountType: 'customer' | 'member'
}): Promise<SessionUser> {
  const businessRows = await query<BusinessConfigRow>(
    `SELECT api_url, (api_key IS NOT NULL) AS has_api_key FROM business WHERE business_id = $1`,
    [base.businessId]
  )
  const business = businessRows[0]
  const hasApiConfig = Boolean(business?.api_url) && Boolean(business?.has_api_key)

  return {
    sub: base.sub,
    userId: String(base.sub),
    email: base.email,
    name: base.name,
    role: base.role,
    businessId: base.businessId,
    accountType: base.accountType,
    hasApiConfig,
  }
}
