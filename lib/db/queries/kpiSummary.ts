// Real equivalent of rpc_v2.sql's get_kpi_summary_v2() — Sales Dashboard
// KPI cards. Revenue split Cash/Credit (paid status not a factor here —
// see PLAN.md §3) x currency, plus total purchase amount (PI + CP spend
// netted against PR returns; PO excluded — not yet an actual purchase, and
// purchases have no Cash/Credit split, just one combined total). Sales and
// purchases are filtered and grouped independently, then combined by
// currency — a currency with sales but no purchases (or vice versa) still
// gets one row via the FULL OUTER JOIN instead of disappearing from an
// INNER JOIN.
import 'server-only'
import { getRequest } from '@/lib/mssql'
import { bindCommonParams, CommonParams } from '@/lib/db/params'
import { SALES_CTE, PURCHASES_CTE, salesCommonWhere } from '@/lib/db/sql-fragments'

export async function getKpiSummary(params: CommonParams) {
  const request = await getRequest()
  bindCommonParams(request, params)
  const result = await request.query(`
    WITH ${SALES_CTE},
    ${PURCHASES_CTE},
    sales_agg AS (
      SELECT
        s.currency,
        COALESCE(SUM(CASE WHEN s.is_credit = 0 THEN s.revenue ELSE 0 END), 0) AS cash_revenue,
        COALESCE(SUM(CASE WHEN s.is_credit = 1 THEN s.revenue ELSE 0 END), 0) AS credit_revenue,
        COALESCE(SUM(s.revenue), 0) AS total_revenue
      FROM sales s
      JOIN Item i ON i.ItemCode = s.item_id
      WHERE ${salesCommonWhere('s')}
      GROUP BY s.currency
    ),
    purchase_agg AS (
      SELECT pu.currency, COALESCE(SUM(pu.quantity * pu.unit_cost), 0) AS total_purchase
      FROM purchases pu
      JOIN Item i ON i.ItemCode = pu.item_id
      WHERE
        (@p_date_from IS NULL OR pu.order_date >= @p_date_from)
        AND (@p_date_to IS NULL OR pu.order_date <= @p_date_to)
        AND (@p_location IS NULL OR pu.location_id = @p_location)
        AND (@p_item IS NULL OR pu.item_id = @p_item)
        AND (@p_item_group IS NULL OR i.ItemGroup = @p_item_group)
        AND (@p_item_type IS NULL OR i.ItemType = @p_item_type)
        AND (@p_currency IS NULL OR pu.currency = @p_currency)
      GROUP BY pu.currency
    )
    SELECT
      COALESCE(sa.currency, pa.currency) AS currency,
      COALESCE(sa.cash_revenue, 0) AS cash_revenue,
      COALESCE(sa.credit_revenue, 0) AS credit_revenue,
      COALESCE(sa.total_revenue, 0) AS total_revenue,
      COALESCE(pa.total_purchase, 0) AS total_purchase
    FROM sales_agg sa
    FULL OUTER JOIN purchase_agg pa ON pa.currency = sa.currency
    ORDER BY total_revenue DESC;
  `)
  return result.recordset
}
