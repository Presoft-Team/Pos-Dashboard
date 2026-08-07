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
import { ITEM_COST_CTE, STOCK_BALANCE_CTE } from '@/lib/db/sql-fragments'

const NO_LIMIT = 2147483647

interface ItemCatalogParams {
  p_search?: string | null
  p_item_group?: string | null
  p_item_type?: string | null
  p_branch?: string | null
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
  request.input('p_branch', sql.NVarChar(50), params.p_branch ?? null)
  request.input('p_item', sql.NVarChar(50), params.p_item ?? null)
  request.input('p_sort', sql.NVarChar(20), params.p_sort ?? 'item_code')
  // No limit at all in search mode — matches Postgres's `LIMIT NULL`.
  request.input('p_effective_limit', sql.Int, search ? NO_LIMIT : (params.p_limit ?? 6))

  const result = await request.query(`
    WITH ${ITEM_COST_CTE},
    ${STOCK_BALANCE_CTE},
    recent_price AS (
      -- Most recent CS or IV line per item, by DocDate (DtlKey as a same-day
      -- tie-breaker) — "most recent sale's unit price," not an average.
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
    -- Pick the N *items* first (ranked by p_sort in browse mode, or every
    -- search match) — branch stock is joined afterward, unlimited, so one
    -- item with 4 branches doesn't crowd out the other 5 slots. Cost/unit
    -- price are joined in here already (not after) so TOP can rank by them.
    matched_items AS (
      SELECT TOP (@p_effective_limit)
        i.ItemCode, i.Description, i.ItemGroup, i.ItemType, ic.Cost, rp.unit_price
      FROM Item i
      LEFT JOIN item_cost ic ON ic.ItemCode = i.ItemCode
      LEFT JOIN recent_price rp ON rp.item_id = i.ItemCode
      WHERE
        (@p_item_group IS NULL OR i.ItemGroup = @p_item_group)
        AND (@p_item_type IS NULL OR i.ItemType = @p_item_type)
        AND (@p_item IS NULL OR i.ItemCode = @p_item)
        -- Case-sensitivity here follows the database's collation, same as
        -- Postgres's original ILIKE (case-insensitive) assumed.
        AND (@p_search IS NULL OR i.Description LIKE '%' + @p_search + '%' OR i.ItemCode LIKE '%' + @p_search + '%')
      ORDER BY
        CASE WHEN @p_sort = 'cost_desc' THEN ic.Cost END DESC,
        CASE WHEN @p_sort = 'cost_asc' THEN ic.Cost END ASC,
        CASE WHEN @p_sort = 'price_desc' THEN rp.unit_price END DESC,
        CASE WHEN @p_sort = 'price_asc' THEN rp.unit_price END ASC,
        i.ItemCode
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
      COALESCE(mi.unit_price, 0) AS unit_price
    FROM matched_items mi
    LEFT JOIN stock_balance sb ON sb.item_id = mi.ItemCode AND (@p_branch IS NULL OR sb.branch_id = @p_branch)
    LEFT JOIN Branch b ON b.BranchCode = sb.branch_id
    ORDER BY
      CASE WHEN @p_sort = 'cost_desc' THEN mi.Cost END DESC,
      CASE WHEN @p_sort = 'cost_asc' THEN mi.Cost END ASC,
      CASE WHEN @p_sort = 'price_desc' THEN mi.unit_price END DESC,
      CASE WHEN @p_sort = 'price_asc' THEN mi.unit_price END ASC,
      mi.ItemCode, b.BranchName;
  `)
  return result.recordset
}
