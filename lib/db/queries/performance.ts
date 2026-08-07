// Real equivalents of rpc_v2.sql's 4 get_performance_*_v2() functions —
// Performance page's Branch/Item/Sales Agent/Debtor breakdowns.
// Every function accepts all 4 entity filters, including its own dimension
// (see rpc_v2.sql's original comment — filtering by "Ah Chong" collapses
// the Sales Agent table to just his row too, not only the other 3).
import 'server-only'
import sql from 'mssql'
import { getRequest } from '@/lib/mssql'
import { bindCommonParams, CommonParams } from '@/lib/db/params'
import { SALES_CTE, salesCommonWhere } from '@/lib/db/sql-fragments'

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
      b.BranchCode AS id, b.BranchCode AS name, s.currency,
      COALESCE(SUM(CASE WHEN s.is_credit = 1 THEN s.quantity ELSE 0 END), 0) AS credit_qty,
      COALESCE(SUM(CASE WHEN s.is_credit = 0 THEN s.quantity ELSE 0 END), 0) AS cash_qty,
      COALESCE(SUM(CASE WHEN s.is_credit = 1 THEN s.revenue ELSE 0 END), 0) AS credit_revenue,
      COALESCE(SUM(CASE WHEN s.is_credit = 0 THEN s.revenue ELSE 0 END), 0) AS cash_revenue
    FROM sales s
    JOIN Branch b ON b.BranchCode = s.branch_id
    JOIN Item i ON i.ItemCode = s.item_id
    WHERE ${salesCommonWhere('s')}
    GROUP BY b.BranchCode, s.currency
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
        ELSE i.ItemCode
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
        ELSE i.ItemCode
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
      sa.SalesAgent AS id, sa.SalesAgent AS name, s.currency,
      COALESCE(SUM(CASE WHEN s.is_credit = 1 THEN s.quantity ELSE 0 END), 0) AS credit_qty,
      COALESCE(SUM(CASE WHEN s.is_credit = 0 THEN s.quantity ELSE 0 END), 0) AS cash_qty,
      COALESCE(SUM(CASE WHEN s.is_credit = 1 THEN s.revenue ELSE 0 END), 0) AS credit_revenue,
      COALESCE(SUM(CASE WHEN s.is_credit = 0 THEN s.revenue ELSE 0 END), 0) AS cash_revenue
    FROM sales s
    JOIN SalesAgent sa ON sa.SalesAgent = s.sales_agent_id
    JOIN Item i ON i.ItemCode = s.item_id
    WHERE ${salesCommonWhere('s')}
    GROUP BY sa.SalesAgent, s.currency
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
