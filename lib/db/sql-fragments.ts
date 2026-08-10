// Shared T-SQL building blocks — the real-database equivalent of
// schema_v2.sql's `sales`/`purchases`/`items.cost`. See PLAN.md §2-§5 for
// the full mapping and reasoning behind every decision made here; this file
// is just the SQL those decisions compile down to. Do not duplicate this
// logic inline in a query file — import these fragments instead, so a
// future correction (e.g. once ARInvoice.SourceType is verified) only has
// to change one place.
import 'server-only'

// Unified sales shape (cash + credit + credit-note/debit-note netting),
// mirroring the old schema_v2.sql `sales` table. See PLAN.md §3. is_credit
// is derived per-row from the document's own DisplayTerm: DisplayTerm LIKE
// 'Net%day%' (matches 'Net 30 days', 'Net 90 days', any day count) -> credit,
// anything else (e.g. 'Cash') -> cash — confirmed against real Terms data.
// Not fixed by source table: a CS row can carry Net-day terms and an IV row
// can carry Cash terms, so the CTE name (cash/credit) reflects the source
// document, not the resulting is_credit value.
// No paid/unpaid/overdue tracking (that used to join ARInvoice for
// Outstanding/DueDate; dropped along with the paid/due_date columns).
// location_id comes from each doc's own SalesLocation (dbo.Location), not
// BranchCode — the app's "Branch" filter was replaced with a Location filter
// by explicit request, and SalesLocation is the real per-doc location FK
// (confirmed on CS/IV/CN/DN in dataColumnTable.md), not a stand-in.
// Columns: doc_no, is_credit, order_date, location_id, item_id,
// sales_agent_id, debtor_id, quantity, revenue, currency
export const SALES_CTE = `
cash AS (
  SELECT
    cs.DocNo AS doc_no,
    CASE WHEN cs.DisplayTerm LIKE 'Net%day%' THEN CAST(1 AS BIT) ELSE CAST(0 AS BIT) END AS is_credit,
    cs.DocDate AS order_date,
    cs.SalesLocation AS location_id, csd.ItemCode AS item_id, cs.SalesAgent AS sales_agent_id,
    cs.DebtorCode AS debtor_id, csd.Qty AS quantity, csd.SubTotal AS revenue,
    cs.CurrencyCode AS currency
  FROM CS cs
  JOIN CSDTL csd ON csd.DocKey = cs.DocKey
),
credit AS (
  SELECT
    iv.DocNo AS doc_no,
    CASE WHEN iv.DisplayTerm LIKE 'Net%day%' THEN CAST(1 AS BIT) ELSE CAST(0 AS BIT) END AS is_credit,
    iv.DocDate AS order_date,
    iv.SalesLocation AS location_id, ivd.ItemCode AS item_id, iv.SalesAgent AS sales_agent_id,
    iv.DebtorCode AS debtor_id, ivd.Qty AS quantity, ivd.SubTotal AS revenue,
    iv.CurrencyCode AS currency
  FROM IV iv
  JOIN IVDTL ivd ON ivd.DocKey = iv.DocKey
),
credit_notes AS (
  -- Revenue-only netting (qty untouched, by explicit request); is_credit
  -- from the CN's own DisplayTerm, same rule as cash/credit above.
  SELECT
    cn.DocNo AS doc_no,
    CASE WHEN cn.DisplayTerm LIKE 'Net%day%' THEN CAST(1 AS BIT) ELSE CAST(0 AS BIT) END AS is_credit,
    cn.DocDate AS order_date, cn.SalesLocation AS location_id, cnd.ItemCode AS item_id,
    cn.SalesAgent AS sales_agent_id, cn.DebtorCode AS debtor_id,
    0 AS quantity, -cnd.SubTotal AS revenue, cn.CurrencyCode AS currency
  FROM CN cn
  JOIN CNDTL cnd ON cnd.DocKey = cn.DocKey
),
debit_notes AS (
  -- Revenue-only addition (qty untouched, mirrors credit_notes); is_credit
  -- from the DN's own DisplayTerm, same rule as cash/credit above.
  SELECT
    dn.DocNo AS doc_no,
    CASE WHEN dn.DisplayTerm LIKE 'Net%day%' THEN CAST(1 AS BIT) ELSE CAST(0 AS BIT) END AS is_credit,
    dn.DocDate AS order_date, dn.SalesLocation AS location_id, dnd.ItemCode AS item_id,
    dn.SalesAgent AS sales_agent_id, dn.DebtorCode AS debtor_id,
    0 AS quantity, dnd.SubTotal AS revenue, dn.CurrencyCode AS currency
  FROM DN dn
  JOIN DNDTL dnd ON dnd.DocKey = dn.DocKey
),
sales AS (
  SELECT * FROM cash
  UNION ALL SELECT * FROM credit
  UNION ALL SELECT * FROM credit_notes
  UNION ALL SELECT * FROM debit_notes
)
`.trim()

