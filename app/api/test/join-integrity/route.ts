// Standalone endpoint for the /test page — same pattern as
// /api/test/credit-paid: proxied to the configured presoft-api.
//
// NOTE: /api/v1/test/join-integrity does not exist on presoft-api yet —
// this is the dashboard-side hookup waiting for it.
import { NextResponse } from 'next/server'
import { apiFetch } from '@/lib/presoft-api'

export async function GET() {
  const { res, error } = await apiFetch('/api/v1/test/join-integrity')
  if (error) return error

  const body = await res.json().catch(() => ({}))
  return NextResponse.json(body, { status: res.ok ? 200 : res.status })
}
