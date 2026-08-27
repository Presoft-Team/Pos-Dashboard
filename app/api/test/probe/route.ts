// Calls one arbitrary path on presoft-api and reports what came back.
// Lets the /test page smoke-test any endpoint the spec advertises without
// this app having to know that endpoint's shape first — the question being
// answered is "does the dashboard get data from this API", not "is the
// data correct".
//
// GET /api/test/probe?path=/api/v1/kpi-summary
import { NextRequest, NextResponse } from 'next/server'
import { PRESOFT_API_URL, presoftApiHeaders } from '@/lib/presoft-api'

// Must be a path on the configured host, never a caller-supplied origin: a
// leading "//" would make fetch() treat it as protocol-relative and send
// the API key to someone else's server.
function invalidPath(path: string | null): string | null {
  if (!path) return 'Missing path'
  if (!path.startsWith('/') || path.startsWith('//')) {
    return 'path must start with a single "/" (e.g. /api/v1/kpi-summary)'
  }
  return null
}

export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get('path')
  const problem = invalidPath(path)
  if (problem) return NextResponse.json({ ok: false, error: problem }, { status: 400 })

  let headers: Record<string, string>
  try {
    headers = presoftApiHeaders()
  } catch {
    return NextResponse.json({ ok: false, error: 'PRESOFT_API_KEY is not set' }, { status: 500 })
  }

  const startedAt = Date.now()
  let res: Response
  try {
    res = await fetch(`${PRESOFT_API_URL}${path}`, { headers, signal: AbortSignal.timeout(30000) })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unable to reach presoft-api' },
      { status: 502 }
    )
  }

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
    // Row count is the quick "did real data come back" signal; the sample
    // is capped so a full-table response doesn't flood the page.
    rowCount: Array.isArray(parsed) ? parsed.length : null,
    sample: parsed === null ? text.slice(0, 1000) : parsed,
  })
}
