// Real equivalent of rpc_v2.sql's get_item_revenue_v2() — Sales Dashboard
// "Revenue by Item/Group/Type" chart. p_group_by: 'item' | 'group' | 'type'.
// Total value only (Cash/Credit split, no paid/not-due/overdue breakdown).
// Returns every bucket (not just top 5) — frontend folds the rest into
// "Other" client-side (lib/currency.ts's pivotRevenueByCurrency).
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
        ELSE i.ItemCode
      END AS bucket_name,
      s.currency,
      COALESCE(SUM(CASE WHEN s.is_credit = 1 THEN s.quantity ELSE 0 END), 0) AS credit_qty,
      COALESCE(SUM(CASE WHEN s.is_credit = 0 THEN s.quantity ELSE 0 END), 0) AS cash_qty,
      COALESCE(SUM(CASE WHEN s.is_credit = 1 THEN s.revenue ELSE 0 END), 0) AS credit_revenue,
      COALESCE(SUM(CASE WHEN s.is_credit = 0 THEN s.revenue ELSE 0 END), 0) AS cash_revenue
    FROM sales s
    JOIN Item i ON i.ItemCode = s.item_id
    WHERE ${salesCommonWhere('s')}
    GROUP BY
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
