// Config for talking to the presoft-api instance this dashboard serves.
//
// presoft-api is self-hosted on IIS, so PRESOFT_API_URL is that box's
// address — a LAN IP on port 9000 over plain http (http://192.168.1.10:9000),
// not a public https origin.
//
// Deliberately not NEXT_PUBLIC_-prefixed / server-only: the browser never
// talks to the IIS host directly, only this server does, so the API key
// stays out of the client bundle.
import 'server-only'
import { NextResponse } from 'next/server'

export interface ApiConfig {
  apiUrl: string
  apiKey: string
  // Which account book to query. The API takes this as CompanyId in the
  // POST body of its data endpoints, so it is per-deployment config rather
  // than something a dashboard page chooses.
  companyId: string
}

// Accepts the bare "192.168.1.10:9000" form people know their IIS site by,
// as well as a full origin, with or without a trailing slash. Callers
// append an absolute "/api/v1/..." path and fetch() throws on a
// scheme-less URL, so both are normalized here.
function normalizeApiUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '')
  return /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`
}

export function getApiConfig(): ApiConfig | null {
  const rawUrl = process.env.PRESOFT_API_URL
  const apiKey = process.env.PRESOFT_API_KEY
  if (!rawUrl?.trim() || !apiKey?.trim()) return null
  return {
    apiUrl: normalizeApiUrl(rawUrl),
    apiKey: apiKey.trim(),
    // Not required to have a value: /docs.json and any endpoint that
    // doesn't take a CompanyId still work without it, so a missing company
    // id shouldn't make the whole config unusable.
    companyId: process.env.PRESOFT_COMPANY_ID?.trim() ?? '',
  }
}

export function apiHeaders(apiKey: string, extra?: Record<string, string>): Record<string, string> {
  return { 'x-api-key': apiKey, ...extra }
}

// Config lookup + upstream fetch in one step. On failure it hands back the
// NextResponse to return verbatim, so no route reimplements the 500/502
// shapes.
export async function apiFetch(
  path: string,
  init?: RequestInit
): Promise<{ res: Response; error?: never } | { res?: never; error: NextResponse }> {
  const config = getApiConfig()
  if (!config) {
    return {
      error: NextResponse.json(
        { error: 'PRESOFT_API_URL / PRESOFT_API_KEY are not set — add them to .env.local and restart the dev server' },
        { status: 500 }
      ),
    }
  }

  try {
    const res = await fetch(`${config.apiUrl}${path}`, {
      ...init,
      headers: apiHeaders(config.apiKey, init?.headers as Record<string, string> | undefined),
    })
    return { res }
  } catch {
    return { error: NextResponse.json({ error: 'Unable to reach presoft-api' }, { status: 502 }) }
  }
}

// POST with a JSON body, with CompanyId filled in from env. The API's data
// endpoints take { CompanyId, FromDateTime, ToDateTime, ... } rather than
// query-string params, and CompanyId is the same for every call in a given
// deployment — so callers pass only the parts that vary. An explicit
// CompanyId in `body` still wins, for the odd call that needs another book.
export async function apiPost(
  path: string,
  body: Record<string, unknown> = {}
): Promise<{ res: Response; error?: never } | { res?: never; error: NextResponse }> {
  const config = getApiConfig()
  return apiFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...(config?.companyId ? { CompanyId: config.companyId } : {}),
      ...body,
    }),
  })
}
