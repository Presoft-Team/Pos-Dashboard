// Real equivalent of rpc_v2.sql's get_item_catalog_v2() — Item page.
// p_search: matches item_code or description. NULL -> default browse mode,
// ranked by p_sort, limited to p_limit (6 per PLAN.md §2). Non-NULL ->
// lookup mode, same fields, no ranking/limit (still ordered by p_sort).
//
// No qty_sold here — it isn't displayed and isn't a sort option, so this
// doesn't need SALES_CTE's 3-way union at all (a real cost saving; that
// union is the expensive part of every other query that needs it).
//
// T-SQL's TOP doesn't support "no limit" directly (unlike Postgres's
// LIMIT NULL) — search mode passes a very large number as the effective
// TOP count instead, which is a no-op limit in practice.
import 'server-only'
import sql from 'mssql'
import { getRequest } from '@/lib/mssql'
import { ITEM_BASE_REF_CTE, STOCK_BALANCE_CTE } from '@/lib/db/sql-fragments'

const NO_LIMIT = 2147483647

interface ItemCatalogParams {
  p_search?: string | null
  p_item_group?: string | null
  p_item_type?: string | null
  // dbo.Location code — same shared list every other page's location filter
  // uses (see lib/db/queries/filterOptions.ts / STOCK_BALANCE_CTE).
  p_location?: string | null
  p_item?: string | null
  p_limit?: number | null
  // 'item_code' (default) | 'cost_desc' | 'cost_asc' | 'price_desc' | 'price_asc'
  p_sort?: string | null
}

export async function getItemCatalog(params: ItemCatalogParams) {
  const request = await getRequest()
  const search = params.p_search?.trim() || null
  request.input('p_search', sql.NVarChar(200), search)
  request.input('p_item_group', sql.NVarChar(100), params.p_item_group ?? null)
  request.input('p_item_type', sql.NVarChar(100), params.p_item_type ?? null)
  request.input('p_location', sql.NVarChar(50), params.p_location ?? null)
  request.input('p_item', sql.NVarChar(50), params.p_item ?? null)
  request.input('p_sort', sql.NVarChar(20), params.p_sort ?? 'item_code')
  // No limit at all in search mode — matches Postgres's `LIMIT NULL`.
  request.input('p_effective_limit', sql.Int, search ? NO_LIMIT : (params.p_limit ?? 6))

  const result = await request.query(`
    WITH ${ITEM_BASE_REF_CTE},
    ${STOCK_BALANCE_CTE},
    -- Pick the N *items* first (ranked by p_sort in browse mode, or every
    -- search match) — location stock is joined afterward, unlimited, so one
    -- item with several stock locations doesn't crowd out the other slots.
    -- Ranked by item_base_ref's BaseUOM cost/price — the same single value
    -- carried onto every stock row below, not just used for ranking here.
    matched_items AS (
      SELECT TOP (@p_effective_limit)
        i.ItemCode, i.Description, i.ItemGroup, i.ItemType, ibr.base_cost, ibr.base_price
      FROM Item i
      LEFT JOIN item_base_ref ibr ON ibr.ItemCode = i.ItemCode
      WHERE
        (@p_item_group IS NULL OR i.ItemGroup = @p_item_group)
        AND (@p_item_type IS NULL OR i.ItemType = @p_item_type)
        AND (@p_item IS NULL OR i.ItemCode = @p_item)
        -- Case-sensitivity here follows the database's collation, same as
        -- Postgres's original ILIKE (case-insensitive) assumed.
        AND (@p_search IS NULL OR i.Description LIKE '%' + @p_search + '%' OR i.ItemCode LIKE '%' + @p_search + '%')
      ORDER BY
        CASE WHEN @p_sort = 'cost_desc' THEN ibr.base_cost END DESC,
        CASE WHEN @p_sort = 'cost_asc' THEN ibr.base_cost END ASC,
        CASE WHEN @p_sort = 'price_desc' THEN ibr.base_price END DESC,
        CASE WHEN @p_sort = 'price_asc' THEN ibr.base_price END ASC,
        i.ItemCode
    ),
    -- Real stock rows (location_id set) unioned with the zero-movement
    -- fallback (location_id NULL) so an item that never moved still shows
    -- up with 0 qty instead of going blank. Qty only, one row per location
    -- — cost/price come from matched_items (item-level) in the final SELECT
    -- below.
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
      AND (@p_location IS NULL OR isr.location_id = @p_location OR isr.location_id IS NULL)
    LEFT JOIN Location loc ON loc.Location = isr.location_id
    ORDER BY
      CASE WHEN @p_sort = 'cost_desc' THEN mi.base_cost END DESC,
      CASE WHEN @p_sort = 'cost_asc' THEN mi.base_cost END ASC,
      CASE WHEN @p_sort = 'price_desc' THEN mi.base_price END DESC,
      CASE WHEN @p_sort = 'price_asc' THEN mi.base_price END ASC,
      mi.ItemCode, isr.location_id;
  `)
  return result.recordset
}
