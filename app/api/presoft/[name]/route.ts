// Server-side proxy between the dashboard's browser code and
// autocount-write-service (sibling repo), which reads the AutoCount account
// book directly.
//
// The aggregation itself lives in that service's ReportsController, in SQL
// against the account book — not here. This route only maps the dashboard's
// legacy RPC names onto its report endpoints and reshapes the JSON into
// what the pages already consume. That is deliberate: computing revenue by
// pulling every document over HTTP and summing it in Node was both far
// slower and unable to see documents the API didn't expose.
//
// The API key never reaches the browser: only this server-side route reads
// it, via lib/presoft-api.ts.
import { NextRequest, NextResponse } from 'next/server'
import { apiFetch } from '@/lib/presoft-api'

// The service reports in the account book's own currency and exposes no
// currency column on its aggregates, so every row is labelled with this.
const REPORTING_CURRENCY = 'MYR'

// lib/db/client.ts sends this in place of "no limit" (the old Postgres RPCs
// took null; a REST query string has no null). Anything this large means
// "every row", not a genuine cap.
const NO_LIMIT_SENTINEL = 2147483647

interface Row {
  [key: string]: unknown
}

function num(value: unknown): number {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? n : 0
}

function str(value: unknown): string {
  return value == null ? '' : String(value)
}

// Passes through the dashboard's date range and limit under the names the
// reports endpoints expect.
function reportQuery(params: URLSearchParams, extra: Record<string, string> = {}): string {
  const qs = new URLSearchParams()
  const from = params.get('date_from')
  const to = params.get('date_to')
  if (from) qs.set('fromDate', from)
  if (to) qs.set('toDate', to)

  const limit = params.get('limit')
  if (limit) {
    const n = Number(limit)
    if (Number.isFinite(n) && n > 0 && n < NO_LIMIT_SENTINEL) qs.set('limit', String(n))
  }

  for (const [key, value] of Object.entries(extra)) qs.set(key, value)
  const s = qs.toString()
  return s ? `?${s}` : ''
}

function groupBy(params: URLSearchParams): string {
  const raw = params.get('group_by')
  return raw === 'group' || raw === 'type' ? raw : 'item'
}

class ReportError extends Error {}

async function getReport<T = Row[]>(path: string): Promise<T> {
  const { res, error } = await apiFetch(`/api/reports/${path}`)
  if (error) throw new ReportError('Unable to reach autocount-write-service')
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new ReportError(text ? `autocount-write-service: ${text.slice(0, 300)}` : `autocount-write-service returned ${res.status}`)
  }
  return (await res.json()) as T
}

type Handler = (params: URLSearchParams) => Promise<unknown>

const HANDLERS: Record<string, Handler> = {
  get_kpi_summary_v2: async (params) => {
    const kpi = await getReport<Row>(`kpi-summary${reportQuery(params)}`)
    return [
      {
        currency: REPORTING_CURRENCY,
        total_revenue: num(kpi.totalRevenue),
        credit_note_total: num(kpi.creditNoteTotal),
        total_purchase: num(kpi.totalPurchase),
      },
    ]
  },

  get_monthly_trend_v2: async (params) => {
    const rows = await getReport(`monthly${reportQuery(params)}`)
    return rows.map((r) => ({
      year: num(r.year),
      month: num(r.month),
      currency: REPORTING_CURRENCY,
      revenue: num(r.revenue),
    }))
  },

  // The breakdown table and the trend chart show the same monthly figures.
  get_monthly_breakdown_v2: (params) => HANDLERS.get_monthly_trend_v2(params),

  get_item_revenue_v2: async (params) => {
    const rows = await getReport(`items${reportQuery(params, { groupBy: groupBy(params) })}`)
    return rows.map((r) => ({
      bucket_name: str(r.bucketName),
      currency: REPORTING_CURRENCY,
      qty: num(r.qty),
      revenue: num(r.amount),
    }))
  },

  get_item_best_sellers_v2: (params) => HANDLERS.get_item_revenue_v2(params),

  get_performance_item_v2: async (params) => {
    const rows = await getReport(`items${reportQuery(params, { groupBy: groupBy(params) })}`)
    return rows.map((r) => ({
      name: str(r.bucketName),
      currency: REPORTING_CURRENCY,
      qty: num(r.qty),
      revenue: num(r.amount),
    }))
  },

  get_performance_sales_agent_v2: async (params) => {
    const rows = await getReport(`agents${reportQuery(params)}`)
    return rows.map((r) => ({ name: str(r.name), currency: REPORTING_CURRENCY, revenue: num(r.amount) }))
  },

  get_performance_debtor_v2: async (params) => {
    const rows = await getReport(`debtors${reportQuery(params)}`)
    return rows.map((r) => ({ name: str(r.name), currency: REPORTING_CURRENCY, revenue: num(r.amount) }))
  },

  get_purchase_item_v2: async (params) => {
    const rows = await getReport(`purchase-items${reportQuery(params, { groupBy: groupBy(params) })}`)
    return rows.map((r) => ({
      name: str(r.bucketName),
      currency: REPORTING_CURRENCY,
      qty: num(r.qty),
      purchase: num(r.amount),
    }))
  },

  get_purchase_creditor_v2: async (params) => {
    const rows = await getReport(`creditors${reportQuery(params)}`)
    // No qty: creditor figures come off AP document headers, and the AP
    // ledger has no quantity column at all.
    return rows.map((r) => ({ name: str(r.name), currency: REPORTING_CURRENCY, purchase: num(r.amount) }))
  },

  get_filter_options_v2: async () => {
    const options = await getReport<Row>('filter-options')
    const entities = (value: unknown) =>
      (Array.isArray(value) ? (value as Row[]) : []).map((r) => ({ id: str(r.id), name: str(r.name) || str(r.id) }))
    const strings = (value: unknown) => (Array.isArray(value) ? value.map((v) => str(v)).filter(Boolean) : [])
    const date = (value: unknown) => (value ? String(value).slice(0, 10) : null)

    return {
      // The Location filter was removed from every page except Item, and
      // the reports service doesn't return locations at all.
      locations: [],
      items: entities(options.items),
      sales_agents: entities(options.salesAgents),
      debtors: entities(options.debtors),
      creditors: entities(options.creditors),
      item_groups: strings(options.itemGroups),
      item_types: strings(options.itemTypes),
      currencies: strings(options.currencies).length ? strings(options.currencies) : [REPORTING_CURRENCY],
      date_min: date(options.dateMin),
      date_max: date(options.dateMax),
    }
  },

  get_item_catalog_v2: async (params) => {
    const options = await getReport<Row>('filter-options')
    const search = params.get('search')?.trim().toLowerCase()
    const items = Array.isArray(options.items) ? (options.items as Row[]) : []
    return items
      .filter((item) => !search || str(item.id).toLowerCase().includes(search))
      .map((item) => ({ item_id: str(item.id), item_code: str(item.id), item_group: null, item_type: null }))
  },
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params
  const handler = HANDLERS[name]
  if (!handler) {
    return NextResponse.json({ error: `Unknown RPC: ${name} (no report endpoint mapped)` }, { status: 400 })
  }

  try {
    const data = await handler(request.nextUrl.searchParams)
    // get_filter_options_v2's Postgres original returned RETURNS TABLE (a
    // single row), so every page reads it via `data?.[0]` — keep that shape.
    return NextResponse.json(name === 'get_filter_options_v2' ? [data] : data)
  } catch (err) {
    const message = err instanceof ReportError ? err.message : 'Report request failed'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
