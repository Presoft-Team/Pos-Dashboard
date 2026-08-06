// Real equivalent of rpc_v2.sql's get_item_best_sellers_v2() — Best
// Sellers table. Cash/Credit split (not the chart's Paid/Not-due/Overdue
// split). Same p_group_by toggle as get_item_revenue_v2.
import 'server-only'
import sql from 'mssql'
import { getRequest } from '@/lib/mssql'
import { bindCommonParams, CommonParams } from '@/lib/db/params'
import { SALES_CTE, salesCommonWhere } from '@/lib/db/sql-fragments'

interface BestSellersParams extends CommonParams {
  p_group_by?: string | null
  p_limit?: number | null
}

export async function getItemBestSellers(params: BestSellersParams) {
  const request = await getRequest()
  bindCommonParams(request, params)
  request.input('p_group_by', sql.NVarChar(10), params.p_group_by ?? 'item')
  request.input('p_limit', sql.Int, params.p_limit ?? 5)
  const result = await request.query(`
    WITH ${SALES_CTE}
    SELECT TOP (@p_limit)
      CASE @p_group_by
        WHEN 'group' THEN COALESCE(i.ItemGroup, 'Ungrouped')
        WHEN 'type'  THEN COALESCE(i.ItemType, 'Untyped')
        ELSE i.Description
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
        ELSE i.Description
      END,
      s.currency
    ORDER BY (COALESCE(SUM(s.revenue), 0)) DESC;
  `)
  return result.recordset
}
