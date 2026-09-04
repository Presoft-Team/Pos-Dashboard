// Connectivity smoke test for the /test page: can this dashboard actually
// reach the IIS-hosted presoft-api, and what does that API expose?
// Deliberately schema-agnostic — it only reads the OpenAPI spec at
// /docs.json, so it works before any specific query endpoint exists and
// tells you *why* a connection fails rather than just erroring out.
import { NextResponse } from 'next/server'
import { apiHeaders, getApiConfig } from '@/lib/presoft-api'

interface OpenApiSpec {
  info?: { title?: string; version?: string }
  paths?: Record<string, Record<string, unknown>>
}

export async function GET() {
  // Not using apiFetch here: this route's whole job is to report which
  // stage failed, so it needs the config and the raw fetch error
  // separately rather than a pre-baked error response.
  const config = getApiConfig()
  if (!config) {
    return NextResponse.json({
      ok: false,
      stage: 'config',
      error: 'PRESOFT_API_URL / PRESOFT_API_KEY are not set',
      hint: 'Add both to .env.local (or .env) in the project root, then fully restart `npm run dev` — env files are only read at startup.',
    })
  }

  const startedAt = Date.now()
  let res: Response
  try {
    res = await fetch(`${config.apiUrl}/docs.json`, {
      headers: apiHeaders(config.apiKey),
      // Without a timeout an unreachable LAN IP hangs until the platform
      // default (~2 min), which reads as "the page is broken" rather than
      // "the host is unreachable".
      signal: AbortSignal.timeout(8000),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({
      ok: false,
      stage: 'reach',
      apiUrl: config.apiUrl,
      elapsedMs: Date.now() - startedAt,
      error: message,
      hint:
        'Check the IIS site is running, that its binding listens on this port for the ' +
        'machine name/IP (not just localhost), and that Windows Firewall allows inbound traffic on it.',
    })
  }

  const elapsedMs = Date.now() - startedAt
  const text = await res.text()

  if (!res.ok) {
    return NextResponse.json({
      ok: false,
      stage: 'http',
      apiUrl: config.apiUrl,
      status: res.status,
      elapsedMs,
      error: `GET ${config.apiUrl}/docs.json returned ${res.status}`,
      body: text.slice(0, 500),
    })
  }

  let spec: OpenApiSpec
  try {
    spec = JSON.parse(text)
  } catch {
    // Reached something, but not the API — usually an IIS directory
    // listing or error page, i.e. the URL points at the wrong site.
    return NextResponse.json({
      ok: false,
      stage: 'parse',
      apiUrl: config.apiUrl,
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
    apiUrl: config.apiUrl,
    elapsedMs,
    title: spec.info?.title ?? '(untitled)',
    version: spec.info?.version ?? '(no version)',
    pathCount: paths.length,
    paths: paths.sort(),
  })
}
