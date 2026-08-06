// Real equivalent of rpc_v2.sql's get_monthly_breakdown_v2() — Monthly
// Sales page table (Cash/Credit columns). p_limit_months optionally caps
// to the latest N months present in the filtered data; NULL = unlimited
// (the app currently always sends unlimited — see components/monthly page).
import 'server-only'
import sql from 'mssql'
import { getRequest } from '@/lib/mssql'
import { bindCommonParams, CommonParams } from '@/lib/db/params'
import { SALES_CTE, salesCommonWhere } from '@/lib/db/sql-fragments'

interface MonthlyBreakdownParams extends CommonParams {
  p_limit_months?: number | null
}

export async function getMonthlyBreakdown(params: MonthlyBreakdownParams) {
  const request = await getRequest()
  bindCommonParams(request, params)
  request.input('p_limit_months', sql.Int, params.p_limit_months ?? null)
  const result = await request.query(`
    WITH ${SALES_CTE},
    monthly AS (
      SELECT
        YEAR(s.order_date) AS y, MONTH(s.order_date) AS m, s.currency,
        COALESCE(SUM(CASE WHEN s.is_credit = 1 THEN s.revenue ELSE 0 END), 0) AS credit_revenue,
        COALESCE(SUM(CASE WHEN s.is_credit = 0 THEN s.revenue ELSE 0 END), 0) AS cash_revenue,
        COALESCE(SUM(CASE WHEN s.is_credit = 1 THEN s.quantity ELSE 0 END), 0) AS credit_qty,
        COALESCE(SUM(CASE WHEN s.is_credit = 0 THEN s.quantity ELSE 0 END), 0) AS cash_qty
      FROM sales s
      JOIN Item i ON i.ItemCode = s.item_id
      WHERE ${salesCommonWhere('s')}
      GROUP BY YEAR(s.order_date), MONTH(s.order_date), s.currency
    ),
    ranked_months AS (
      SELECT DISTINCT y, m, ROW_NUMBER() OVER (ORDER BY y DESC, m DESC) AS rn FROM monthly
    )
    SELECT mo.y AS year, mo.m AS month, mo.currency, mo.credit_revenue, mo.cash_revenue, mo.credit_qty, mo.cash_qty
    FROM monthly mo
    JOIN ranked_months rm ON rm.y = mo.y AND rm.m = mo.m
    WHERE @p_limit_months IS NULL OR rm.rn <= @p_limit_months
    ORDER BY mo.y, mo.m;
  `)
  return result.recordset
}
