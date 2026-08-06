import { Router } from 'express'
import sql from 'mssql'
import { getRequest } from '../db/pool'
import { parseCommonFilters, bindCommonFilters, CommonFilters } from '../db/filters'
import { SALES_CTE, PURCHASES_CTE, salesCommonWhere } from '../db/sql-fragments'

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
 *       - $ref: '#/components/parameters/creditor'
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
        b.BranchCode AS id, b.BranchName AS name, s.currency,
        COALESCE(SUM(CASE WHEN s.is_credit = 1 THEN s.quantity ELSE 0 END), 0) AS credit_qty,
        COALESCE(SUM(CASE WHEN s.is_credit = 0 THEN s.quantity ELSE 0 END), 0) AS cash_qty,
        COALESCE(SUM(CASE WHEN s.is_credit = 1 THEN s.revenue ELSE 0 END), 0) AS credit_revenue,
        COALESCE(SUM(CASE WHEN s.is_credit = 0 THEN s.revenue ELSE 0 END), 0) AS cash_revenue
      FROM sales s
      JOIN Branch b ON b.BranchCode = s.branch_id
      JOIN Item i ON i.ItemCode = s.item_id
      WHERE ${salesCommonWhere('s')}
      GROUP BY b.BranchCode, b.BranchName, s.currency
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
 *       - $ref: '#/components/parameters/creditor'
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
          ELSE i.Description
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
          ELSE i.Description
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
 *       - $ref: '#/components/parameters/creditor'
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
        sa.SalesAgent AS id, sa.Description AS name, s.currency,
        COALESCE(SUM(CASE WHEN s.is_credit = 1 THEN s.quantity ELSE 0 END), 0) AS credit_qty,
        COALESCE(SUM(CASE WHEN s.is_credit = 0 THEN s.quantity ELSE 0 END), 0) AS cash_qty,
        COALESCE(SUM(CASE WHEN s.is_credit = 1 THEN s.revenue ELSE 0 END), 0) AS credit_revenue,
        COALESCE(SUM(CASE WHEN s.is_credit = 0 THEN s.revenue ELSE 0 END), 0) AS cash_revenue
      FROM sales s
      JOIN SalesAgent sa ON sa.SalesAgent = s.sales_agent_id
      JOIN Item i ON i.ItemCode = s.item_id
      WHERE ${salesCommonWhere('s')}
      GROUP BY sa.SalesAgent, sa.Description, s.currency
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
 *       - $ref: '#/components/parameters/creditor'
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

/**
 * @openapi
 * /api/v1/performance/creditors:
 *   get:
 *     summary: Top-N creditor performance — purchase qty/cost, bridged through shared items
 *     description: >
 *       Creditors have no direct link to Branch/Sales Agent/Debtor — only a
 *       shared Item. Filtering by those dimensions narrows the item set via
 *       sales first, then purchases are summed for creditors supplying that
 *       item set. `credit_qty`/`credit_revenue` are always 0 (purchases
 *       have no cash/credit concept) — `cash_qty`/`cash_revenue` are reused
 *       to mean total purchase quantity/cost.
 *     tags: [Performance]
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
 *       - $ref: '#/components/parameters/limit'
 *     responses:
 *       200:
 *         description: Top N creditors by total purchase cost.
 */
performanceRouter.get('/performance/creditors', async (req, res, next) => {
  try {
    const filters: CommonFilters = parseCommonFilters(req)
    const request = await getRequest()
    bindCommonFilters(request, filters)
    request.input('limit', sql.Int, getLimit(req))
    const result = await request.query(`
      WITH ${SALES_CTE}, ${PURCHASES_CTE},
      scoped_items AS (
        SELECT DISTINCT s.item_id
        FROM sales s
        JOIN Item i ON i.ItemCode = s.item_id
        WHERE
          (@date_from IS NULL OR s.order_date >= @date_from)
          AND (@date_to IS NULL OR s.order_date <= @date_to)
          AND (@branch IS NULL OR s.branch_id = @branch)
          AND (@item IS NULL OR s.item_id = @item)
          AND (@sales_agent IS NULL OR s.sales_agent_id = @sales_agent)
          AND (@debtor IS NULL OR s.debtor_id = @debtor)
          AND (@item_group IS NULL OR i.ItemGroup = @item_group)
          AND (@item_type IS NULL OR i.ItemType = @item_type)
      )
      SELECT TOP (@limit)
        cr.AccNo AS id, cr.CompanyName AS name, pu.currency,
        0 AS credit_qty,
        COALESCE(SUM(pu.quantity), 0) AS cash_qty,
        0 AS credit_revenue,
        COALESCE(SUM(pu.quantity * pu.unit_cost), 0) AS cash_revenue
      FROM purchases pu
      JOIN Creditor cr ON cr.AccNo = pu.creditor_id
      JOIN Item i ON i.ItemCode = pu.item_id
      WHERE
        (@date_from IS NULL OR pu.order_date >= @date_from)
        AND (@date_to IS NULL OR pu.order_date <= @date_to)
        AND (@creditor IS NULL OR pu.creditor_id = @creditor)
        AND (@currency IS NULL OR pu.currency = @currency)
        AND (@item_group IS NULL OR i.ItemGroup = @item_group)
        AND (@item_type IS NULL OR i.ItemType = @item_type)
        AND (
          (@branch IS NULL AND @item IS NULL AND @sales_agent IS NULL AND @debtor IS NULL)
          OR pu.item_id IN (SELECT item_id FROM scoped_items)
        )
      GROUP BY cr.AccNo, cr.CompanyName, pu.currency
      ORDER BY cash_revenue DESC;
    `)
    res.json(result.recordset)
  } catch (err) {
    next(err)
  }
})
