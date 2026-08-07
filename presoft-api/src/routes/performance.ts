import { Router } from 'express'
import sql from 'mssql'
import { getRequest } from '../db/pool'
import { parseCommonFilters, bindCommonFilters } from '../db/filters'
import { SALES_CTE, salesCommonWhere } from '../db/sql-fragments'

export const performanceRouter = Router()

function getLimit(req: { query: Record<string, unknown> }): number {
  const n = Number(req.query.limit ?? 5)
  return Number.isFinite(n) ? n : 5
}

/**
 * @openapi
 * /api/v1/performance/branches:
 *   get:
 *     summary: Top-N branch performance (Cash/Credit qty + revenue)
 *     tags: [Performance]
 *     parameters:
 *       - $ref: '#/components/parameters/date_from'
 *       - $ref: '#/components/parameters/date_to'
 *       - $ref: '#/components/parameters/branch'
 *       - $ref: '#/components/parameters/item'
 *       - $ref: '#/components/parameters/sales_agent'
 *       - $ref: '#/components/parameters/debtor'
 *       - $ref: '#/components/parameters/item_group'
 *       - $ref: '#/components/parameters/item_type'
 *       - $ref: '#/components/parameters/currency'
 *       - $ref: '#/components/parameters/limit'
 *     responses:
 *       200:
 *         description: Top N branches by total revenue, one row per (branch, currency).
 */
performanceRouter.get('/performance/branches', async (req, res, next) => {
  try {
    const filters = parseCommonFilters(req)
    const request = await getRequest()
    bindCommonFilters(request, filters)
    request.input('limit', sql.Int, getLimit(req))
    const result = await request.query(`
      WITH ${SALES_CTE}
      SELECT TOP (@limit)
        b.BranchCode AS id, b.BranchCode AS name, s.currency,
        COALESCE(SUM(CASE WHEN s.is_credit = 1 THEN s.quantity ELSE 0 END), 0) AS credit_qty,
        COALESCE(SUM(CASE WHEN s.is_credit = 0 THEN s.quantity ELSE 0 END), 0) AS cash_qty,
        COALESCE(SUM(CASE WHEN s.is_credit = 1 THEN s.revenue ELSE 0 END), 0) AS credit_revenue,
        COALESCE(SUM(CASE WHEN s.is_credit = 0 THEN s.revenue ELSE 0 END), 0) AS cash_revenue
      FROM sales s
      JOIN Branch b ON b.BranchCode = s.branch_id
      JOIN Item i ON i.ItemCode = s.item_id
      WHERE ${salesCommonWhere('s')}
      GROUP BY b.BranchCode, s.currency
      ORDER BY (COALESCE(SUM(s.revenue), 0)) DESC;
    `)
    res.json(result.recordset)
  } catch (err) {
    next(err)
  }
})

/**
 * @openapi
 * /api/v1/performance/items:
 *   get:
 *     summary: Top-N item/group/type performance (Cash/Credit qty + revenue)
 *     tags: [Performance]
 *     parameters:
 *       - $ref: '#/components/parameters/date_from'
 *       - $ref: '#/components/parameters/date_to'
 *       - $ref: '#/components/parameters/branch'
 *       - $ref: '#/components/parameters/item'
 *       - $ref: '#/components/parameters/sales_agent'
 *       - $ref: '#/components/parameters/debtor'
 *       - $ref: '#/components/parameters/item_group'
 *       - $ref: '#/components/parameters/item_type'
 *       - $ref: '#/components/parameters/currency'
 *       - $ref: '#/components/parameters/group_by'
 *       - $ref: '#/components/parameters/limit'
 *     responses:
 *       200:
 *         description: Top N by total revenue. `id` is only present when group_by=item (a Group/Type row aggregates many items, so has no single id).
 */
performanceRouter.get('/performance/items', async (req, res, next) => {
  try {
    const filters = parseCommonFilters(req)
    const groupBy = typeof req.query.group_by === 'string' ? req.query.group_by : 'item'
    const request = await getRequest()
    bindCommonFilters(request, filters)
    request.input('group_by', sql.NVarChar(10), groupBy)
    request.input('limit', sql.Int, getLimit(req))
    const result = await request.query(`
      WITH ${SALES_CTE}
      SELECT TOP (@limit)
        CASE WHEN @group_by = 'item' THEN i.ItemCode ELSE NULL END AS id,
        CASE @group_by
          WHEN 'group' THEN COALESCE(i.ItemGroup, 'Ungrouped')
          WHEN 'type'  THEN COALESCE(i.ItemType, 'Untyped')
          ELSE i.ItemCode
        END AS name,
        s.currency,
        COALESCE(SUM(CASE WHEN s.is_credit = 1 THEN s.quantity ELSE 0 END), 0) AS credit_qty,
        COALESCE(SUM(CASE WHEN s.is_credit = 0 THEN s.quantity ELSE 0 END), 0) AS cash_qty,
        COALESCE(SUM(CASE WHEN s.is_credit = 1 THEN s.revenue ELSE 0 END), 0) AS credit_revenue,
        COALESCE(SUM(CASE WHEN s.is_credit = 0 THEN s.revenue ELSE 0 END), 0) AS cash_revenue
      FROM sales s
      JOIN Item i ON i.ItemCode = s.item_id
      WHERE ${salesCommonWhere('s')}
      GROUP BY
        CASE WHEN @group_by = 'item' THEN i.ItemCode ELSE NULL END,
        CASE @group_by
          WHEN 'group' THEN COALESCE(i.ItemGroup, 'Ungrouped')
          WHEN 'type'  THEN COALESCE(i.ItemType, 'Untyped')
          ELSE i.ItemCode
        END,
        s.currency
      ORDER BY (COALESCE(SUM(s.revenue), 0)) DESC;
    `)
    res.json(result.recordset)
  } catch (err) {
    next(err)
  }
})

