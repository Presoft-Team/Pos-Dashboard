import { Router } from 'express'
import sql from 'mssql'
import { getRequest } from '../db/pool'
import { ITEM_BASE_REF_CTE, STOCK_BALANCE_CTE } from '../db/sql-fragments'

export const itemsRouter = Router()

const NO_LIMIT = 2147483647

/**
 * @openapi
 * /api/v1/items:
 *   get:
 *     summary: Item catalog — cost, price, and qty broken down per location
 *     description: >
 *       Without `search`: browse mode, top N items ranked by `sort`. With
 *       `search`: lookup mode, every item matching the name/code, no limit
 *       (still ordered by `sort`). Cost and price are single-valued per item
 *       — both come from ItemUOM's Cost/Price columns on the item's BaseUOM
 *       row (not a stock-ledger snapshot or a recent sale's price, and no
 *       longer a per-location ItemLocationPrice override). Every row for the
 *       same item repeats the same cost/price; qty_on_hand is summed across
 *       UOM/batch into one total per stock location. `location` is a
 *       dbo.Location code — see GET /filter-options for the dropdown list
 *       (same list every other endpoint's `location` param uses).
 *     tags: [Items]
 *     parameters:
 *       - name: search
 *         in: query
 *         schema: { type: string }
 *         description: Matches item code or description.
 *       - $ref: '#/components/parameters/item_group'
 *       - $ref: '#/components/parameters/item_type'
 *       - $ref: '#/components/parameters/location'
 *       - $ref: '#/components/parameters/item'
 *       - name: sort
 *         in: query
 *         schema: { type: string, enum: [item_code, cost_desc, cost_asc, price_desc, price_asc], default: item_code }
 *         description: Ranking used for browse-mode's top N and the result order.
 *       - name: limit
 *         in: query
 *         schema: { type: integer, default: 6 }
 *         description: Browse-mode only — ignored when `search` is set.
 *     responses:
 *       200:
 *         description: One row per (item, location) — an item stocked at 2 locations produces up to 2 rows.
 */
itemsRouter.get('/items', async (req, res, next) => {
  try {
    const search = typeof req.query.search === 'string' && req.query.search.trim() !== '' ? req.query.search.trim() : null
    const itemGroup = typeof req.query.item_group === 'string' ? req.query.item_group : null
    const itemType = typeof req.query.item_type === 'string' ? req.query.item_type : null
    const location = typeof req.query.location === 'string' ? req.query.location : null
    const item = typeof req.query.item === 'string' ? req.query.item : null
    const sort = typeof req.query.sort === 'string' ? req.query.sort : 'item_code'
    const limit = Number(req.query.limit ?? 6)

    const request = await getRequest()
    request.input('search', sql.NVarChar(200), search)
    request.input('item_group', sql.NVarChar(100), itemGroup)
    request.input('item_type', sql.NVarChar(100), itemType)
    request.input('location', sql.NVarChar(50), location)
    request.input('item', sql.NVarChar(50), item)
    request.input('sort', sql.NVarChar(20), sort)
    // No limit at all in search mode — T-SQL's TOP has no "unlimited" form.
    request.input('effective_limit', sql.Int, search ? NO_LIMIT : (Number.isFinite(limit) ? limit : 6))

    const result = await request.query(`
      WITH ${ITEM_BASE_REF_CTE},
      ${STOCK_BALANCE_CTE},
      matched_items AS (
        SELECT TOP (@effective_limit)
          i.ItemCode, i.Description, i.ItemGroup, i.ItemType, ibr.base_cost, ibr.base_price
        FROM Item i
        LEFT JOIN item_base_ref ibr ON ibr.ItemCode = i.ItemCode
        WHERE
          (@item_group IS NULL OR i.ItemGroup = @item_group)
          AND (@item_type IS NULL OR i.ItemType = @item_type)
          AND (@item IS NULL OR i.ItemCode = @item)
          AND (@search IS NULL OR i.Description LIKE '%' + @search + '%' OR i.ItemCode LIKE '%' + @search + '%')
        ORDER BY
          CASE WHEN @sort = 'cost_desc' THEN ibr.base_cost END DESC,
          CASE WHEN @sort = 'cost_asc' THEN ibr.base_cost END ASC,
          CASE WHEN @sort = 'price_desc' THEN ibr.base_price END DESC,
          CASE WHEN @sort = 'price_asc' THEN ibr.base_price END ASC,
          i.ItemCode
      ),
      item_stock_rows AS (
        SELECT item_id, location_id, qty_on_hand FROM stock_balance
        UNION ALL
        SELECT item_id, CAST(NULL AS nvarchar(50)) AS location_id, qty_on_hand FROM no_stock_items
      )
      SELECT
        mi.ItemCode AS item_id,
        mi.ItemCode AS item_code,
        mi.Description AS description,
        mi.ItemGroup AS item_group,
        mi.ItemType AS item_type,
        COALESCE(mi.base_cost, 0) AS cost,
        COALESCE(mi.base_price, 0) AS unit_price,
        COALESCE(loc.Description, isr.location_id) AS location_name,
        COALESCE(isr.qty_on_hand, 0) AS qty_on_hand
      FROM matched_items mi
      LEFT JOIN item_stock_rows isr
        ON isr.item_id = mi.ItemCode
        AND (@location IS NULL OR isr.location_id = @location OR isr.location_id IS NULL)
      LEFT JOIN Location loc ON loc.Location = isr.location_id
      ORDER BY
        CASE WHEN @sort = 'cost_desc' THEN mi.base_cost END DESC,
        CASE WHEN @sort = 'cost_asc' THEN mi.base_cost END ASC,
        CASE WHEN @sort = 'price_desc' THEN mi.base_price END DESC,
        CASE WHEN @sort = 'price_asc' THEN mi.base_price END ASC,
        mi.ItemCode, isr.location_id;
    `)
    res.json(result.recordset)
  } catch (err) {
    next(err)
  }
})
