// Shapes the /v2 Items page and its detail overlay work with.
//
// get_item_catalog_v2 returns one row per (item, location) — the per-item
// fields repeat across an item's rows. This folds them back into one entry
// per item with its locations underneath, the same way
// app/(dashboard)/item/page.tsx's groupByItem() does.
import { CostingMethod, ItemCatalogRow } from '@/types'

export interface V2ItemLocation {
  location_name: string | null
  qty_on_hand: number
  cost: number
}

export interface V2Item {
  item_code: string
  description: string
  item_group: string | null
  item_type: string | null
  costing_method: CostingMethod
  has_image: boolean
  // Fixed Cost items carry one cost book-wide; every other costing method
  // varies it per location, so read locations[].cost there instead.
  cost: number
  unit_price: number
  // ItemUOM's six tiers. A tier that is NULL in AutoCount stays null —
  // "not set" is not "priced at 0", so the overlay hides it rather than
  // printing a misleading zero.
  prices: (number | null)[]
  locations: V2ItemLocation[]
  total_qty: number
}

export const FIXED_COST: CostingMethod = 0

// Item.CostingMethod's tinyint values — see types/index.ts.
export const COSTING_METHOD_LABELS: Record<CostingMethod, string> = {
  0: 'Fixed Cost',
  1: 'Weighted Average',
  2: 'FIFO',
  3: 'LIFO',
}

export function groupItems(rows: ItemCatalogRow[]): V2Item[] {
  const map = new Map<string, V2Item>()
  for (const row of rows) {
    const entry = map.get(row.item_id) ?? {
      item_code: row.item_code,
      description: row.description,
      item_group: row.item_group,
      item_type: row.item_type,
      costing_method: row.costing_method,
      has_image: row.has_image,
      cost: row.cost,
      unit_price: row.unit_price,
      prices: [row.price1, row.price2, row.price3, row.price4, row.price5, row.price6],
      locations: [],
      total_qty: 0,
    }
    entry.locations.push({
      location_name: row.location_name,
      qty_on_hand: row.qty_on_hand,
      cost: row.cost,
    })
    entry.total_qty += row.qty_on_hand
    map.set(row.item_id, entry)
  }
  return [...map.values()]
}

// Gross margin on a price tier, against the item's own cost. Derived from
// two real figures rather than stored anywhere — null when there is no
// usable cost or price to derive it from, so the badge hides instead of
// reading 0.00%.
export function marginPct(price: number | null, cost: number): number | null {
  if (price == null || price <= 0 || cost <= 0) return null
  return ((price - cost) / price) * 100
}
