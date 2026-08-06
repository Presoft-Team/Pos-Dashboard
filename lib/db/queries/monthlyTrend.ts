// Real equivalent of rpc_v2.sql's get_monthly_trend_v2() — Monthly Sales
// page's 4-line trend chart (Total, Cash+Paid, Not-due, Overdue).
import 'server-only'
import { getRequest } from '@/lib/mssql'
import { bindCommonParams, CommonParams } from '@/lib/db/params'
import { SALES_CTE, salesCommonWhere } from '@/lib/db/sql-fragments'

export async function getMonthlyTrend(params: CommonParams) {
  const request = await getRequest()
  bindCommonParams(request, params)
  const result = await request.query(`
    WITH ${SALES_CTE}
    SELECT
      YEAR(s.order_date) AS year,
      MONTH(s.order_date) AS month,
      s.currency,
      COALESCE(SUM(s.revenue), 0) AS total_revenue,
      COALESCE(SUM(CASE WHEN s.is_credit = 0 OR s.paid = 1 THEN s.revenue ELSE 0 END), 0) AS revenue_paid,
      COALESCE(SUM(CASE WHEN s.is_credit = 1 AND s.paid = 0 AND s.due_date >= CAST(GETDATE() AS DATE) THEN s.revenue ELSE 0 END), 0) AS revenue_not_due,
      COALESCE(SUM(CASE WHEN s.is_credit = 1 AND s.paid = 0 AND s.due_date < CAST(GETDATE() AS DATE) THEN s.revenue ELSE 0 END), 0) AS revenue_overdue
    FROM sales s
    JOIN Item i ON i.ItemCode = s.item_id
    WHERE ${salesCommonWhere('s')}
    GROUP BY YEAR(s.order_date), MONTH(s.order_date), s.currency
    ORDER BY 1, 2;
  `)
  return result.recordset
}
