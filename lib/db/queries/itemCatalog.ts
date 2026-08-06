// Real equivalent of rpc_v2.sql's get_item_catalog_v2() — Item page.
// p_search: matches item_code or description. NULL -> default browse mode,
// ranked by qty sold, limited to p_limit (6 per PLAN.md §2). Non-NULL ->
// lookup mode, same fields, no ranking/limit.
//
// T-SQL's TOP doesn't support "no limit" directly (unlike Postgres's
// LIMIT NULL) — search mode passes a very large number as the effective
// TOP count instead, which is a no-op limit in practice.
import 'server-only'
import sql from 'mssql'
import { getRequest } from '@/lib/mssql'
import { SALES_CTE, ITEM_COST_CTE, STOCK_BALANCE_CTE } from '@/lib/db/sql-fragments'

const NO_LIMIT = 2147483647

interface ItemCatalogParams {
  p_search?: string | null
  p_item_group?: string | null
  p_item_type?: string | null
  p_branch?: string | null
  p_item?: string | null
  p_limit?: number | null
}

export async function getItemCatalog(params: ItemCatalogParams) {
  const request = await getRequest()
  const search = params.p_search?.trim() || null
  request.input('p_search', sql.NVarChar(200), search)
  request.input('p_item_group', sql.NVarChar(100), params.p_item_group ?? null)
  request.input('p_item_type', sql.NVarChar(100), params.p_item_type ?? null)
  request.input('p_branch', sql.NVarChar(50), params.p_branch ?? null)
  request.input('p_item', sql.NVarChar(50), params.p_item ?? null)
  // No limit at all in search mode — matches Postgres's `LIMIT NULL`.
  request.input('p_effective_limit', sql.Int, search ? NO_LIMIT : (params.p_limit ?? 6))

  const result = await request.query(`
    WITH ${SALES_CTE},
    ${ITEM_COST_CTE},
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
    sold AS (
      SELECT item_id, COALESCE(SUM(quantity), 0) AS qty_sold
      FROM sales
      GROUP BY item_id
    ),
    -- Pick the N *items* first (top-6-by-qty-sold in browse mode, or every
    -- search match) — branch stock is joined afterward, unlimited, so one
    -- popular item with 4 branches doesn't crowd out the other 5 slots.
    matched_items AS (
      SELECT TOP (@p_effective_limit)
        i.ItemCode, i.Description, i.ItemGroup, i.ItemType, ic.Cost
      FROM Item i
      LEFT JOIN item_cost ic ON ic.ItemCode = i.ItemCode
      WHERE
        (@p_item_group IS NULL OR i.ItemGroup = @p_item_group)
        AND (@p_item_type IS NULL OR i.ItemType = @p_item_type)
        AND (@p_item IS NULL OR i.ItemCode = @p_item)
        -- Case-sensitivity here follows the database's collation, same as
        -- Postgres's original ILIKE (case-insensitive) assumed.
        AND (@p_search IS NULL OR i.Description LIKE '%' + @p_search + '%' OR i.ItemCode LIKE '%' + @p_search + '%')
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
    LEFT JOIN stock_balance sb ON sb.item_id = mi.ItemCode AND (@p_branch IS NULL OR sb.branch_id = @p_branch)
    LEFT JOIN Branch b ON b.BranchCode = sb.branch_id
    LEFT JOIN recent_price rp ON rp.item_id = mi.ItemCode
    LEFT JOIN sold so ON so.item_id = mi.ItemCode
    ORDER BY COALESCE(so.qty_sold, 0) DESC, mi.Description, b.BranchName;
  `)
  return result.recordset
}
