// Drop-in replacement for `createClient().rpc(name, params)` from
// @supabase/supabase-js (lib/supabase/client.ts) — but instead of calling
// this app's own internal /api/rpc/[name] dispatcher, this calls the
// standalone presoft-api service's REST endpoints directly (by request —
// see PLAN.md §8). Page components that only ever called `supabase.rpc(...)`
// need no other changes. Client-safe (no 'server-only', no mssql import) —
// this fetch happens straight from the browser to presoft-api, which is why
// presoft-api has CORS enabled.
'use client'

const API_BASE = process.env.NEXT_PUBLIC_PRESOFT_API_URL ?? 'http://localhost:4000'

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

// Maps the old Postgres RPC names every page still calls (unchanged) to
// presoft-api's REST paths.
const RPC_TO_PATH: Record<string, string> = {
  get_filter_options_v2: '/api/v1/filter-options',
  get_kpi_summary_v2: '/api/v1/kpi-summary',
  get_item_revenue_v2: '/api/v1/sales/revenue',
  get_item_best_sellers_v2: '/api/v1/sales/best-sellers',
  get_monthly_trend_v2: '/api/v1/sales/monthly-trend',
  get_monthly_breakdown_v2: '/api/v1/sales/monthly-breakdown',
  get_performance_location_v2: '/api/v1/performance/locations',
  get_performance_item_v2: '/api/v1/performance/items',
  get_performance_sales_agent_v2: '/api/v1/performance/sales-agents',
  get_performance_debtor_v2: '/api/v1/performance/debtors',
  get_item_catalog_v2: '/api/v1/items',
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
      const path = RPC_TO_PATH[name]
      if (!path) {
        return { data: null, error: { message: `Unknown RPC: ${name} (no presoft-api route mapped)` } }
      }
      try {
        const res = await fetch(`${API_BASE}${path}${toQueryString(params)}`)
        if (!res.ok) {
          const body = await res.json().catch(() => ({}) as { error?: string })
          return { data: null, error: { message: body.error ?? `Request failed (${res.status})` } }
        }
        let data = await res.json()
        // get_filter_options_v2's Postgres original returned RETURNS TABLE
        // (a single row), so every page reads it via `data?.[0]` —
        // presoft-api returns a plain object for this one; wrap it to match.
        if (name === 'get_filter_options_v2') data = [data]
        return { data: data as T, error: null }
      } catch (err) {
        return { data: null, error: { message: err instanceof Error ? err.message : 'Unknown error — is presoft-api running?' } }
      }
    },
  }
}
