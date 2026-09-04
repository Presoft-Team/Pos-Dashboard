// Types for schema_v2 / rpc_v2 — see PLAN.md and supabase/schema_v2.sql.

export interface EntityOption {
  id: string
  name: string
}

export interface FilterOptions {
  // dbo.Location — the Item page is the only consumer left: it filters stock
  // by Location code. The shared FilterBar's Location filter and the
  // Location breakdowns on Sales/Purchase were both removed.
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

// The Global FilterBar (PLAN.md Section 3) — shared by Monthly (the landing
// page), Sales, Purchase, and Item. Entity fields hold an id (or '' for "all").
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

// --- Sales page KPIs / shared aggregates --------------------------------

// Every row type below is produced by lib/presoft-aggregate.ts, not by the
// company API directly — that API returns documents, so the dashboard's
// own server routes do the aggregating. Two consequences show up in these
// shapes:
//
//   - No cash/credit split. Revenue follows the AR ledger, where the
//     distinction doesn't exist as a column.
//   - No quantity outside the item rows. AR documents carry amounts only;
//     qty exists solely on stock-document lines (see PerformanceItemRow).
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
  // page, not on the Sales page.
  total_purchase: number
}

// --- Monthly Sales -------------------------------------------------------

// Used by both the trend chart and the breakdown table — the same monthly
// figures, so there is no separate breakdown shape any more.
export interface MonthlyRow {
  year: number
  month: number
  currency: string
  revenue: number
  // Purchase spend for the same month, from the AP/stock-purchase side.
  // A month can legitimately have one and not the other (spend in a month
  // with no sales, or vice versa) — the missing side comes back as 0
  // rather than as an absent row.
  purchase: number
}

// --- Sales page (was Performance) -------------------------------------

// Sales Agent and Debtor breakdowns. Both read AR document headers, which
// have no quantity — hence revenue only.
export interface PerformanceRow {
  name: string
  // The entity's own identifier, for drilling into its detail overlay:
  // the debtor's AccNo, or the agent's own name (agents have no master
  // table, so the name *is* the key). Absent on the Item breakdown, whose
  // bucket may be a group/type label rather than a single entity.
  code?: string
  currency: string
  revenue: number
}

// The Item breakdown is the one Performance dimension sourced from stock
// lines rather than AR headers, so it alone can report a quantity.
export interface PerformanceItemRow extends PerformanceRow {
  qty: number
}

// --- Multi Dimension Sales Analysis ---------------------------------------

// One row per sales document line, carrying every dimension the analysis
// panel's Columns tab can show — a flat line browser (get_sales_analysis_v2),
// not an aggregate, so the dashboard can group/pivot by whichever fields the
// user drags in. Deliberately not de-duplicated against the AR ledger like
// the breakdown aggregates are; a document with 3 lines appears 3 times.
export interface SalesAnalysisRow {
  doc_no: string
  doc_date: string
  doc_type: string
  debtor_code: string
  company_name: string
  debtor_sales_agent: string
  debtor_type: string
  area_code: string
  branch_code: string
  branch_name: string
  item_code: string
  item_description: string
  item_description_2: string
  item_group: string
  item_type: string
  item_brand: string
  item_class: string
  item_category: string
  item_location: string
  item_batch_no: string
  serial_no: string
  uom: string
  project: string
  department: string
  acc_no: string
  ship_via: string
  shipping_info: string
  main_supplier: string
  main_supplier_desc: string
  qty: number
  smallest_qty: number
  foc_qty: number
  unit_price: number
  discount: string
  sub_total: number
  local_sub_total: number
  local_total_cost: number
  local_profit: number
  profit_margin: number
  currency: string
}

// --- Recent Sales / Recent Purchases -------------------------------------

// One row per document, rather than per bucket — the un-collapsed form of
// the same de-duplicated document set every aggregate above is summed from,
// so a list's amounts and the KPI tiles always agree.
//
// `amount` is signed: a credit note / purchase return arrives negative,
// which is what makes the rows add up to the totals shown elsewhere.
export interface DocumentRow {
  doc_no: string
  // ISO datetime as stored (DocDate is a datetime, not a date) — render the
  // date part only.
  doc_date: string
  // Human label, not an AutoCount table code: 'Invoice', 'Cash Sale',
  // 'Credit Note', 'Purchase Invoice', … A document that exists only in the
  // ledger (no stock twin) reads 'AR Invoice' / 'AP Invoice' instead.
  doc_type: string
  // Debtor on the sales side, creditor on the purchase side. Falls back to
  // the raw account code, then to '(No Debtor)'/'(No Creditor)'.
  party_name: string
  party_code: string
  // Sales side only — always '' for purchases, where sales agent isn't a
  // concept. Empty on a credit note too: ARCN carries no SalesAgent.
  agent: string
  currency: string
  amount: number
}

// One item line of a document, for the document detail overlay. Only stock
// documents (IV/CS/DN/CN, PI/CP/PR) have these — a pure ledger document
// carries account postings instead, and returns no lines at all.
export interface DocumentLineRow {
  seq: number
  item_code: string
  description: string
  qty: number
  uom: string
  unit_price: number
  amount: number
  // From the document header (SalesLocation / PurchaseLocation), so every
  // line of one document shares it — AutoCount doesn't vary it per line.
  location: string
  currency: string
}

// --- Debtor / Creditor pages ---------------------------------------------

// Debtor and Creditor are the same shape in AutoCount down to the column
// names, so one row type serves both pages. Almost every field is nullable:
// these are optional fields on the master record, and a book that only fills
// in a name and a credit limit is perfectly normal — render "not set" by
// omitting the field, never by printing an empty string.
export interface PartyCatalogRow {
  acc_no: string
  company_name: string
  name2: string
  // Debtor.DebtorType / Creditor.CreditorType.
  party_type: string
  register_no: string
  address1: string
  address2: string
  address3: string
  address4: string
  post_code: string
  phone1: string
  phone2: string
  mobile: string
  fax1: string
  email: string
  website: string
  attention: string
  // Debtor.SalesAgent / Creditor.PurchaseAgent — the agent assigned to this
  // party on the master record, not derived from any document.
  agent: string
  // Debtor.DisplayTerm, e.g. "C.O.D.", "30 Days".
  credit_term: string
  credit_limit: number
  currency: string
  is_active: boolean
  // Summed from the invoice and debit-note ledgers. Credit notes and
  // payments are already netted into those rows' own Outstanding column, so
  // this is the live balance, not a gross total.
  outstanding: number
}

// --- Sales Agent page ----------------------------------------------------

// AutoCount has no sales-agent master table — SalesAgent is a plain column
// on sales documents — so this row is entirely derived from activity. There
// is no address, phone, or credit term to show, unlike PartyCatalogRow.
export interface SalesAgentCatalogRow {
  name: string
  revenue: number
  currency: string
  document_count: number
  // Distinct debtors this agent actually billed in the date range.
  debtor_count: number
  first_doc_date: string
  last_doc_date: string
  // Debtors whose master record names this agent (Debtor.SalesAgent).
  // Independent of the date range, and can be 0 while revenue is not —
  // an agent can sell to debtors who aren't formally assigned to them.
  assigned_debtors: number
  has_image: boolean
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
