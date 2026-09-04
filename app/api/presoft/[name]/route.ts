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

// Shared by both document lists — the two endpoints return the same columns,
// with `agent` simply always empty on the purchase side.
// The label the report uses for lines carrying no item at all. It's a
// bucket, not an item code, so it never gets a drillable code.
const NO_ITEM_LABEL = '(No Item)'

function itemCode(bucketName: string, mode: string): string {
  return mode === 'item' && bucketName !== NO_ITEM_LABEL ? bucketName : ''
}

function documentRows(rows: Row[]) {
  return rows.map((r) => ({
    doc_no: str(r.docNo),
    doc_date: str(r.docDate),
    doc_type: str(r.docType),
    party_name: str(r.partyName),
    party_code: str(r.partyCode),
    agent: str(r.agent),
    currency: REPORTING_CURRENCY,
    amount: num(r.amount),
  }))
}

// search/sort/limit for the master-data card lists. `withDates` adds the
// shared date range on top, for the one catalog (sales agents) whose figures
// are derived from documents rather than read off a master record.
function catalogQuery(params: URLSearchParams, withDates = false): string {
  const extra: Record<string, string> = {}
  for (const key of ['search', 'sort'] as const) {
    const value = params.get(key)
    if (value) extra[key] = value
  }
  if (withDates) return reportQuery(params, extra)

  // reportQuery would add fromDate/toDate, which the party catalogs don't
  // take — build the string from limit + extras alone.
  const qs = new URLSearchParams(extra)
  const limit = params.get('limit')
  if (limit) {
    const n = Number(limit)
    if (Number.isFinite(n) && n > 0 && n < NO_LIMIT_SENTINEL) qs.set('limit', String(n))
  }
  const s = qs.toString()
  return s ? `?${s}` : ''
}

// AutoCount stores these flags as 'T'/'F' chars, not bits.
function flag(value: unknown): boolean {
  return String(value ?? '').toUpperCase() === 'T'
}

// Debtor and Creditor return the same columns, so one mapper serves both.
// Null/empty stays as '' — the pages treat empty as "not set" and omit the
// field rather than rendering a blank row.
function partyCatalogRows(rows: Row[]) {
  return rows.map((r) => ({
    acc_no: str(r.accNo),
    company_name: str(r.companyName),
    name2: str(r.name2),
    party_type: str(r.partyType),
    register_no: str(r.registerNo),
    address1: str(r.address1),
    address2: str(r.address2),
    address3: str(r.address3),
    address4: str(r.address4),
    post_code: str(r.postCode),
    phone1: str(r.phone1),
    phone2: str(r.phone2),
    mobile: str(r.mobile),
    fax1: str(r.fax1),
    email: str(r.emailAddress),
    website: str(r.webURL),
    attention: str(r.attention),
    agent: str(r.agent),
    credit_term: str(r.creditTerm),
    credit_limit: num(r.creditLimit),
    currency: str(r.currencyCode) || REPORTING_CURRENCY,
    is_active: flag(r.isActive),
    outstanding: num(r.outstanding),
  }))
}

// The dashboard's snake_case filter names mapped onto the service's
// SalesFilter properties. Web API binds a complex type from the query string
// under its parameter name, hence the "filter." prefix on every key.
const SALES_FILTER_FIELDS: [string, string][] = [
  ['agent', 'Agent'],
  ['area', 'Area'],
  ['location', 'Location'],
  ['debtor', 'Debtor'],
  ['debtor_type', 'DebtorType'],
  ['item', 'Item'],
  ['item_group', 'ItemGroup'],
  ['item_type', 'ItemType'],
  ['item_brand', 'ItemBrand'],
  ['item_class', 'ItemClass'],
  ['item_category', 'ItemCategory'],
  ['project', 'Project'],
  ['dept', 'Dept'],
]

