// Types for schema_v2 / rpc_v2 — see PLAN.md and supabase/schema_v2.sql.

export interface EntityOption {
  id: string
  name: string
}

// The API also returns a `locations` list, but nothing consumes it — the
// Location filter and the Location breakdowns were removed from every page.
export interface FilterOptions {
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
// Performance, Purchase, and Item pages. Entity fields hold an id (or '' for
// "all"). Not every page shows every field (e.g. Purchase hides
// sales_agent, shows creditor instead of debtor) — see FilterBar's
// showSalesAgent/showDebtor/showCreditor props.
export interface Filters {
  date_from: string
  date_to: string
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

export interface KpiSummary {
  currency: string
  cash_revenue: number
  credit_revenue: number
  total_revenue: number     // cash_revenue + credit_revenue
  cash_purchase: number
  credit_purchase: number
  total_purchase: number    // cash_purchase + credit_purchase
}

// One row per (bucket, currency) — bucket is an item name, an item group,
// or an item type, depending on the active GroupByMode. Same shape as
// ItemBestSellerRow below.
//
// NOTE (applies to every row type here): the API splits amounts and
// quantities by payment type, but the dashboard never displays that split —
// every screen and export sums cash + credit into one figure. The fields
// stay as the API's wire shape; do the summing at the point of display.
export interface ItemRevenueRow {
  bucket_name: string
  currency: string
  credit_qty: number
  cash_qty: number
  credit_revenue: number
  cash_revenue: number
}

// Best Sellers table row — bucket_name is an item/group/type name depending
// on the active GroupByMode.
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

// Shared row shape across all 3 dimensions (Item/Sales Agent/Debtor) —
// `name` is whichever entity that table represents.
export interface PerformanceRow {
  name: string
  currency: string
  credit_qty: number
  cash_qty: number
  credit_revenue: number
  cash_revenue: number
}

// --- Purchase page ---------------------------------------------------

// Purchase-side twin of PerformanceRow — Item/Group/Type and Creditor
// (instead of Debtor), no Sales Agent (not a
// purchase-side concept). Named credit_purchase/cash_purchase, not
// credit_revenue/cash_revenue — this is purchase spend, not revenue, and
// reusing the revenue field names here would misrepresent what the number
// means to anyone reading the API response.
export interface PurchaseRow {
  name: string
  currency: string
  credit_qty: number
  cash_qty: number
  credit_purchase: number
  cash_purchase: number
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

// The /test page's old row types lived here. They went away with the
// direct-to-SQL-Server verification queries (lib/mssql.ts): /test now only
// checks the presoft-api connection, and shapes its responses inline.
