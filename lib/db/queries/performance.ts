// Real equivalents of rpc_v2.sql's 5 get_performance_*_v2() functions —
// Performance page's Branch/Item/Sales Agent/Debtor/Creditor breakdowns.
// Every function accepts all 5 entity filters, including its own dimension
// (see rpc_v2.sql's original comment — filtering by "Ah Chong" collapses
// the Sales Agent table to just his row too, not only the other 4).
import 'server-only'
import sql from 'mssql'
import { getRequest } from '@/lib/mssql'
import { bindCommonParams, CommonParams } from '@/lib/db/params'
import { SALES_CTE, PURCHASES_CTE, salesCommonWhere } from '@/lib/db/sql-fragments'

interface LimitParams extends CommonParams {
  p_limit?: number | null
}

// Performance page always calls these 5 functions with `p_limit: null` for
// its full breakdown tables (the chart re-slices to top-5 client-side from
// that same unlimited fetch — see components/performance-table.tsx) — so
// nullish here means "give me everything," not "use the old default of 5."
// T-SQL's TOP has no literal "unlimited" form, so a very large number
// stands in for it instead.
const NO_LIMIT = 2147483647
function effectiveLimit(p_limit: number | null | undefined): number {
  return typeof p_limit === 'number' && Number.isFinite(p_limit) ? p_limit : NO_LIMIT
}

export async function getPerformanceBranch(params: LimitParams) {
  const request = await getRequest()
  bindCommonParams(request, params)
  request.input('p_limit', sql.Int, effectiveLimit(params.p_limit))
  const result = await request.query(`
    WITH ${SALES_CTE}
    SELECT TOP (@p_limit)
      b.BranchCode AS id, b.BranchName AS name, s.currency,
      COALESCE(SUM(CASE WHEN s.is_credit = 1 THEN s.quantity ELSE 0 END), 0) AS credit_qty,
      COALESCE(SUM(CASE WHEN s.is_credit = 0 THEN s.quantity ELSE 0 END), 0) AS cash_qty,
      COALESCE(SUM(CASE WHEN s.is_credit = 1 THEN s.revenue ELSE 0 END), 0) AS credit_revenue,
      COALESCE(SUM(CASE WHEN s.is_credit = 0 THEN s.revenue ELSE 0 END), 0) AS cash_revenue
    FROM sales s
    JOIN Branch b ON b.BranchCode = s.branch_id
    JOIN Item i ON i.ItemCode = s.item_id
    WHERE ${salesCommonWhere('s')}
    GROUP BY b.BranchCode, b.BranchName, s.currency
    ORDER BY (COALESCE(SUM(s.revenue), 0)) DESC;
  `)
  return result.recordset
}

interface ItemPerfParams extends LimitParams {
  p_group_by?: string | null
}

export async function getPerformanceItem(params: ItemPerfParams) {
  const request = await getRequest()
  bindCommonParams(request, params)
  request.input('p_group_by', sql.NVarChar(10), params.p_group_by ?? 'item')
  request.input('p_limit', sql.Int, effectiveLimit(params.p_limit))
  const result = await request.query(`
    WITH ${SALES_CTE}
    SELECT TOP (@p_limit)
      -- Only has a single id when grouped by individual Item — a
      -- "Group"/"Type" row aggregates many items, so it has no one id.
      CASE WHEN @p_group_by = 'item' THEN i.ItemCode ELSE NULL END AS id,
      CASE @p_group_by
        WHEN 'group' THEN COALESCE(i.ItemGroup, 'Ungrouped')
        WHEN 'type'  THEN COALESCE(i.ItemType, 'Untyped')
        ELSE i.Description
      END AS name,
      s.currency,
      COALESCE(SUM(CASE WHEN s.is_credit = 1 THEN s.quantity ELSE 0 END), 0) AS credit_qty,
      COALESCE(SUM(CASE WHEN s.is_credit = 0 THEN s.quantity ELSE 0 END), 0) AS cash_qty,
      COALESCE(SUM(CASE WHEN s.is_credit = 1 THEN s.revenue ELSE 0 END), 0) AS credit_revenue,
      COALESCE(SUM(CASE WHEN s.is_credit = 0 THEN s.revenue ELSE 0 END), 0) AS cash_revenue
    FROM sales s
    JOIN Item i ON i.ItemCode = s.item_id
    WHERE ${salesCommonWhere('s')}
    GROUP BY
      CASE WHEN @p_group_by = 'item' THEN i.ItemCode ELSE NULL END,
      CASE @p_group_by
        WHEN 'group' THEN COALESCE(i.ItemGroup, 'Ungrouped')
        WHEN 'type'  THEN COALESCE(i.ItemType, 'Untyped')
        ELSE i.Description
      END,
      s.currency
    ORDER BY (COALESCE(SUM(s.revenue), 0)) DESC;
  `)
  return result.recordset
}

