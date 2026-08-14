// Proxies presoft-api's own OpenAPI spec (served unauthenticated at
// GET /docs.json — registered before requireApiKey in presoft-api's
// src/index.ts) so /api-docs's Swagger UI documents the API the dashboard
// actually calls, not the retired Postgres-RPC surface. Previously this
// route hand-wrote a spec describing the old /api/rpc/{name} dispatcher,
// which drifted the moment presoft-api became the real backend.
import { NextResponse } from 'next/server'
import { PRESOFT_API_URL } from '@/lib/presoft-api'

export async function GET() {
  let apiRes: Response
  try {
    apiRes = await fetch(`${PRESOFT_API_URL}/docs.json`)
  } catch {
    return NextResponse.json({ error: 'Unable to reach presoft-api' }, { status: 502 })
  }
  const body = await apiRes.json().catch(() => ({}))
  return NextResponse.json(body, { status: apiRes.status })
}
