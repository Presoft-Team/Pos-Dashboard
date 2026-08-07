// Types for schema_v2 / rpc_v2 — see PLAN.md and supabase/schema_v2.sql.

export interface EntityOption {
  id: string
  name: string
}

export interface FilterOptions {
  branches: EntityOption[]
  items: EntityOption[]
  sales_agents: EntityOption[]
  debtors: EntityOption[]
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
  branch: string
  item: string
  sales_agent: string
  debtor: string
  item_group: string
  item_type: string
  currency: string
}

export type GroupByMode = 'item' | 'group' | 'type'

// --- Sales Dashboard ---------------------------------------------------

export interface KpiSummary {
  currency: string
  cash_revenue: number
  credit_revenue: number
  total_revenue: number     // cash_revenue + credit_revenue
  total_purchase: number    // actual PI/PIDTL purchase spend, same filters
}

// One row per (bucket, currency) — bucket is an item name, an item group,
// or an item type, depending on the active GroupByMode. Total value only
// (Cash/Credit split, same shape as ItemBestSellerRow below).
export interface ItemRevenueRow {
  bucket_name: string
  currency: string
  credit_qty: number
  cash_qty: number
  credit_revenue: number
  cash_revenue: number
}

// Best Sellers table row — Cash/Credit split (not the chart's
// Paid/Not-due/Overdue split). bucket_name is an item/group/type name
// depending on the active GroupByMode.
export interface ItemBestSellerRow {
  bucket_name: string
  currency: string
  credit_qty: number
  cash_qty: number
  credit_revenue: number
  cash_revenue: number
}

// --- Monthly Sales -------------------------------------------------------

export interface MonthlyTrendRow {
  year: number
  month: number
  currency: string
  cash_revenue: number
  credit_revenue: number
}

export interface MonthlyBreakdownRow {
  year: number
  month: number
  currency: string
  credit_revenue: number
  cash_revenue: number
  credit_qty: number
  cash_qty: number
}

// --- Performance page ------------------------------------------------

// Shared row shape across all 4 dimensions (Branch/Item/Sales Agent/
// Debtor) — `name` is whichever entity that table represents.
export interface PerformanceRow {
  name: string
  currency: string
  credit_qty: number
  cash_qty: number
  credit_revenue: number
  cash_revenue: number
}

// --- Item page -----------------------------------------------------------

export interface ItemCatalogRow {
  item_id: string
  item_code: string
  description: string
  item_group: string | null
  item_type: string | null
  branch_name: string | null
  qty_on_hand: number
  cost: number
  unit_price: number
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