// Unified purchases shape (cash + invoice, netted against returns) — no
// PO (not yet an actual purchase, by explicit request) and no cash/credit
// split (purchases just use one combined total, unlike sales). PI (credit
// purchase invoice) and CP (cash purchase, same ItemCode/Qty/UnitPrice
// detail shape) both increase purchase; PR (Purchase Return, same shape)
// nets in as negative-quantity rows so total_purchase = SUM(quantity *
// unit_cost) reduces automatically with no consumer-side change needed.
// APCN was considered as the PI-side sibling of CN but rejected — it has no
// ItemCode at all (GL ledger shape, not a line-item document).
// location_id comes from each doc's own PurchaseLocation (dbo.Location),
// not BranchCode — same Location filter unification as SALES_CTE.
// Columns: doc_no, order_date, location_id, item_id, quantity, unit_cost,
// currency
export const PURCHASES_CTE = `
purchases AS (
  SELECT
    pi.DocNo AS doc_no, pi.DocDate AS order_date, pi.PurchaseLocation AS location_id,
    pid.ItemCode AS item_id, pid.Qty AS quantity,
    pid.UnitPrice AS unit_cost, pi.CurrencyCode AS currency
  FROM PI pi
  JOIN PIDTL pid ON pid.DocKey = pi.DocKey
  UNION ALL
  SELECT
    cp.DocNo AS doc_no, cp.DocDate AS order_date, cp.PurchaseLocation AS location_id,
    cpd.ItemCode AS item_id, cpd.Qty AS quantity,
    cpd.UnitPrice AS unit_cost, cp.CurrencyCode AS currency
  FROM CP cp
  JOIN CPDTL cpd ON cpd.DocKey = cp.DocKey
  UNION ALL
  SELECT
    pr.DocNo AS doc_no, pr.DocDate AS order_date, pr.PurchaseLocation AS location_id,
    prd.ItemCode AS item_id, -prd.Qty AS quantity,
    prd.UnitPrice AS unit_cost, pr.CurrencyCode AS currency
  FROM PR pr
  JOIN PRDTL prd ON prd.DocKey = pr.DocKey
)
`.trim()

// item_base_ref — one row per item: cost and price are single-valued per
// item now, by explicit request — both come straight off ItemUOM's own
// Cost/Price columns on the item's BaseUOM row only (StockDTL.Cost was a
// stock-ledger movement snapshot, not the item's master cost — wrong
// table). No more per-UOM variation and no more ItemLocationPrice override
// — a location no longer changes an item's price, only its stock qty (see
// STOCK_BALANCE_CTE).
export const ITEM_BASE_REF_CTE = `
item_base_ref AS (
  SELECT i.ItemCode,
    iu.Cost AS base_cost,
    iu.Price AS base_price
  FROM Item i
  JOIN ItemUOM iu ON iu.ItemCode = i.ItemCode AND iu.UOM = i.BaseUOM
)
`.trim()

// stock_balance — one row per (location, item), summing StockDTL.Qty (each
// row's signed movement delta: +on a purchase, -on a sale/return) rather
// than reading CFTotalQty (meant to be a running carry-forward balance, but
// confirmed 0 on every row in real data — not actually maintained here, so
// it can't be trusted). SUM(Qty) needs no "latest row" logic at all: every
// movement across every UOM/batch/date for that (Location, ItemCode) is
// just added up directly. `Location` is dbo.Location — a real master table
// of its own, NOT the same code space as dbo.Branch/BranchCode (StockDTL
// has no Branch column at all; an earlier version incorrectly joined this
// to Branch).
// no_stock_items — items with zero StockDTL rows (never moved) still get a
// row so they surface with 0 qty instead of vanishing.
export const STOCK_BALANCE_CTE = `
stock_balance AS (
  SELECT
    Location AS location_id, ItemCode AS item_id,
    SUM(Qty) AS qty_on_hand
  FROM StockDTL
  GROUP BY Location, ItemCode
),
no_stock_items AS (
  SELECT DISTINCT iu.ItemCode AS item_id, 0 AS qty_on_hand
  FROM ItemUOM iu
  WHERE NOT EXISTS (SELECT 1 FROM StockDTL sd WHERE sd.ItemCode = iu.ItemCode)
)
`.trim()

// Standard WHERE fragment for queries selecting FROM the `sales` CTE
// joined to `Item i ON i.ItemCode = <alias>.item_id`. Mirrors rpc_v2.sql's
// repeated filter block exactly — organisation filter dropped (single
// account book scope, see PLAN.md §1).
export function salesCommonWhere(alias = 's') {
  return `
    (@p_date_from IS NULL OR ${alias}.order_date >= @p_date_from)
    AND (@p_date_to IS NULL OR ${alias}.order_date <= @p_date_to)
    AND (@p_location IS NULL OR ${alias}.location_id = @p_location)
    AND (@p_item IS NULL OR ${alias}.item_id = @p_item)
    AND (@p_sales_agent IS NULL OR ${alias}.sales_agent_id = @p_sales_agent)
    AND (@p_debtor IS NULL OR ${alias}.debtor_id = @p_debtor)
    AND (@p_item_group IS NULL OR i.ItemGroup = @p_item_group)
    AND (@p_item_type IS NULL OR i.ItemType = @p_item_type)
    AND (@p_currency IS NULL OR ${alias}.currency = @p_currency)
  `.trim()
}
