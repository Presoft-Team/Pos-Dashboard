import { Router } from 'express'
import sql from 'mssql'
import { getRequest } from '../db/pool'
import { SALES_CTE, ITEM_COST_CTE, STOCK_BALANCE_CTE } from '../db/sql-fragments'

export const itemsRouter = Router()

const NO_LIMIT = 2147483647

/**
 * @openapi
 * /api/v1/items:
 *   get:
 *     summary: Item catalog — cost, latest unit price, per-branch stock, qty sold
 *     description: >
 *       Without `search`: browse mode, top N items ranked by quantity sold.
 *       With `search`: lookup mode, every item matching the name/code, no
 *       ranking or limit.
 *     tags: [Items]
 *     parameters:
 *       - name: search
 *         in: query
 *         schema: { type: string }
 *         description: Matches item code or description.
 *       - $ref: '#/components/parameters/item_group'
 *       - $ref: '#/components/parameters/item_type'
 *       - $ref: '#/components/parameters/branch'
 *       - $ref: '#/components/parameters/item'
 *       - name: limit
 *         in: query
 *         schema: { type: integer, default: 6 }
 *         description: Browse-mode only — ignored when `search` is set.
 *     responses:
 *       200:
 *         description: One row per (item, branch) — an item with stock in 3 branches produces 3 rows.
 */
itemsRouter.get('/items', async (req, res, next) => {
  try {
    const search = typeof req.query.search === 'string' && req.query.search.trim() !== '' ? req.query.search.trim() : null
    const itemGroup = typeof req.query.item_group === 'string' ? req.query.item_group : null
    const itemType = typeof req.query.item_type === 'string' ? req.query.item_type : null
    const branch = typeof req.query.branch === 'string' ? req.query.branch : null
    const item = typeof req.query.item === 'string' ? req.query.item : null
    const limit = Number(req.query.limit ?? 6)

    const request = await getRequest()
    request.input('search', sql.NVarChar(200), search)
    request.input('item_group', sql.NVarChar(100), itemGroup)
    request.input('item_type', sql.NVarChar(100), itemType)
    request.input('branch', sql.NVarChar(50), branch)
    request.input('item', sql.NVarChar(50), item)
    // No limit at all in search mode — T-SQL's TOP has no "unlimited" form.
    request.input('effective_limit', sql.Int, search ? NO_LIMIT : (Number.isFinite(limit) ? limit : 6))

    const result = await request.query(`
      WITH ${SALES_CTE},
      ${ITEM_COST_CTE},
      ${STOCK_BALANCE_CTE},
      recent_price AS (
        -- Most recent CS or IV line per item, by DocDate (DtlKey as a
        -- same-day tie-breaker) — "most recent sale's unit price."
        SELECT item_id, UnitPrice AS unit_price FROM (
          SELECT
            x.item_id, x.UnitPrice, x.order_date, x.tie_key,
            ROW_NUMBER() OVER (PARTITION BY x.item_id ORDER BY x.order_date DESC, x.tie_key DESC) AS rn
          FROM (
            SELECT csd.ItemCode AS item_id, csd.UnitPrice, cs.DocDate AS order_date, csd.DtlKey AS tie_key
            FROM CS cs JOIN CSDTL csd ON csd.DocKey = cs.DocKey
            UNION ALL
            SELECT ivd.ItemCode, ivd.UnitPrice, iv.DocDate, ivd.DtlKey
            FROM IV iv JOIN IVDTL ivd ON ivd.DocKey = iv.DocKey
          ) x
        ) ranked
        WHERE rn = 1
      ),
      sold AS (
        SELECT item_id, COALESCE(SUM(quantity), 0) AS qty_sold
        FROM sales
        GROUP BY item_id
      ),
      matched_items AS (
        SELECT TOP (@effective_limit)
          i.ItemCode, i.Description, i.ItemGroup, i.ItemType, ic.Cost
        FROM Item i
        LEFT JOIN item_cost ic ON ic.ItemCode = i.ItemCode
        WHERE
          (@item_group IS NULL OR i.ItemGroup = @item_group)
          AND (@item_type IS NULL OR i.ItemType = @item_type)
          AND (@item IS NULL OR i.ItemCode = @item)
          AND (@search IS NULL OR i.Description LIKE '%' + @search + '%' OR i.ItemCode LIKE '%' + @search + '%')
        ORDER BY (SELECT qty_sold FROM sold WHERE sold.item_id = i.ItemCode) DESC, i.Description
      )
      SELECT
        mi.ItemCode AS item_id,
        mi.ItemCode AS item_code,
        mi.Description AS description,
        mi.ItemGroup AS item_group,
        mi.ItemType AS item_type,
        b.BranchName AS branch_name,
        COALESCE(sb.qty_on_hand, 0) AS qty_on_hand,
        COALESCE(mi.Cost, 0) AS cost,
        COALESCE(rp.unit_price, 0) AS unit_price,
        COALESCE(so.qty_sold, 0) AS qty_sold
      FROM matched_items mi
      LEFT JOIN stock_balance sb ON sb.item_id = mi.ItemCode AND (@branch IS NULL OR sb.branch_id = @branch)
      LEFT JOIN Branch b ON b.BranchCode = sb.branch_id
      LEFT JOIN recent_price rp ON rp.item_id = mi.ItemCode
      LEFT JOIN sold so ON so.item_id = mi.ItemCode
      ORDER BY COALESCE(so.qty_sold, 0) DESC, mi.Description, b.BranchName;
    `)
    res.json(result.recordset)
  } catch (err) {
    next(err)
  }
})
