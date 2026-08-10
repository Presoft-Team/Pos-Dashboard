import { Router } from 'express'
import sql from 'mssql'
import { getRequest } from '../db/pool'
import { parseCommonFilters, bindCommonFilters } from '../db/filters'
import { SALES_CTE, salesCommonWhere } from '../db/sql-fragments'

export const salesRouter = Router()

const GROUP_BY_CASE = (col: string) => `
  CASE @group_by
    WHEN 'group' THEN COALESCE(i.ItemGroup, 'Ungrouped')
    WHEN 'type'  THEN COALESCE(i.ItemType, 'Untyped')
    ELSE i.${col}
  END
`

/**
 * @openapi
 * /api/v1/sales/revenue:
 *   get:
 *     summary: Revenue by Item/Group/Type, split into Cash/Credit columns
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
 *       - $ref: '#/components/parameters/group_by'
 *     responses:
 *       200:
 *         description: One row per (bucket, currency). Every bucket is returned, not just a top N.
 */
salesRouter.get('/sales/revenue', async (req, res, next) => {
  try {
    const filters = parseCommonFilters(req)
    const groupBy = typeof req.query.group_by === 'string' ? req.query.group_by : 'item'
    const request = await getRequest()
    bindCommonFilters(request, filters)
    request.input('group_by', sql.NVarChar(10), groupBy)
    const result = await request.query(`
      WITH ${SALES_CTE}
      SELECT
        ${GROUP_BY_CASE('ItemCode')} AS bucket_name,
        s.currency,
        COALESCE(SUM(CASE WHEN s.is_credit = 1 THEN s.quantity ELSE 0 END), 0) AS credit_qty,
        COALESCE(SUM(CASE WHEN s.is_credit = 0 THEN s.quantity ELSE 0 END), 0) AS cash_qty,
        COALESCE(SUM(CASE WHEN s.is_credit = 1 THEN s.revenue ELSE 0 END), 0) AS credit_revenue,
        COALESCE(SUM(CASE WHEN s.is_credit = 0 THEN s.revenue ELSE 0 END), 0) AS cash_revenue
      FROM sales s
      JOIN Item i ON i.ItemCode = s.item_id
      WHERE ${salesCommonWhere('s')}
      GROUP BY ${GROUP_BY_CASE('ItemCode')}, s.currency
      ORDER BY (COALESCE(SUM(s.revenue), 0)) DESC;
    `)
    res.json(result.recordset)
  } catch (err) {
    next(err)
  }
})

/**
 * @openapi
 * /api/v1/sales/best-sellers:
 *   get:
 *     summary: Top-N best sellers by Item/Group/Type, split into Cash/Credit columns
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
 *       - $ref: '#/components/parameters/group_by'
 *       - $ref: '#/components/parameters/limit'
 *     responses:
 *       200:
 *         description: Top N rows by total revenue, one row per (bucket, currency).
 */
salesRouter.get('/sales/best-sellers', async (req, res, next) => {
  try {
    const filters = parseCommonFilters(req)
    const groupBy = typeof req.query.group_by === 'string' ? req.query.group_by : 'item'
    const limit = Number(req.query.limit ?? 5)
    const request = await getRequest()
    bindCommonFilters(request, filters)
    request.input('group_by', sql.NVarChar(10), groupBy)
    request.input('limit', sql.Int, Number.isFinite(limit) ? limit : 5)
    const result = await request.query(`
      WITH ${SALES_CTE}
      SELECT TOP (@limit)
        ${GROUP_BY_CASE('ItemCode')} AS bucket_name,
        s.currency,
        COALESCE(SUM(CASE WHEN s.is_credit = 1 THEN s.quantity ELSE 0 END), 0) AS credit_qty,
        COALESCE(SUM(CASE WHEN s.is_credit = 0 THEN s.quantity ELSE 0 END), 0) AS cash_qty,
        COALESCE(SUM(CASE WHEN s.is_credit = 1 THEN s.revenue ELSE 0 END), 0) AS credit_revenue,
        COALESCE(SUM(CASE WHEN s.is_credit = 0 THEN s.revenue ELSE 0 END), 0) AS cash_revenue
      FROM sales s
      JOIN Item i ON i.ItemCode = s.item_id
      WHERE ${salesCommonWhere('s')}
      GROUP BY ${GROUP_BY_CASE('ItemCode')}, s.currency
      ORDER BY (COALESCE(SUM(s.revenue), 0)) DESC;
    `)
    res.json(result.recordset)
  } catch (err) {
    next(err)
  }
})
