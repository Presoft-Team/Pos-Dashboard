import { Router } from 'express'
import { getRequest } from '../db/pool'
import { parseCommonFilters, bindCommonFilters } from '../db/filters'
import { SALES_CTE, PURCHASES_CTE, salesCommonWhere } from '../db/sql-fragments'

export const kpiSummaryRouter = Router()

/**
 * @openapi
 * /api/v1/kpi-summary:
 *   get:
 *     summary: Total/Cash/Credit revenue and total purchase KPIs, per currency
 *     tags: [Sales]
 *     parameters:
 *       - $ref: '#/components/parameters/date_from'
 *       - $ref: '#/components/parameters/date_to'
 *       - $ref: '#/components/parameters/location'
 *       - $ref: '#/components/parameters/item'
 *       - $ref: '#/components/parameters/sales_agent'
 *       - $ref: '#/components/parameters/debtor'
 *       - $ref: '#/components/parameters/item_group'
 *       - $ref: '#/components/parameters/item_type'
 *       - $ref: '#/components/parameters/currency'
 *     responses:
 *       200:
 *         description: One row per currency present in the filtered sales or purchases data.
 */
kpiSummaryRouter.get('/kpi-summary', async (req, res, next) => {
  try {
    const filters = parseCommonFilters(req)
    const request = await getRequest()
    bindCommonFilters(request, filters)
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
          (@date_from IS NULL OR pu.order_date >= @date_from)
          AND (@date_to IS NULL OR pu.order_date <= @date_to)
          AND (@location IS NULL OR pu.location_id = @location)
          AND (@item IS NULL OR pu.item_id = @item)
          AND (@item_group IS NULL OR i.ItemGroup = @item_group)
          AND (@item_type IS NULL OR i.ItemType = @item_type)
          AND (@currency IS NULL OR pu.currency = @currency)
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
    res.json(result.recordset)
  } catch (err) {
    next(err)
  }
})
