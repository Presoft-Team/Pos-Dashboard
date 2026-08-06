// Real equivalent of rpc_v2.sql's get_item_revenue_v2() — Sales Dashboard
// "Revenue by Item/Group/Type" chart. p_group_by: 'item' | 'group' | 'type'.
// Returns every bucket (not just top 5) — frontend folds the rest into
// "Other" client-side (lib/currency.ts's pivotItemRevenue), same as before.
import 'server-only'
import sql from 'mssql'
import { getRequest } from '@/lib/mssql'
import { bindCommonParams, CommonParams } from '@/lib/db/params'
import { SALES_CTE, salesCommonWhere } from '@/lib/db/sql-fragments'

interface ItemRevenueParams extends CommonParams {
  p_group_by?: string | null
}

export async function getItemRevenue(params: ItemRevenueParams) {
  const request = await getRequest()
  bindCommonParams(request, params)
  request.input('p_group_by', sql.NVarChar(10), params.p_group_by ?? 'item')
  const result = await request.query(`
    WITH ${SALES_CTE}
    SELECT
      CASE @p_group_by
        WHEN 'group' THEN COALESCE(i.ItemGroup, 'Ungrouped')
        WHEN 'type'  THEN COALESCE(i.ItemType, 'Untyped')
        ELSE i.Description
      END AS bucket_name,
      s.currency,
      COALESCE(SUM(CASE WHEN s.is_credit = 0 OR s.paid = 1 THEN s.revenue ELSE 0 END), 0) AS revenue_paid,
      COALESCE(SUM(CASE WHEN s.is_credit = 1 AND s.paid = 0 AND s.due_date >= CAST(GETDATE() AS DATE) THEN s.revenue ELSE 0 END), 0) AS revenue_not_due,
      COALESCE(SUM(CASE WHEN s.is_credit = 1 AND s.paid = 0 AND s.due_date < CAST(GETDATE() AS DATE) THEN s.revenue ELSE 0 END), 0) AS revenue_overdue,
      COALESCE(SUM(CASE WHEN s.is_credit = 0 OR s.paid = 1 THEN s.quantity ELSE 0 END), 0) AS qty_paid,
      COALESCE(SUM(CASE WHEN s.is_credit = 1 AND s.paid = 0 AND s.due_date >= CAST(GETDATE() AS DATE) THEN s.quantity ELSE 0 END), 0) AS qty_not_due,
      COALESCE(SUM(CASE WHEN s.is_credit = 1 AND s.paid = 0 AND s.due_date < CAST(GETDATE() AS DATE) THEN s.quantity ELSE 0 END), 0) AS qty_overdue
    FROM sales s
    JOIN Item i ON i.ItemCode = s.item_id
    WHERE ${salesCommonWhere('s')}
    GROUP BY
      CASE @p_group_by
        WHEN 'group' THEN COALESCE(i.ItemGroup, 'Ungrouped')
        WHEN 'type'  THEN COALESCE(i.ItemType, 'Untyped')
        ELSE i.Description
      END,
      s.currency
    ORDER BY (revenue_paid + revenue_not_due + revenue_overdue) DESC;
  `)
  return result.recordset
}
