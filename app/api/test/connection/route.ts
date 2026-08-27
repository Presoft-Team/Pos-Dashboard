// Connectivity smoke test for the /test page: can this dashboard actually
// reach presoft-api, and through it the AutoCount SQL Server account book?
//
// Deliberately schema-agnostic — it only reads the OpenAPI spec at
// /docs.json, so it keeps working as endpoints come and go, and it reports
// *which stage* failed rather than just erroring out. That distinction is
// the whole point: "key not set", "host unreachable", and "answered, but
// not with JSON" have completely different fixes.
import { NextResponse } from 'next/server'
import { PRESOFT_API_URL, presoftApiHeaders } from '@/lib/presoft-api'

interface OpenApiSpec {
  info?: { title?: string; version?: string }
  paths?: Record<string, Record<string, unknown>>
}

export async function GET() {
  // presoftApiHeaders throws when PRESOFT_API_KEY is missing; catching it
  // here turns that into a named stage instead of an unhandled 500.
  let headers: Record<string, string>
  try {
    headers = presoftApiHeaders()
  } catch {
    return NextResponse.json({
      ok: false,
      stage: 'config',
      error: 'PRESOFT_API_KEY is not set',
      hint: 'Add it to .env.local (or .env) in the project root, then fully restart `npm run dev` — Next reads env files only at startup.',
    })
  }

  const startedAt = Date.now()
  let res: Response
  try {
    res = await fetch(`${PRESOFT_API_URL}/docs.json`, {
      headers,
      // Without a timeout an unreachable host hangs until the platform
      // default (~2 min), which reads as "the page is broken" rather than
      // "the host is unreachable".
      signal: AbortSignal.timeout(8000),
    })
  } catch (err) {
    return NextResponse.json({
      ok: false,
      stage: 'reach',
      apiUrl: PRESOFT_API_URL,
      elapsedMs: Date.now() - startedAt,
      error: err instanceof Error ? err.message : String(err),
      hint: 'Check presoft-api is running and listening on this address, and that no firewall blocks the port.',
    })
  }

  const elapsedMs = Date.now() - startedAt
  const text = await res.text()

  if (!res.ok) {
    return NextResponse.json({
      ok: false,
      stage: 'http',
      apiUrl: PRESOFT_API_URL,
      status: res.status,
      elapsedMs,
      error: `GET ${PRESOFT_API_URL}/docs.json returned ${res.status}`,
      body: text.slice(0, 500),
    })
  }

  let spec: OpenApiSpec
  try {
    spec = JSON.parse(text)
  } catch {
    // Reached something, but not presoft-api — usually a web server's own
    // error or directory page, i.e. the URL points at the wrong site.
    return NextResponse.json({
      ok: false,
      stage: 'parse',
      apiUrl: PRESOFT_API_URL,
      elapsedMs,
      error: 'Response was not JSON — this URL may not be presoft-api',
      body: text.slice(0, 500),
    })
  }

  const paths = Object.entries(spec.paths ?? {}).flatMap(([p, methods]) =>
    Object.keys(methods).map((method) => `${method.toUpperCase()} ${p}`)
  )

  return NextResponse.json({
    ok: true,
    stage: 'done',
    apiUrl: PRESOFT_API_URL,
    elapsedMs,
    title: spec.info?.title ?? '(untitled)',
    version: spec.info?.version ?? '(no version)',
    pathCount: paths.length,
    paths: paths.sort(),
  })
}
