// Calls one arbitrary path on the configured presoft-api and reports what
// came back. Lets the /test page smoke-test any endpoint the swagger
// advertises without this app having to know that endpoint's shape first —
// the point is "does the dashboard get data from this API", not "is the
// data correct".
//
// GET  /api/test/probe?path=/foo          -> GETs that path
// POST /api/test/probe  { path, body }    -> POSTs that path, CompanyId
//                                            filled in from env
import { NextRequest, NextResponse } from 'next/server'
import { apiFetch, apiPost } from '@/lib/presoft-api'

// Must be a path on the configured host, never a caller-supplied origin: a
// leading "//" would make fetch() treat it as protocol-relative and send
// the API key to someone else's server.
function invalidPath(path: unknown): string | null {
  if (typeof path !== 'string' || !path) return 'Missing path'
  if (!path.startsWith('/') || path.startsWith('//')) {
    return 'path must start with a single "/" (e.g. /api/v1/kpi-summary)'
  }
  return null
}

async function report(
  res: Response,
  path: string,
  method: string,
  startedAt: number
): Promise<NextResponse> {
  const elapsedMs = Date.now() - startedAt
  const text = await res.text()
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    parsed = null
  }

  return NextResponse.json({
    ok: res.ok,
    status: res.status,
    elapsedMs,
    path,
    method,
    // Row count is the quick "did real data come back" signal; the sample
    // is capped so a full-table response doesn't flood the page.
    rowCount: Array.isArray(parsed) ? parsed.length : null,
    sample: parsed === null ? text.slice(0, 1000) : parsed,
  })
}

export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get('path')
  const problem = invalidPath(path)
  if (problem) return NextResponse.json({ ok: false, error: problem }, { status: 400 })

  const startedAt = Date.now()
  const { res, error } = await apiFetch(path!)
  if (error) return error
  return report(res, path!, 'GET', startedAt)
}

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => null)
  const path = payload?.path
  const problem = invalidPath(path)
  if (problem) return NextResponse.json({ ok: false, error: problem }, { status: 400 })

  // `body` is whatever the endpoint needs beyond CompanyId — typically
  // FromDateTime/ToDateTime. Sent as-is so the page can test any shape.
  const body = payload?.body && typeof payload.body === 'object' ? payload.body : {}

  const startedAt = Date.now()
  const { res, error } = await apiPost(path, body)
  if (error) return error
  return report(res, path, 'POST', startedAt)
}
