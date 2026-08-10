// Real equivalent of rpc_v2.sql's get_filter_options_v2(). Populates the
// Global FilterBar's 4 entity dropdowns + item group/type/currency lists +
// date range. See PLAN.md §2 — `id` is the natural business code (no
// synthetic surrogate key), so `locations`/`items`/etc. below are exactly
// `{ id, name }` pairs off the real master tables.
// `locations` reads dbo.Location, not dbo.Branch — the app's Branch filter
// was replaced with a Location filter by explicit request, unifying with
// what used to be the Item page's own separate get_item_locations_v2 fetch
// (same table, same shape) — see lib/db/sql-fragments.ts's SALES_CTE/
// PURCHASES_CTE for how sales/purchase docs resolve to a Location via their
// own SalesLocation/PurchaseLocation column.
import 'server-only'
import { getRequest } from '@/lib/mssql'

interface EntityOption {
  id: string
  name: string
}

export async function getFilterOptions() {
  const request = await getRequest()
  const result = await request.query(`
    SELECT Location AS id, COALESCE(Description, Location) AS name FROM Location ORDER BY Location;
    SELECT ItemCode AS id, ItemCode AS name FROM Item ORDER BY ItemCode;
    SELECT SalesAgent AS id, SalesAgent AS name FROM SalesAgent ORDER BY SalesAgent;
    SELECT AccNo AS id, CompanyName AS name FROM Debtor ORDER BY CompanyName;
    SELECT DISTINCT ItemGroup AS value FROM Item WHERE ItemGroup IS NOT NULL ORDER BY ItemGroup;
    SELECT DISTINCT ItemType AS value FROM Item WHERE ItemType IS NOT NULL ORDER BY ItemType;
    SELECT DISTINCT CurrencyCode AS value FROM (
      SELECT CurrencyCode FROM CS
      UNION SELECT CurrencyCode FROM IV
      UNION SELECT CurrencyCode FROM PI
    ) c ORDER BY CurrencyCode;
    SELECT MIN(d) AS date_min, MAX(d) AS date_max FROM (
      SELECT DocDate AS d FROM CS UNION ALL SELECT DocDate FROM IV
    ) x;
  `)

  const [locations, items, sales_agents, debtors, groups, types, currencies, dates] =
    result.recordsets as unknown as [EntityOption[], EntityOption[], EntityOption[], EntityOption[], { value: string }[], { value: string }[], { value: string }[], { date_min: Date | null; date_max: Date | null }[]]

  // Returned as a 1-element array — matches Supabase's RETURNS TABLE shape,
  // which every caller reads via `data?.[0]` (see e.g. app/(dashboard)/page.tsx).
  return [
    {
      locations,
      items,
      sales_agents,
      debtors,
      item_groups: groups.map((r) => r.value),
      item_types: types.map((r) => r.value),
      currencies: currencies.map((r) => r.value),
      date_min: dates[0]?.date_min ? dates[0].date_min.toISOString().slice(0, 10) : null,
      date_max: dates[0]?.date_max ? dates[0].date_max.toISOString().slice(0, 10) : null,
    },
  ]
}
