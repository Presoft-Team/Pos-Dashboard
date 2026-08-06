import { Router } from 'express'
import { getRequest } from '../db/pool'
import { parseCommonFilters, bindCommonFilters } from '../db/filters'
import { SALES_CTE, ITEM_COST_CTE, salesCommonWhere } from '../db/sql-fragments'

export const kpiSummaryRouter = Router()

/**
 * @openapi
 * /api/v1/kpi-summary:
 *   get:
 *     summary: Revenue (paid/not-due/overdue), cost, quantity and transaction-count KPIs, per currency
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
 *         description: One row per currency present in the filtered data.
 */
kpiSummaryRouter.get('/kpi-summary', async (req, res, next) => {
  try {
    const filters = parseCommonFilters(req)
    const request = await getRequest()
    bindCommonFilters(request, filters)
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
    res.json(result.recordset)
  } catch (err) {
    next(err)
  }
})
