// Server-side proxy between the dashboard's browser code and presoft-api.
// Replaces browser -> presoft-api direct calls (lib/db/client.ts used to
// fetch presoft-api's own URL straight from the client) so the API key
// required by presoft-api's /api/v1/* (see its src/middleware/apiKey.ts)
// never reaches the browser bundle — only this server-side route ever
// reads it. Not covered by proxy.ts's matcher (which excludes /api), so
// this route does its own session + tenant-config resolution.
import { NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth/jwt'
import { getTenantApiConfig, tenantApiHeaders } from '@/lib/presoft-api'

// Maps the old Postgres RPC names every dashboard page still calls
// (unchanged, via lib/db/client.ts) to presoft-api's REST paths.
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
  get_purchase_item_v2: '/api/v1/purchase/items',
  get_purchase_location_v2: '/api/v1/purchase/locations',
  get_purchase_creditor_v2: '/api/v1/purchase/creditors',
  get_item_catalog_v2: '/api/v1/items',
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params
  const path = RPC_TO_PATH[name]
  if (!path) {
    return NextResponse.json({ error: `Unknown RPC: ${name} (no presoft-api route mapped)` }, { status: 400 })
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value
  const user = token ? verifySessionToken(token) : null
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const tenantConfig = await getTenantApiConfig(user.businessId)
  if (!tenantConfig) {
    return NextResponse.json({ error: 'This business has not configured its presoft-api connection yet' }, { status: 409 })
  }

  let apiRes: Response
  try {
    apiRes = await fetch(`${tenantConfig.apiUrl}${path}${request.nextUrl.search}`, {
      headers: tenantApiHeaders(tenantConfig.apiKey),
    })
  } catch {
    return NextResponse.json({ error: 'Unable to reach presoft-api' }, { status: 502 })
  }

  const body = await apiRes.json().catch(() => ({}))
  if (!apiRes.ok) {
    return NextResponse.json(body, { status: apiRes.status })
  }

  // get_filter_options_v2's Postgres original returned RETURNS TABLE (a
  // single row), so every page reads it via `data?.[0]` — presoft-api
  // returns a plain object for this one; wrap it to match.
  const data = name === 'get_filter_options_v2' ? [body] : body
  return NextResponse.json(data)
}
