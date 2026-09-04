// Proxies presoft-api's own OpenAPI spec (served unauthenticated at
// GET /docs.json — registered before requireApiKey in presoft-api's
// src/index.ts) so /api-docs's Swagger UI documents the API the dashboard
// actually calls.
import { NextResponse } from 'next/server'
import { apiFetch } from '@/lib/presoft-api'

export async function GET() {
  // /docs.json needs no key, but going through apiFetch keeps the config
  // resolution and unreachable-host handling identical to the data routes;
  // the extra x-api-key header is simply ignored upstream.
  const { res: apiRes, error } = await apiFetch('/docs.json')
  if (error) return error

  const body = await apiRes.json().catch(() => ({}))
  return NextResponse.json(body, { status: apiRes.status })
}
