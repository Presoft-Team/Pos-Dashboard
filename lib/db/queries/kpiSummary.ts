// Real equivalent of rpc_v2.sql's get_kpi_summary_v2() — Sales Dashboard
// KPI cards. Revenue: 3 buckets x currency. Qty/transactions: 2 buckets x
// currency (no due/overdue split there — see PLAN.md §3).
import 'server-only'
import { getRequest } from '@/lib/mssql'
import { bindCommonParams, CommonParams } from '@/lib/db/params'
import { SALES_CTE, ITEM_COST_CTE, salesCommonWhere } from '@/lib/db/sql-fragments'

export async function getKpiSummary(params: CommonParams) {
  const request = await getRequest()
  bindCommonParams(request, params)
  const result = await request.query(`
    WITH ${SALES_CTE},
    ${ITEM_COST_CTE}
    SELECT
      s.currency,
      COALESCE(SUM(CASE WHEN s.is_credit = 0 OR s.paid = 1 THEN s.revenue ELSE 0 END), 0) AS revenue_paid,
      COALESCE(SUM(CASE WHEN s.is_credit = 1 AND s.paid = 0 AND s.due_date >= CAST(GETDATE() AS DATE) THEN s.revenue ELSE 0 END), 0) AS revenue_not_due,
      COALESCE(SUM(CASE WHEN s.is_credit = 1 AND s.paid = 0 AND s.due_date < CAST(GETDATE() AS DATE) THEN s.revenue ELSE 0 END), 0) AS revenue_overdue,
      COALESCE(SUM(s.quantity * ic.Cost), 0) AS total_cost,
      COALESCE(SUM(CASE WHEN s.is_credit = 0 THEN s.quantity ELSE 0 END), 0) AS cash_qty,
      COALESCE(SUM(CASE WHEN s.is_credit = 1 THEN s.quantity ELSE 0 END), 0) AS credit_qty,
      COUNT(DISTINCT CASE WHEN s.is_credit = 0 THEN s.doc_no END) AS cash_transactions,
      COUNT(DISTINCT CASE WHEN s.is_credit = 1 THEN s.doc_no END) AS credit_transactions
    FROM sales s
    JOIN Item i ON i.ItemCode = s.item_id
    LEFT JOIN item_cost ic ON ic.ItemCode = s.item_id
    WHERE ${salesCommonWhere('s')}
    GROUP BY s.currency
    ORDER BY revenue_paid DESC;
  `)
  return result.recordset
}
