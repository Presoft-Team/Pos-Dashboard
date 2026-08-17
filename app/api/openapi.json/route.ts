// Proxies presoft-api's own OpenAPI spec (served unauthenticated at
// GET /docs.json — registered before requireApiKey in presoft-api's
// src/index.ts) so /api-docs's Swagger UI documents the API the dashboard
// actually calls, not the retired Postgres-RPC surface. Previously this
// route hand-wrote a spec describing the old /api/rpc/{name} dispatcher,
// which drifted the moment presoft-api became the real backend.
//
// presoft-api's URL is now per-tenant (see lib/presoft-api.ts), so this
// route resolves it from the caller's session like the other presoft
// proxy routes — not covered by proxy.ts's matcher (excludes /api), so it
// does its own auth check.
import { NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth/jwt'
import { getTenantApiConfig } from '@/lib/presoft-api'

export async function GET(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value
  const user = token ? verifySessionToken(token) : null
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const tenantConfig = await getTenantApiConfig(user.businessId)
  if (!tenantConfig) {
    return NextResponse.json({ error: 'This business has not configured its presoft-api connection yet' }, { status: 409 })
  }

  let apiRes: Response
  try {
    apiRes = await fetch(`${tenantConfig.apiUrl}/docs.json`)
  } catch {
    return NextResponse.json({ error: 'Unable to reach presoft-api' }, { status: 502 })
  }
  const body = await apiRes.json().catch(() => ({}))
  return NextResponse.json(body, { status: apiRes.status })
}
