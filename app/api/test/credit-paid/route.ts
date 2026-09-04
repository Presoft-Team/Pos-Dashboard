// Standalone endpoint for the /test page, proxied to the configured
// presoft-api like every other data route.
//
// NOTE: /api/v1/test/credit-paid does not exist on presoft-api yet — this
// is the dashboard-side hookup waiting for it.
import { NextRequest, NextResponse } from 'next/server'
import { apiFetch } from '@/lib/presoft-api'

export async function GET(request: NextRequest) {
  const { res, error } = await apiFetch(`/api/v1/test/credit-paid${request.nextUrl.search}`)
  if (error) return error

  const body = await res.json().catch(() => ({}))
  return NextResponse.json(body, { status: res.ok ? 200 : res.status })
}
