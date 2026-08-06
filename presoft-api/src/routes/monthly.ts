import { Router } from 'express'
import sql from 'mssql'
import { getRequest } from '../db/pool'
import { parseCommonFilters, bindCommonFilters } from '../db/filters'
import { SALES_CTE, salesCommonWhere } from '../db/sql-fragments'

export const monthlyRouter = Router()

/**
 * @openapi
 * /api/v1/sales/monthly-trend:
 *   get:
 *     summary: Monthly revenue trend — Total, Cash+Paid, Not-due, Overdue, per currency
 *     tags: [Sales]
 *     parameters:
 *       - $ref: '#/components/parameters/date_from'
 *       - $ref: '#/components/parameters/date_to'
 *       - $ref: '#/components/parameters/branch'
 *       - $ref: '#/components/parameters/item'
 *       - $ref: '#/components/parameters/sales_agent'
 *       - $ref: '#/components/parameters/debtor'
 *       - $ref: '#/components/parameters/creditor'
 *       - $ref: '#/components/parameters/item_group'
 *       - $ref: '#/components/parameters/item_type'
 *       - $ref: '#/components/parameters/currency'
 *     responses:
 *       200:
 *         description: One row per (year, month, currency), chronological.
 */
monthlyRouter.get('/sales/monthly-trend', async (req, res, next) => {
  try {
    const filters = parseCommonFilters(req)
    const request = await getRequest()
    bindCommonFilters(request, filters)
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
    res.json(result.recordset)
  } catch (err) {
    next(err)
  }
})

/**
 * @openapi
 * /api/v1/sales/monthly-breakdown:
 *   get:
 *     summary: Monthly Cash/Credit revenue and quantity breakdown
 *     tags: [Sales]
 *     parameters:
 *       - $ref: '#/components/parameters/date_from'
 *       - $ref: '#/components/parameters/date_to'
 *       - $ref: '#/components/parameters/branch'
 *       - $ref: '#/components/parameters/item'
 *       - $ref: '#/components/parameters/sales_agent'
 *       - $ref: '#/components/parameters/debtor'
 *       - $ref: '#/components/parameters/creditor'
 *       - $ref: '#/components/parameters/item_group'
 *       - $ref: '#/components/parameters/item_type'
 *       - $ref: '#/components/parameters/currency'
 *       - name: limit_months
 *         in: query
 *         schema: { type: integer }
 *         description: Cap to the latest N months present in the filtered data. Omit for unlimited.
 *     responses:
 *       200:
 *         description: One row per (year, month, currency), chronological.
 */
monthlyRouter.get('/sales/monthly-breakdown', async (req, res, next) => {
  try {
    const filters = parseCommonFilters(req)
    const limitMonths = req.query.limit_months !== undefined ? Number(req.query.limit_months) : null
    const request = await getRequest()
    bindCommonFilters(request, filters)
    request.input('limit_months', sql.Int, Number.isFinite(limitMonths as number) ? limitMonths : null)
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
      WHERE @limit_months IS NULL OR rm.rn <= @limit_months
      ORDER BY mo.y, mo.m;
    `)
    res.json(result.recordset)
  } catch (err) {
    next(err)
  }
})
