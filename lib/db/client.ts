// Drop-in replacement for `createClient().rpc(name, params)` from
// @supabase/supabase-js (lib/supabase/client.ts) — but instead of calling
// presoft-api directly, this calls this app's own /api/presoft/[name]
// server-side proxy (app/api/presoft/[name]/route.ts), which forwards to
// presoft-api with the API key attached. That indirection exists
// specifically so the key never reaches this browser-side bundle. Page
// components that only ever called `supabase.rpc(...)` need no other
// changes.
'use client'

// presoft-api has no "unlimited" convention for `limit` (missing = its own
// sensible default of 5, for public API callers who forget to set one) —
// but this dashboard's Performance page relies on requesting genuinely all
// rows (`p_limit: null`) for its full breakdown tables, re-slicing to top-5
// client-side for the chart from that same fetch (see
// components/performance-table.tsx). Translate that intent into an
// explicit very-large `limit` instead of omitting the param, so presoft-api
// doesn't need to know about this dashboard's internal calling convention.
const NO_LIMIT = 2147483647

// Old Supabase RPC calls always used p_-prefixed param names (matches
// lib/filters.ts's toParams(), plus manual p_group_by/p_limit/p_search in
// page code) — presoft-api uses clean REST names. Stripped here so no page
// code has to change.
function toQueryString(params?: Record<string, unknown>): string {
  if (!params) return ''
  const usp = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    const cleanKey = key.startsWith('p_') ? key.slice(2) : key
    if (value === null || value === undefined || value === '') {
      if (cleanKey === 'limit') usp.set('limit', String(NO_LIMIT))
      continue
    }
    usp.set(cleanKey, String(value))
  }
  const qs = usp.toString()
  return qs ? `?${qs}` : ''
}

interface RpcResult<T = unknown> {
  data: T | null
  error: { message: string } | null
}

export function createClient() {
  return {
    // Defaults to `any`, matching @supabase/supabase-js's own default —
    // callers like `data?.[0]` (see every page's fetchOptions()) rely on
    // this being permissive unless a call site passes an explicit <T>.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async rpc<T = any>(name: string, params?: Record<string, unknown>): Promise<RpcResult<T>> {
      try {
        // Name-to-path mapping, the API key, and the filter-options
        // array-wrapping quirk all live server-side now, in
        // app/api/presoft/[name]/route.ts.
        const res = await fetch(`/api/presoft/${name}${toQueryString(params)}`)
        const body = await res.json().catch(() => ({}) as { error?: string })
        if (!res.ok) {
          return { data: null, error: { message: (body as { error?: string }).error ?? `Request failed (${res.status})` } }
        }
        return { data: body as T, error: null }
      } catch (err) {
        return { data: null, error: { message: err instanceof Error ? err.message : 'Unknown error — is the dashboard server running?' } }
      }
    },
  }
}