// Date range + every supplied filter, preserving multi-select as repeated
// query params rather than collapsing to one value.
function salesFilterQuery(params: URLSearchParams): URLSearchParams {
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

  for (const [incoming, property] of SALES_FILTER_FIELDS) {
    for (const value of params.getAll(incoming)) {
      if (value) qs.append(`filter.${property}`, value)
    }
  }
  return qs
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
      purchase: num(r.purchase),
    }))
  },

  // The breakdown table and the trend chart show the same monthly figures.
  get_monthly_breakdown_v2: (params) => HANDLERS.get_monthly_trend_v2(params),

  // The Item breakdown. get_item_revenue_v2 / get_item_best_sellers_v2 used
  // to sit here too, mapping the same `items` report onto a bucket_name/
  // revenue shape for the old Sales Dashboard's chart and Best Sellers
  // table; that page is gone and this handler serves the identical figures.
  get_performance_item_v2: async (params) => {
    const mode = groupBy(params)
    const rows = await getReport(`items${reportQuery(params, { groupBy: mode })}`)
    return rows.map((r) => ({
      name: str(r.bucketName),
      // Only in Item mode is the bucket a single drillable item — a Group
      // or Type bucket is a label over many, so it gets no code and the
      // dashboard leaves its row unclickable.
      code: itemCode(str(r.bucketName), mode),
      currency: REPORTING_CURRENCY,
      qty: num(r.qty),
      revenue: num(r.amount),
    }))
  },

  get_performance_sales_agent_v2: async (params) => {
    const rows = await getReport(`agents${reportQuery(params)}`)
    return rows.map((r) => ({
      name: str(r.name),
      code: str(r.code || r.name),
      currency: REPORTING_CURRENCY,
      revenue: num(r.amount),
    }))
  },

  get_performance_debtor_v2: async (params) => {
    const rows = await getReport(`debtors${reportQuery(params)}`)
    return rows.map((r) => ({
      name: str(r.name),
      // The AccNo behind the display name — what the detail overlay filters
      // this debtor's documents by, since CompanyName isn't unique.
      code: str(r.code),
      currency: REPORTING_CURRENCY,
      revenue: num(r.amount),
    }))
  },

  get_purchase_item_v2: async (params) => {
    const mode = groupBy(params)
    const rows = await getReport(`purchase-items${reportQuery(params, { groupBy: mode })}`)
    return rows.map((r) => ({
      name: str(r.bucketName),
      // See get_performance_item_v2 — only Item mode yields a drillable code.
      code: itemCode(str(r.bucketName), mode),
      currency: REPORTING_CURRENCY,
      qty: num(r.qty),
      purchase: num(r.amount),
    }))
  },

  get_purchase_creditor_v2: async (params) => {
    const rows = await getReport(`creditors${reportQuery(params)}`)
    // No qty: creditor figures come off AP document headers, and the AP
    // ledger has no quantity column at all.
    return rows.map((r) => ({
      name: str(r.name),
      code: str(r.code),
      currency: REPORTING_CURRENCY,
      purchase: num(r.amount),
    }))
  },

  // Recent Sales / Recent Purchases: one row per document instead of per
  // bucket. Both share a shape, so they share a mapper — `agent` is simply
  // always empty on the purchase side.
  get_recent_sales_v2: async (params) => {
    const extra: Record<string, string> = {}
    const agent = params.get('sales_agent')
    const debtor = params.get('debtor')
    const item = params.get('item')
    if (agent) extra.agent = agent
    if (debtor) extra.debtor = debtor
    if (item) extra.item = item
    return documentRows(await getReport(`sales-documents${reportQuery(params, extra)}`))
  },

  get_recent_purchases_v2: async (params) => {
    const extra: Record<string, string> = {}
    const creditor = params.get('creditor')
    const item = params.get('item')
    if (creditor) extra.creditor = creditor
    if (item) extra.item = item
    return documentRows(await getReport(`purchase-documents${reportQuery(params, extra)}`))
  },

  // Debtor / Creditor master-data card lists. Identical shapes — see
  // partyCatalogRows — so the two differ only in which report they read.
  get_debtor_catalog_v2: async (params) =>
    partyCatalogRows(await getReport(`debtors-catalog${catalogQuery(params)}`)),

  get_creditor_catalog_v2: async (params) =>
    partyCatalogRows(await getReport(`creditors-catalog${catalogQuery(params)}`)),

  // Sales agents. Unlike the two above this is date-ranged: with no master
  // table behind it, every figure is derived from documents in the range.
  get_sales_agent_catalog_v2: async (params) => {
    const rows = await getReport(`sales-agents-catalog${catalogQuery(params, true)}`)
    return rows.map((r) => ({
      name: str(r.name),
      revenue: num(r.revenue),
      currency: REPORTING_CURRENCY,
      document_count: num(r.documentCount),
      debtor_count: num(r.debtorCount),
      first_doc_date: str(r.firstDocDate),
      last_doc_date: str(r.lastDocDate),
      assigned_debtors: num(r.assignedDebtors),
      has_image: num(r.hasImage) === 1 || r.hasImage === true,
    }))
  },

  // The item lines of one document, for its detail overlay. `side` picks
  // the sales or purchase family of stock tables — a DocNo alone doesn't
  // say which it belongs to.
  get_document_lines_v2: async (params) => {
    const qs = new URLSearchParams({
      docNo: params.get('doc_no') ?? '',
      side: params.get('side') === 'purchase' ? 'purchase' : 'sales',
    })
    const rows = await getReport(`document-lines?${qs}`)
    return rows.map((r) => ({
      seq: num(r.seq),
      item_code: str(r.itemCode),
      description: str(r.description),
      qty: num(r.qty),
      uom: str(r.uom),
      unit_price: num(r.unitPrice),
      amount: num(r.amount),
      location: str(r.location),
      currency: REPORTING_CURRENCY,
    }))
  },

  // --- Sales sub-pages (by agent / area / location) --------------------

  // Sales grouped by one dimension, honouring the full multi-select filter
  // set. `sales_by` picks the dimension.
  get_sales_by_v2: async (params) => {
    const qs = salesFilterQuery(params)
    qs.set('by', params.get('sales_by') ?? 'agent')
    const rows = await getReport(`sales-by?${qs}`)
    return rows.map((r) => ({
      name: str(r.name),
      code: str(r.code),
      currency: REPORTING_CURRENCY,
      revenue: num(r.amount),
      // Only the item dimensions return a quantity — document-level rows
      // (agent/area/location) come from headers, which carry none, so this
      // is 0 there rather than a figure that looks real.
      qty: num(r.qty),
    }))
  },

  get_sales_documents_filtered_v2: async (params) =>
    documentRows(await getReport(`sales-documents-filtered?${salesFilterQuery(params)}`)),

  get_sales_filter_options_v2: async () => {
    const options = await getReport<Row>('sales-filter-options')
    const list = (value: unknown) =>
      (Array.isArray(value) ? (value as Row[]) : []).map((r) => ({
        id: str(r.id),
        // Codes are what the filters actually match on, so a description
        // alone would leave the user guessing which "Main" they picked.
        name: str(r.name) && str(r.name) !== str(r.id) ? `${str(r.id)} — ${str(r.name)}` : str(r.id),
      }))
    return [{
      agents: list(options.agents),
      areas: list(options.areas),
      locations: list(options.locations),
      debtors: list(options.debtors),
      debtor_types: list(options.debtorTypes),
      items: list(options.items),
      item_groups: list(options.itemGroups),
      item_types: list(options.itemTypes),
      item_brands: list(options.itemBrands),
      item_classes: list(options.itemClasses),
      item_categories: list(options.itemCategories),
      projects: list(options.projects),
      depts: list(options.depts),
    }]
  },

  // Line-level rows behind the Multi Dimension Sales Analysis panel — one
  // row per document line, carrying every dimension the panel's Columns tab
  // can show. `doc_types` arrives as repeated params (one per checked
  // Document Option); the report endpoint takes a single comma-joined list.
  get_sales_analysis_v2: async (params) => {
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

    const docTypes = params.getAll('doc_types')
    if (docTypes.length > 0) qs.set('docTypes', docTypes.join(','))

    const rows = await getReport(`sales-analysis?${qs}`)
    return rows.map((r) => ({
      doc_no: str(r.docNo),
      doc_date: str(r.docDate),
      doc_type: str(r.docType),
      debtor_code: str(r.debtorCode),
      company_name: str(r.companyName),
      debtor_sales_agent: str(r.debtorSalesAgent),
      debtor_type: str(r.debtorType),
      area_code: str(r.areaCode),
      branch_code: str(r.branchCode),
      branch_name: str(r.branchName),
      item_code: str(r.itemCode),
      item_description: str(r.itemDescription),
      item_description_2: str(r.itemDescription2),
      item_group: str(r.itemGroup),
      item_type: str(r.itemType),
      item_brand: str(r.itemBrand),
      item_class: str(r.itemClass),
      item_category: str(r.itemCategory),
      item_location: str(r.itemLocation),
      item_batch_no: str(r.itemBatchNo),
      serial_no: str(r.serialNoList),
      uom: str(r.uom),
      project: str(r.projNo),
      department: str(r.deptNo),
      acc_no: str(r.accNo),
      ship_via: str(r.shipVia),
      shipping_info: str(r.shippingInfo),
      main_supplier: str(r.mainSupplier),
      main_supplier_desc: str(r.mainSupplierDesc),
      qty: num(r.qty),
      smallest_qty: num(r.smallestQty),
      foc_qty: num(r.focQty),
      unit_price: num(r.unitPrice),
      discount: str(r.discount),
      sub_total: num(r.subTotal),
      local_sub_total: num(r.localSubTotal),
      local_total_cost: num(r.localTotalCost),
      local_profit: num(r.localProfit),
      profit_margin: num(r.profitMargin),
      currency: REPORTING_CURRENCY,
    }))
  },

  get_filter_options_v2: async () => {
    const options = await getReport<Row>('filter-options')
    const entities = (value: unknown) =>
      (Array.isArray(value) ? (value as Row[]) : []).map((r) => ({ id: str(r.id), name: str(r.name) || str(r.id) }))
    const strings = (value: unknown) => (Array.isArray(value) ? value.map((v) => str(v)).filter(Boolean) : [])
    const date = (value: unknown) => (value ? String(value).slice(0, 10) : null)

    return {
      // Only the Item page still has a Location filter; every other page
      // dropped the dimension.
      locations: entities(options.locations),
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

  // One row per (item, location). The Item page groups them back into one
  // card per item with a stock table underneath, so the per-item fields
  // repeat across an item's rows — that's expected, not duplication.
  get_item_catalog_v2: async (params) => {
    const qs = new URLSearchParams()
    for (const [from, to] of [
      ['search', 'search'],
      ['item', 'item'],
      ['item_group', 'itemGroup'],
      ['item_type', 'itemType'],
      ['location', 'location'],
      ['sort', 'sort'],
    ] as const) {
      const value = params.get(from)
      if (value) qs.set(to, value)
    }
    const limit = params.get('limit')
    if (limit) {
      const n = Number(limit)
      if (Number.isFinite(n) && n > 0 && n < NO_LIMIT_SENTINEL) qs.set('limit', String(n))
    }

    const rows = await getReport(`items-catalog${qs.toString() ? `?${qs}` : ''}`)
    // A price tier that is NULL in AutoCount stays null here rather than
    // being coerced to 0, so the page can tell "not set" from "priced at 0"
    // and hide the tier instead of showing a misleading zero.
    const money = (v: unknown): number | null => (v == null ? null : num(v))

    return rows.map((r) => ({
      item_id: str(r.itemCode),
      item_code: str(r.itemCode),
      description: str(r.description),
      item_group: r.itemGroup == null ? null : str(r.itemGroup),
      item_type: r.itemType == null ? null : str(r.itemType),
      costing_method: num(r.costingMethod),
      has_image: num(r.hasImage) === 1,
      location_name: r.locationName == null ? null : str(r.locationName),
      qty_on_hand: num(r.qtyOnHand),
      cost: num(r.cost),
      unit_price: num(r.unitPrice),
      price1: money(r.price1),
      price2: money(r.price2),
      price3: money(r.price3),
      price4: money(r.price4),
      price5: money(r.price5),
      price6: money(r.price6),
      min_price: money(r.minPrice),
      max_price: money(r.maxPrice),
    }))
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
