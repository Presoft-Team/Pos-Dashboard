// Shared T-SQL building blocks — the real-database equivalent of
// schema_v2.sql's `sales`/`purchases`/`items.cost`. See PLAN.md §2-§5 for
// the full mapping and reasoning behind every decision made here; this file
// is just the SQL those decisions compile down to. Do not duplicate this
// logic inline in a query file — import these fragments instead, so a
// future correction (e.g. once ARInvoice.SourceType is verified) only has
// to change one place.
import 'server-only'

// Unified sales shape (cash + credit + credit-note netting), mirroring the
// old schema_v2.sql `sales` table. See PLAN.md §3.
// Columns: doc_no, is_credit, order_date, branch_id, item_id,
// sales_agent_id, debtor_id, quantity, revenue, currency, due_date, paid
export const SALES_CTE = `
cash AS (
  SELECT
    cs.DocNo AS doc_no, CAST(0 AS BIT) AS is_credit, cs.DocDate AS order_date,
    cs.BranchCode AS branch_id, csd.ItemCode AS item_id, cs.SalesAgent AS sales_agent_id,
    cs.DebtorCode AS debtor_id, csd.Qty AS quantity, csd.SubTotal AS revenue,
    cs.CurrencyCode AS currency, CAST(NULL AS DATE) AS due_date, CAST(NULL AS BIT) AS paid
  FROM CS cs
  JOIN CSDTL csd ON csd.DocKey = cs.DocKey
),
credit AS (
  SELECT
    iv.DocNo AS doc_no, CAST(1 AS BIT) AS is_credit, iv.DocDate AS order_date,
    iv.BranchCode AS branch_id, ivd.ItemCode AS item_id, iv.SalesAgent AS sales_agent_id,
    iv.DebtorCode AS debtor_id, ivd.Qty AS quantity, ivd.SubTotal AS revenue,
    iv.CurrencyCode AS currency, ari.DueDate AS due_date,
    -- NULL Outstanding (no AR record found yet, or genuinely NULL) falls
    -- through CASE to ELSE — treated as unpaid, the conservative default.
    CASE WHEN ari.Outstanding <= 0 THEN CAST(1 AS BIT) ELSE CAST(0 AS BIT) END AS paid
  FROM IV iv
  JOIN IVDTL ivd ON ivd.DocKey = iv.DocKey
  -- Join assumed per PLAN.md §3 — SourceType = 'IV' not yet verified
  -- against real data (PLAN.md §6 checklist: SELECT DISTINCT SourceType
  -- FROM ARInvoice). If this turns out wrong, fix ONLY here.
  LEFT JOIN ARInvoice ari ON ari.SourceType = 'IV' AND ari.SourceKey = iv.DocKey
),
credit_notes AS (
  -- Revenue-only netting (qty untouched, by explicit request): bucketed
  -- cash/credit by whichever doc CN.OurInvoiceNo resolves to, and for
  -- credit originals, inherits that invoice's CURRENT paid/due-date bucket
  -- so the reduction nets against wherever its balance currently lives
  -- (not left NULL, which would silently vanish from every KPI bucket's
  -- FILTER/CASE — see PLAN.md §3 "CN vs revenue").
  SELECT
    cn.DocNo AS doc_no,
    CASE WHEN orig_iv.DocKey IS NOT NULL THEN CAST(1 AS BIT) ELSE CAST(0 AS BIT) END AS is_credit,
    cn.DocDate AS order_date, cn.BranchCode AS branch_id, cnd.ItemCode AS item_id,
    cn.SalesAgent AS sales_agent_id, cn.DebtorCode AS debtor_id,
    0 AS quantity, -cnd.SubTotal AS revenue, cn.CurrencyCode AS currency, ari.DueDate AS due_date,
    CASE WHEN ari.Outstanding <= 0 THEN CAST(1 AS BIT) ELSE CAST(0 AS BIT) END AS paid
  FROM CN cn
  JOIN CNDTL cnd ON cnd.DocKey = cn.DocKey
  LEFT JOIN IV orig_iv ON orig_iv.DocNo = cn.OurInvoiceNo
  LEFT JOIN ARInvoice ari ON ari.SourceType = 'IV' AND ari.SourceKey = orig_iv.DocKey
),
sales AS (
  SELECT * FROM cash
  UNION ALL SELECT * FROM credit
  UNION ALL SELECT * FROM credit_notes
)
`.trim()

