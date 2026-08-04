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
  branch: string
  item: string
  sales_agent: string
  debtor: string
  creditor: string
  item_group: string
  item_type: string
  currency: string
}

export type GroupByMode = 'item' | 'group' | 'type'

export type PerformanceDimension = 'branch' | 'item' | 'sales_agent' | 'debtor' | 'creditor'

// --- Sales Dashboard ---------------------------------------------------

export interface KpiSummary {
  currency: string
  revenue_paid: number      // Cash + Credit-Paid
  revenue_not_due: number   // Credit, unpaid, not due
  revenue_overdue: number   // Credit, unpaid, overdue
  total_cost: number        // quantity * items.cost, all sales combined
  cash_qty: number
  credit_qty: number
  cash_transactions: number
  credit_transactions: number
}

// One row per (bucket, currency) — bucket is an item name, an item group,
// or an item type, depending on the active GroupByMode.
export interface ItemRevenueRow {
  bucket_name: string
  currency: string
  revenue_paid: number
  revenue_not_due: number
  revenue_overdue: number
  qty_paid: number
  qty_not_due: number
  qty_overdue: number
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
  total_revenue: number
  revenue_paid: number
  revenue_not_due: number
  revenue_overdue: number
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

// Shared row shape across all 5 dimensions (Branch/Item/Sales Agent/
// Debtor/Creditor) — `name` is whichever entity that table represents.
// `id` is null when grouped by Item Group/Item Type (no single entity id
// applies), in which case that row isn't click-to-focusable.
export interface PerformanceRow {
  id: string | null
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
  qty_sold: number
}