export async function getPerformanceSalesAgent(params: LimitParams) {
  const request = await getRequest()
  bindCommonParams(request, params)
  request.input('p_limit', sql.Int, effectiveLimit(params.p_limit))
  const result = await request.query(`
    WITH ${SALES_CTE}
    SELECT TOP (@p_limit)
      sa.SalesAgent AS id, sa.Description AS name, s.currency,
      COALESCE(SUM(CASE WHEN s.is_credit = 1 THEN s.quantity ELSE 0 END), 0) AS credit_qty,
      COALESCE(SUM(CASE WHEN s.is_credit = 0 THEN s.quantity ELSE 0 END), 0) AS cash_qty,
      COALESCE(SUM(CASE WHEN s.is_credit = 1 THEN s.revenue ELSE 0 END), 0) AS credit_revenue,
      COALESCE(SUM(CASE WHEN s.is_credit = 0 THEN s.revenue ELSE 0 END), 0) AS cash_revenue
    FROM sales s
    JOIN SalesAgent sa ON sa.SalesAgent = s.sales_agent_id
    JOIN Item i ON i.ItemCode = s.item_id
    WHERE ${salesCommonWhere('s')}
    GROUP BY sa.SalesAgent, sa.Description, s.currency
    ORDER BY (COALESCE(SUM(s.revenue), 0)) DESC;
  `)
  return result.recordset
}

export async function getPerformanceDebtor(params: LimitParams) {
  const request = await getRequest()
  bindCommonParams(request, params)
  request.input('p_limit', sql.Int, effectiveLimit(params.p_limit))
  const result = await request.query(`
    WITH ${SALES_CTE}
    SELECT TOP (@p_limit)
      d.AccNo AS id, d.CompanyName AS name, s.currency,
      COALESCE(SUM(CASE WHEN s.is_credit = 1 THEN s.quantity ELSE 0 END), 0) AS credit_qty,
      COALESCE(SUM(CASE WHEN s.is_credit = 0 THEN s.quantity ELSE 0 END), 0) AS cash_qty,
      COALESCE(SUM(CASE WHEN s.is_credit = 1 THEN s.revenue ELSE 0 END), 0) AS credit_revenue,
      COALESCE(SUM(CASE WHEN s.is_credit = 0 THEN s.revenue ELSE 0 END), 0) AS cash_revenue
    FROM sales s
    JOIN Debtor d ON d.AccNo = s.debtor_id
    JOIN Item i ON i.ItemCode = s.item_id
    WHERE ${salesCommonWhere('s')}
    GROUP BY d.AccNo, d.CompanyName, s.currency
    ORDER BY (COALESCE(SUM(s.revenue), 0)) DESC;
  `)
  return result.recordset
}

// Creditor bridges through Item both ways: filters on branch/sales_agent/
// debtor/item all narrow the ITEM SET first (via sales), then purchases are
// summed for creditors supplying that item set. p_creditor itself is
// applied directly against pu.creditor_id, not through the bridge. Reuses
// cash_qty/cash_revenue to mean "purchase qty/cost" (purchases have no
// cash/credit concept) — credit_qty/credit_revenue are always 0. See
// PLAN.md §4's "reused-column gotcha" note.
export async function getPerformanceCreditor(params: LimitParams) {
  const request = await getRequest()
  bindCommonParams(request, params)
  request.input('p_limit', sql.Int, effectiveLimit(params.p_limit))
  const result = await request.query(`
    WITH ${SALES_CTE}, ${PURCHASES_CTE},
    scoped_items AS (
      -- No sales-side filter at all -> every item is in scope (Creditor's
      -- own Top 5, unfiltered). Otherwise, narrow to items actually
      -- involved in the filtered Branch/Item/Sales Agent/Debtor's sales.
      SELECT DISTINCT s.item_id
      FROM sales s
      JOIN Item i ON i.ItemCode = s.item_id
      WHERE
        (@p_date_from IS NULL OR s.order_date >= @p_date_from)
        AND (@p_date_to IS NULL OR s.order_date <= @p_date_to)
        AND (@p_branch IS NULL OR s.branch_id = @p_branch)
        AND (@p_item IS NULL OR s.item_id = @p_item)
        AND (@p_sales_agent IS NULL OR s.sales_agent_id = @p_sales_agent)
        AND (@p_debtor IS NULL OR s.debtor_id = @p_debtor)
        AND (@p_item_group IS NULL OR i.ItemGroup = @p_item_group)
        AND (@p_item_type IS NULL OR i.ItemType = @p_item_type)
    )
    SELECT TOP (@p_limit)
      cr.AccNo AS id, cr.CompanyName AS name, pu.currency,
      0 AS credit_qty,
      COALESCE(SUM(pu.quantity), 0) AS cash_qty,
      0 AS credit_revenue,
      COALESCE(SUM(pu.quantity * pu.unit_cost), 0) AS cash_revenue
    FROM purchases pu
    JOIN Creditor cr ON cr.AccNo = pu.creditor_id
    JOIN Item i ON i.ItemCode = pu.item_id
    WHERE
      (@p_date_from IS NULL OR pu.order_date >= @p_date_from)
      AND (@p_date_to IS NULL OR pu.order_date <= @p_date_to)
      AND (@p_creditor IS NULL OR pu.creditor_id = @p_creditor)
      AND (@p_currency IS NULL OR pu.currency = @p_currency)
      AND (@p_item_group IS NULL OR i.ItemGroup = @p_item_group)
      AND (@p_item_type IS NULL OR i.ItemType = @p_item_type)
      AND (
        (@p_branch IS NULL AND @p_item IS NULL AND @p_sales_agent IS NULL AND @p_debtor IS NULL)
        OR pu.item_id IN (SELECT item_id FROM scoped_items)
      )
    GROUP BY cr.AccNo, cr.CompanyName, pu.currency
    ORDER BY cash_revenue DESC;
  `)
  return result.recordset
}