// Unified purchases shape — real invoice (PI), not the order (PO). PO is
// intentionally not queried here — see PLAN.md §4. Columns: doc_no,
// order_date, branch_id, item_id, creditor_id, quantity, unit_cost, currency
export const PURCHASES_CTE = `
purchases AS (
  SELECT
    pi.DocNo AS doc_no, pi.DocDate AS order_date, pi.BranchCode AS branch_id,
    pid.ItemCode AS item_id, pi.CreditorCode AS creditor_id, pid.Qty AS quantity,
    pid.UnitPrice AS unit_cost, pi.CurrencyCode AS currency
  FROM PI pi
  JOIN PIDTL pid ON pid.DocKey = pi.DocKey
)
`.trim()

// items.cost — plain StockDTL.Cost from each item's most recent stock
// movement, across all locations (schema_v2's one-flat-value-per-item
// simplification, kept as-is per PLAN.md §2). ROW_NUMBER() dedupes same-day
// movements deterministically instead of risking a fan-out join.
export const ITEM_COST_CTE = `
item_cost AS (
  SELECT ItemCode, Cost FROM (
    SELECT ItemCode, Cost,
      ROW_NUMBER() OVER (PARTITION BY ItemCode ORDER BY DocDate DESC, StockDTLKey DESC) AS rn
    FROM StockDTL
  ) ranked
  WHERE rn = 1
)
`.trim()

// stock_balance — current qty on hand per (branch, item), taken from each
// pair's most recent StockDTL row's CFTotalQty (carry-forward running
// total, not a per-row delta). Same dedupe pattern as ITEM_COST_CTE, keyed
// on (Location, ItemCode) instead of just ItemCode. See PLAN.md §5 —
// `Location` is treated as holding branch codes (Location itself dropped).
export const STOCK_BALANCE_CTE = `
stock_balance AS (
  SELECT Location AS branch_id, ItemCode AS item_id, CFTotalQty AS qty_on_hand FROM (
    SELECT Location, ItemCode, CFTotalQty,
      ROW_NUMBER() OVER (PARTITION BY Location, ItemCode ORDER BY DocDate DESC, StockDTLKey DESC) AS rn
    FROM StockDTL
  ) ranked
  WHERE rn = 1
)
`.trim()

// Standard WHERE fragment for queries selecting FROM the `sales` CTE
// joined to `Item i ON i.ItemCode = <alias>.item_id`. Mirrors rpc_v2.sql's
// repeated filter block exactly — organisation filter dropped (single
// account book scope, see PLAN.md §1). Requires PURCHASES_CTE's `PI`/
// `PIDTL` tables to exist for the creditor bridge (not the CTE itself,
// to avoid pulling in an unused `purchases` alias when not needed).
export function salesCommonWhere(alias = 's') {
  return `
    (@p_date_from IS NULL OR ${alias}.order_date >= @p_date_from)
    AND (@p_date_to IS NULL OR ${alias}.order_date <= @p_date_to)
    AND (@p_branch IS NULL OR ${alias}.branch_id = @p_branch)
    AND (@p_item IS NULL OR ${alias}.item_id = @p_item)
    AND (@p_sales_agent IS NULL OR ${alias}.sales_agent_id = @p_sales_agent)
    AND (@p_debtor IS NULL OR ${alias}.debtor_id = @p_debtor)
    AND (@p_item_group IS NULL OR i.ItemGroup = @p_item_group)
    AND (@p_item_type IS NULL OR i.ItemType = @p_item_type)
    AND (@p_currency IS NULL OR ${alias}.currency = @p_currency)
    AND (
      @p_creditor IS NULL OR ${alias}.item_id IN (
        SELECT DISTINCT pid2.ItemCode FROM PI pi2 JOIN PIDTL pid2 ON pid2.DocKey = pi2.DocKey
        WHERE pi2.CreditorCode = @p_creditor
      )
    )
  `.trim()
}
