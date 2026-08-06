// Shared T-SQL building blocks — ported 1:1 from the dashboard app's
// lib/db/sql-fragments.ts. Same logic, same reasoning (see PLAN.md §2-§5
// in the dashboard repo for the full "why"); only the bound parameter
// names changed, from the old `p_`-prefixed internal names to plain REST
// query param names (date_from, branch, item, ...).
//
// Do not duplicate this logic inline in a route file — import these
// fragments instead, so a correction (e.g. once ARInvoice.SourceType is
// verified against real data) only has to change one place.

// Unified sales shape (cash + credit + credit-note netting), mirroring the
// dashboard app's old schema_v2.sql `sales` table.
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
  -- Join assumed pending verification against real data — run
  -- SELECT DISTINCT SourceType FROM ARInvoice and confirm 'IV' shows up
  -- with SourceKey = IV.DocKey. If wrong, fix ONLY here.
  LEFT JOIN ARInvoice ari ON ari.SourceType = 'IV' AND ari.SourceKey = iv.DocKey
),
credit_notes AS (
  -- Revenue-only netting (qty untouched, by explicit design decision):
  -- bucketed cash/credit by whichever doc CN.OurInvoiceNo resolves to, and
  -- for credit originals, inherits that invoice's CURRENT paid/due-date
  -- bucket so the reduction nets against wherever its balance currently
  -- lives (not left NULL, which would silently vanish from every KPI
  -- bucket's CASE WHEN).
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

// Unified purchases shape — real invoice (PI), not the order (PO).
// Columns: doc_no, order_date, branch_id, item_id, creditor_id, quantity,
// unit_cost, currency
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
// movement, across all locations. ROW_NUMBER() dedupes same-day movements
// deterministically instead of risking a fan-out join.
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
// total). `Location` is treated as holding branch codes.
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
// joined to `Item i ON i.ItemCode = <alias>.item_id`. Param names are the
// clean REST names (date_from, branch, ...), not the old p_-prefixed ones.
export function salesCommonWhere(alias = 's') {
  return `
    (@date_from IS NULL OR ${alias}.order_date >= @date_from)
    AND (@date_to IS NULL OR ${alias}.order_date <= @date_to)
    AND (@branch IS NULL OR ${alias}.branch_id = @branch)
    AND (@item IS NULL OR ${alias}.item_id = @item)
    AND (@sales_agent IS NULL OR ${alias}.sales_agent_id = @sales_agent)
    AND (@debtor IS NULL OR ${alias}.debtor_id = @debtor)
    AND (@item_group IS NULL OR i.ItemGroup = @item_group)
    AND (@item_type IS NULL OR i.ItemType = @item_type)
    AND (@currency IS NULL OR ${alias}.currency = @currency)
    AND (
      @creditor IS NULL OR ${alias}.item_id IN (
        SELECT DISTINCT pid2.ItemCode FROM PI pi2 JOIN PIDTL pid2 ON pid2.DocKey = pi2.DocKey
        WHERE pi2.CreditorCode = @creditor
      )
    )
  `.trim()
}
