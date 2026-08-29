// Types for schema_v2 / rpc_v2 — see PLAN.md and supabase/schema_v2.sql.

export interface EntityOption {
  id: string
  name: string
}

export interface FilterOptions {
  // dbo.Location — the Item page is the only consumer left: it filters stock
  // by Location code. The shared FilterBar's Location filter and the
  // Location breakdowns on Performance/Purchase were both removed.
  locations: EntityOption[]
  items: EntityOption[]
  sales_agents: EntityOption[]
  debtors: EntityOption[]
  // Purchase page's twin of debtors — dbo.Creditor, not dbo.Debtor.
  creditors: EntityOption[]
  item_groups: string[]
  item_types: string[]
  currencies: string[]
  date_min: string | null
  date_max: string | null
}

// The Global FilterBar (PLAN.md Section 3) — shared by Dashboard, Monthly,
// Performance, and Item pages. Entity fields hold an id (or '' for "all").
export interface Filters {
  date_from: string
  date_to: string
  // Written and read by the Item page alone. toParams() deliberately leaves
  // it out, so a location picked on Item never silently narrows the sales/
  // purchase pages that share this state.
  location: string
  item: string
  sales_agent: string
  debtor: string
  creditor: string
  item_group: string
  item_type: string
  currency: string
}

export type GroupByMode = 'item' | 'group' | 'type'

// --- Sales Dashboard ---------------------------------------------------

// Every row type below is produced by lib/presoft-aggregate.ts, not by the
// company API directly — that API returns documents, so the dashboard's
// own server routes do the aggregating. Two consequences show up in these
// shapes:
//
//   - No cash/credit split. Revenue follows the AR ledger, where the
//     distinction doesn't exist as a column.
//   - No quantity outside the item rows. AR documents carry amounts only;
//     qty exists solely on stock-document lines (see ItemBucketRow).
export interface KpiSummary {
  currency: string
  // ARInvoice + ARDebitNote - ARCreditNote - ARRefund, counting only detail
  // lines whose AccNo is in the 5xxxx revenue range.
  total_revenue: number
  // Credit notes alone (ARCN + CN), as a positive magnitude. Already
  // subtracted inside total_revenue — the tile reports it, it does not
  // re-apply it.
  credit_note_total: number
  // APInvoice + APDebitNote - APCreditNote - PurchaseReturn, counting only
  // detail lines whose AccNo is in the 6xxxx range. Shown on the Purchase
  // page, not on the Sales Dashboard.
  total_purchase: number
}

// One row per bucket — an item, item group, or item type, depending on the
// active GroupByMode. Reached by linking each AR document to the stock
// document sharing its DocNo, so these figures cover only AR documents that
// have a stock twin and will total less than total_revenue.
export interface ItemBucketRow {
  bucket_name: string
  currency: string
  qty: number
  revenue: number
}

// --- Monthly Sales -------------------------------------------------------

// Used by both the trend chart and the breakdown table — the same monthly
// revenue figure, so there is no separate breakdown shape any more.
export interface MonthlyRow {
  year: number
  month: number
  currency: string
  revenue: number
}

// --- Performance page ------------------------------------------------

// Sales Agent and Debtor breakdowns. Both read AR document headers, which
// have no quantity — hence revenue only.
export interface PerformanceRow {
  name: string
  currency: string
  revenue: number
}

// The Item breakdown is the one Performance dimension sourced from stock
// lines rather than AR headers, so it alone can report a quantity.
export interface PerformanceItemRow extends PerformanceRow {
  qty: number
}

// --- Purchase page ---------------------------------------------------

// Purchase-side twin of PerformanceRow — Item/Group/Type and Creditor
// (instead of Debtor), no Sales Agent (not a purchase-side concept).
// Named credit_purchase/cash_purchase, not credit_revenue/cash_revenue —
// this is purchase spend, not revenue.
//
// Still the pre-migration shape: the Purchase page has not been moved onto
// the company API yet, so nothing serves these rows today (see the purchase
// RPCs missing from app/api/presoft/[name]/route.ts). Wiring it up means
// aggregating APInvoice + APDebitNote - APCreditNote, mirroring the AR side
// in lib/presoft-aggregate.ts.
// Creditor breakdown. `purchase` rather than `revenue` — this is spend, not
// income. No qty: it reads AP document headers, and the AP ledger has no
// quantity column at all.
export interface PurchaseRow {
  name: string
  currency: string
  purchase: number
}

// The Item breakdown is the one Purchase dimension sourced from stock lines
// (PIDTL/CPDTL/PRDTL) rather than AP headers, so it alone reports a qty.
export interface PurchaseItemRow extends PurchaseRow {
  qty: number
}

// The Purchase page's KPI tiles read the same get_kpi_summary_v2 response
// as the Sales Dashboard; this is the subset of it they use.
export interface PurchaseKpiSummary {
  currency: string
  total_purchase: number
  total_revenue: number
}

// --- Item page -----------------------------------------------------------

// Item.CostingMethod (tinyint), confirmed against real AutoCount data —
// not documented anywhere in the schema itself. Fixed Cost items show one
// cost item-wide ("Standard Cost"); every other method's cost varies per
// location instead ("Up to Date Cost" — see ItemCatalogRow.cost).
export type CostingMethod = 0 | 1 | 2 | 3

export interface ItemCatalogRow {
  item_id: string
  item_code: string
  description: string
  item_group: string | null
  item_type: string | null
  costing_method: CostingMethod
  // Item.Image (varbinary(max) — real JPEG data, confirmed against real
  // data) isn't inlined here, only whether one exists. Fetch the actual
  // photo from /api/presoft/items/{item_code}/image, only when this is true.
  has_image: boolean
  // dbo.Location — a separate master table/code space from Branch. StockDTL
  // has no Branch column, so this is not the same as a sales-doc branch.
  // qty_on_hand is summed across UOM/batch into one total per location.
  location_name: string | null
  qty_on_hand: number
  // Standard Cost (Fixed Cost items) or Up to Date Cost (Weighted
  // Average/FIFO/LIFO) depending on costing_method — see items.ts in
  // presoft-api. Fixed Cost repeats the same value on every row for an
  // item; every other method can differ per location_name.
  cost: number
  // unit_price is ItemUOM's tier-1 Price, same value as price1 below — kept
  // as its own field since it's what price_desc/price_asc sorting uses.
  unit_price: number
  // ItemUOM's six price tiers. A tier that's NULL in the database stays
  // null here (never coerced to 0), so "not set" is distinguishable from
  // "priced at 0" — hide, don't zero-fill, when rendering.
  price1: number | null
  price2: number | null
  price3: number | null
  price4: number | null
  price5: number | null
  price6: number | null
  // Min/max across whichever tiers are actually set (NULL tiers excluded,
  // but an explicit 0 on a tier counts) — null only when every tier is null.
  min_price: number | null
  max_price: number | null
}

// --- /test page (ad-hoc verification, not part of rpc_v2) ---------------

export interface CreditPaidInvoiceRow {
  doc_no: string
  order_date: string
  debtor_id: string
  branch_id: string
  sales_agent_id: string
  currency: string
  due_date: string | null
  outstanding: number
  revenue: number
}

export interface RevenueJoinIntegrityRow {
  check_name: string
  orphan_count: number
}
