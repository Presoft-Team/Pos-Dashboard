import { Router } from 'express'
import { getRequest } from '../db/pool'

export const filterOptionsRouter = Router()

interface EntityOption {
  id: string
  name: string
}

/**
 * @openapi
 * /api/v1/filter-options:
 *   get:
 *     summary: Dropdown lists and date range for every filterable dimension
 *     description: >
 *       `locations` reads dbo.Location, not dbo.Branch — the Branch filter
 *       was replaced with a Location filter by explicit request. Sales/
 *       purchase docs resolve to a Location via their own SalesLocation/
 *       PurchaseLocation column (see db/sql-fragments.ts).
 *     tags: [Filters]
 *     responses:
 *       200:
 *         description: Locations, items, sales agents, debtors, item groups/types, currencies, and the overall date range.
 */
filterOptionsRouter.get('/filter-options', async (_req, res, next) => {
  try {
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
      result.recordsets as unknown as [
        EntityOption[], EntityOption[], EntityOption[], EntityOption[],
        { value: string }[], { value: string }[], { value: string }[],
        { date_min: Date | null; date_max: Date | null }[]
      ]

    res.json({
      locations,
      items,
      sales_agents,
      debtors,
      item_groups: groups.map((r) => r.value),
      item_types: types.map((r) => r.value),
      currencies: currencies.map((r) => r.value),
      date_min: dates[0]?.date_min ? dates[0].date_min.toISOString().slice(0, 10) : null,
      date_max: dates[0]?.date_max ? dates[0].date_max.toISOString().slice(0, 10) : null,
    })
  } catch (err) {
    next(err)
  }
})