/**
 * @openapi
 * /api/v1/performance/sales-agents:
 *   get:
 *     summary: Top-N sales agent performance (Cash/Credit qty + revenue)
 *     tags: [Performance]
 *     parameters:
 *       - $ref: '#/components/parameters/date_from'
 *       - $ref: '#/components/parameters/date_to'
 *       - $ref: '#/components/parameters/branch'
 *       - $ref: '#/components/parameters/item'
 *       - $ref: '#/components/parameters/sales_agent'
 *       - $ref: '#/components/parameters/debtor'
 *       - $ref: '#/components/parameters/item_group'
 *       - $ref: '#/components/parameters/item_type'
 *       - $ref: '#/components/parameters/currency'
 *       - $ref: '#/components/parameters/limit'
 *     responses:
 *       200:
 *         description: Top N sales agents by total revenue.
 */
performanceRouter.get('/performance/sales-agents', async (req, res, next) => {
  try {
    const filters = parseCommonFilters(req)
    const request = await getRequest()
    bindCommonFilters(request, filters)
    request.input('limit', sql.Int, getLimit(req))
    const result = await request.query(`
      WITH ${SALES_CTE}
      SELECT TOP (@limit)
        sa.SalesAgent AS id, sa.SalesAgent AS name, s.currency,
        COALESCE(SUM(CASE WHEN s.is_credit = 1 THEN s.quantity ELSE 0 END), 0) AS credit_qty,
        COALESCE(SUM(CASE WHEN s.is_credit = 0 THEN s.quantity ELSE 0 END), 0) AS cash_qty,
        COALESCE(SUM(CASE WHEN s.is_credit = 1 THEN s.revenue ELSE 0 END), 0) AS credit_revenue,
        COALESCE(SUM(CASE WHEN s.is_credit = 0 THEN s.revenue ELSE 0 END), 0) AS cash_revenue
      FROM sales s
      JOIN SalesAgent sa ON sa.SalesAgent = s.sales_agent_id
      JOIN Item i ON i.ItemCode = s.item_id
      WHERE ${salesCommonWhere('s')}
      GROUP BY sa.SalesAgent, s.currency
      ORDER BY (COALESCE(SUM(s.revenue), 0)) DESC;
    `)
    res.json(result.recordset)
  } catch (err) {
    next(err)
  }
})

/**
 * @openapi
 * /api/v1/performance/debtors:
 *   get:
 *     summary: Top-N debtor performance (Cash/Credit qty + revenue)
 *     tags: [Performance]
 *     parameters:
 *       - $ref: '#/components/parameters/date_from'
 *       - $ref: '#/components/parameters/date_to'
 *       - $ref: '#/components/parameters/branch'
 *       - $ref: '#/components/parameters/item'
 *       - $ref: '#/components/parameters/sales_agent'
 *       - $ref: '#/components/parameters/debtor'
 *       - $ref: '#/components/parameters/item_group'
 *       - $ref: '#/components/parameters/item_type'
 *       - $ref: '#/components/parameters/currency'
 *       - $ref: '#/components/parameters/limit'
 *     responses:
 *       200:
 *         description: Top N debtors by total revenue.
 */
performanceRouter.get('/performance/debtors', async (req, res, next) => {
  try {
    const filters = parseCommonFilters(req)
    const request = await getRequest()
    bindCommonFilters(request, filters)
    request.input('limit', sql.Int, getLimit(req))
    const result = await request.query(`
      WITH ${SALES_CTE}
      SELECT TOP (@limit)
        d.AccNo AS id, d.CompanyName AS name, s.currency,
        COALESCE(SUM(CASE WHEN s.is_credit = 1 THEN s.quantity ELSE 0 END), 0) AS credit_qty,
        COALESCE(SUM(CASE WHEN s.is_credit = 0 THEN s.quantity ELSE 0 END), 0) AS cash_qty,
        COALESCE(SUM(CASE WHEN s.is_credit = 1 THEN s.revenue ELSE 0 END), 0) AS credit_revenue,
        COALESCE(SUM(CASE WHEN s.is_credit = 0 THEN s.revenue ELSE 0 END), 0) AS cash_revenue
      FROM sales s
      JOIN Debtor d ON d.AccNo = s.debtor_id
      JOIN Item i ON i.ItemCode = s.item_id
      WHERE ${salesCommonWhere('s')}
      GROUP BY d.AccNo, d.CompanyName, s.currency
      ORDER BY (COALESCE(SUM(s.revenue), 0)) DESC;
    `)
    res.json(result.recordset)
  } catch (err) {
    next(err)
  }
})
