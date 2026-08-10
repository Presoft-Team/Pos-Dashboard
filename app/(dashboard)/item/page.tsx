'use client'

import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { createClient } from '@/lib/db/client'
import { GroupByMode, ItemCatalogRow } from '@/types'
import { useSharedFilters } from '@/lib/filter-context'
import { formatAmount } from '@/lib/currency'
import Combobox from '@/components/combobox'
import GroupByToggle from '@/components/group-by-toggle'
import SortSelect from '@/components/sort-select'

interface ItemGroup {
  item_id: string
  item_code: string
  description: string
  item_group: string | null
  item_type: string | null
  // Single value per item — from ItemUOM's BaseUOM Cost/Price, same for
  // every location/UOM/batch row that item has (see sql-fragments.ts's
  // ITEM_BASE_REF_CTE), so it's hoisted here instead of repeated per row.
  cost: number
  unit_price: number
  locations: {
    location_name: string | null
    qty_on_hand: number
  }[]
}

function groupByItem(rows: ItemCatalogRow[]): ItemGroup[] {
  const map = new Map<string, ItemGroup>()
  for (const row of rows) {
    const entry = map.get(row.item_id) ?? {
      item_id: row.item_id, item_code: row.item_code, description: row.description,
      item_group: row.item_group, item_type: row.item_type,
      cost: row.cost, unit_price: row.unit_price, locations: [],
    }
    entry.locations.push({
      location_name: row.location_name, qty_on_hand: row.qty_on_hand,
    })
    map.set(row.item_id, entry)
  }
  return [...map.values()]
}

const SORT_OPTIONS = [
  { value: 'item_code', label: 'Item Code (A–Z)' },
  { value: 'cost_desc', label: 'Cost: High to Low' },
  { value: 'cost_asc', label: 'Cost: Low to High' },
  { value: 'price_desc', label: 'Unit Price: High to Low' },
  { value: 'price_asc', label: 'Unit Price: Low to High' },
] as const

const LOCATION_TABLE_INITIAL_VISIBLE = 5
const LOCATION_TABLE_SHOW_MORE_STEP = 5

// Per-item stock-location table — needs its own expand/collapse state per
// item card, hence a separate component rather than inline JSX in the
// items.map() below.
function LocationStockTable({ locations }: { locations: ItemGroup['locations'] }) {
  const [visibleCount, setVisibleCount] = useState(LOCATION_TABLE_INITIAL_VISIBLE)

  const visibleLocations = locations.slice(0, visibleCount)
  const hasMore = visibleCount < locations.length
  const isExpanded = visibleCount > LOCATION_TABLE_INITIAL_VISIBLE

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left">
              <th className="px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Location</th>
              <th className="px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide text-right">Qty on Hand</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {visibleLocations.map((l, i) => (
              <tr key={i}>
                <td className="px-4 py-2.5 text-gray-700">{l.location_name ?? '—'}</td>
                <td className="px-4 py-2.5 text-right text-gray-700">{l.qty_on_hand.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(hasMore || isExpanded) && (
        <div className="flex items-center justify-center gap-3 px-5 py-3 border-t border-gray-100">
          {hasMore && (
            <button
              onClick={() => setVisibleCount((c) => Math.min(c + LOCATION_TABLE_SHOW_MORE_STEP, locations.length))}
              className="text-sm font-medium text-brand hover:text-brand/80 transition-colors"
            >
              Show 5 more
            </button>
          )}
          {hasMore && (
            <button
              onClick={() => setVisibleCount(locations.length)}
              className="text-sm font-medium text-brand hover:text-brand/80 transition-colors"
            >
              Show all
            </button>
          )}
          {isExpanded && (
            <button
              onClick={() => setVisibleCount(LOCATION_TABLE_INITIAL_VISIBLE)}
              className="text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
            >
              Show less
            </button>
          )}
        </div>
      )}
    </>
  )
}

const ITEM_LIST_INITIAL_VISIBLE = 5
const ITEM_LIST_SHOW_MORE_STEP = 5

// Catalog/master-data page — NOT a sales-performance page. Default view
// shows the top items ranked by `sort`; searching by name/ID switches to a
// direct lookup instead of a ranking (PLAN.md Section 7).
export default function ItemPage() {
  const supabase = createClient()

  const { filters, setFilters, groupBy, setGroupBy, options } = useSharedFilters()
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<string>('item_code')
  const [items, setItems] = useState<ItemGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [visibleItemCount, setVisibleItemCount] = useState(ITEM_LIST_INITIAL_VISIBLE)

  // Debounced so fast typing doesn't fire an RPC call per keystroke.
  useEffect(() => {
    const t = setTimeout(fetchData, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, sort, filters.location, filters.item, filters.item_group, filters.item_type])

  // The Item/Group/Type toggle swaps which of the 3 fields the dynamic
  // combobox filters by — clear the other two so switching modes doesn't
  // leave a stale, now-invisible filter silently narrowing results.
  function handleGroupByChange(next: GroupByMode) {
    setGroupBy(next)
    setFilters((f) => ({ ...f, item: '', item_group: '', item_type: '' }))
  }

  async function fetchData() {
    setLoading(true)
    // p_limit: null (= no LIMIT) fetches every matching item — the "Show 5
    // more / Show all / Show less" controls below do the actual paginating
    // client-side, same reasoning as the Performance page's breakdown tables.
    const { data, error } = await supabase.rpc('get_item_catalog_v2', {
      p_search: search.trim() || null,
      p_item: filters.item || null,
      p_item_group: filters.item_group || null,
      p_item_type: filters.item_type || null,
      p_location: filters.location || null,
      p_sort: sort,
      p_limit: null,
    })
    if (error) console.error('get_item_catalog_v2 error:', error.message)
    setItems(groupByItem((data as ItemCatalogRow[]) ?? []))
    setVisibleItemCount(ITEM_LIST_INITIAL_VISIBLE)
    setLoading(false)
  }

  // One slot whose meaning follows the active Group By mode — Item, Item
  // Group, or Item Type — instead of showing all three at once.
  const itemDynamic =
    groupBy === 'group' ? (
      <Combobox
        value={filters.item_group}
        onChange={(v) => setFilters({ ...filters, item_group: v })}
        options={options.item_groups.map((g) => ({ id: g, name: g }))}
        placeholder="All Item Groups"
        ariaLabel="Item Group"
        fullWidth
      />
    ) : groupBy === 'type' ? (
      <Combobox
        value={filters.item_type}
        onChange={(v) => setFilters({ ...filters, item_type: v })}
        options={options.item_types.map((t) => ({ id: t, name: t }))}
        placeholder="All Item Types"
        ariaLabel="Item Type"
        fullWidth
      />
    ) : (
      <Combobox
        value={filters.item}
        onChange={(v) => setFilters({ ...filters, item: v })}
        options={options.items}
        placeholder="All Items"
        ariaLabel="Item"
        fullWidth
      />
    )

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Item</h1>
        <p className="text-sm text-gray-500">
          {search.trim() ? 'Search results' : 'Browse items'}
        </p>
      </div>

      {/* Filters — mobile: Search / Sort(60%)+Location(40%) / Toggle+Item,
          each its own row; desktop: single wrapped line. Different enough
          splits (mobile pairs Location with Sort, desktop pairs Location
          with Search) that it's two layouts, same pattern as FilterBar. */}
      <div className="sm:hidden space-y-2">
        <div className="relative w-full">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by item name or ID…"
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
          />
        </div>
        <div className="grid grid-cols-[3fr_2fr] gap-2">
          <div className="min-w-0">
            <SortSelect value={sort} options={SORT_OPTIONS} onChange={setSort} ariaLabel="Sort by" />
          </div>
          <div className="min-w-0">
            <Combobox
              value={filters.location}
              onChange={(v) => setFilters({ ...filters, location: v })}
              options={options.locations}
              placeholder="All Locations"
              ariaLabel="Location"
              fullWidth
            />
          </div>
        </div>
        <div className="flex gap-2">
          <div className="flex-1 min-w-0">
            <GroupByToggle value={groupBy} onChange={handleGroupByChange} />
          </div>
          <div className="flex-1 min-w-0">{itemDynamic}</div>
        </div>
      </div>

      <div className="hidden sm:flex sm:flex-col sm:gap-2">
        {/* Search 60% / Sort 40% */}
        <div className="grid grid-cols-[6fr_4fr] gap-2">
          <div className="relative min-w-0">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by item name or ID…"
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
            />
          </div>
          <div className="min-w-0">
            <SortSelect value={sort} options={SORT_OPTIONS} onChange={setSort} ariaLabel="Sort by" />
          </div>
        </div>
        {/* Toggle 20% / Item-Group-Type combobox 40% / Location 40% — each
            grid child wrapped in min-w-0, otherwise a grid item's default
            min-width is its content's intrinsic width, which overflows the
            cell instead of shrinking once the track gets this narrow. */}
        <div className="grid grid-cols-[2fr_4fr_4fr] gap-2">
          <div className="min-w-0">
            <GroupByToggle value={groupBy} onChange={handleGroupByChange} />
          </div>
          <div className="min-w-0">{itemDynamic}</div>
          <div className="min-w-0">
            <Combobox
              value={filters.location}
              onChange={(v) => setFilters({ ...filters, location: v })}
              options={options.locations}
              placeholder="All Locations"
              ariaLabel="Location"
              fullWidth
            />
          </div>
        </div>
      </div>

      {/* Item cards */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex items-center justify-center h-40 text-gray-400 text-sm">No items found</div>
      ) : (
        <div className="space-y-4">
          {items.slice(0, visibleItemCount).map((item) => (
            <div key={item.item_id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm">{item.item_code}</h3>
                  <p className="text-xs text-gray-400">
                    {item.description || "No description available"}
                    {item.item_group ? ` · ${item.item_group}` : ''}
                    {item.item_type ? ` · ${item.item_type}` : ''}
                  </p>
                </div>
                <div className="text-right shrink-0 text-xs">
                  <p className="text-gray-400">Cost <span className="text-gray-700 font-medium">{formatAmount(item.cost)}</span></p>
                  <p className="text-gray-400">Price <span className="text-gray-700 font-medium">{formatAmount(item.unit_price)}</span></p>
                </div>
              </div>

              {item.locations.length > 0 ? (
                <LocationStockTable locations={item.locations} />
              ) : (
                <p className="px-5 py-3 text-xs text-gray-400">No stock location recorded</p>
              )}
            </div>
          ))}
        </div>
      )}

      {!loading && (visibleItemCount < items.length || visibleItemCount > ITEM_LIST_INITIAL_VISIBLE) && (
        <div className="flex items-center justify-center gap-3">
          {visibleItemCount < items.length && (
            <button
              onClick={() => setVisibleItemCount((c) => Math.min(c + ITEM_LIST_SHOW_MORE_STEP, items.length))}
              className="text-sm font-medium text-brand hover:text-brand/80 transition-colors"
            >
              Show 5 more
            </button>
          )}
          {visibleItemCount < items.length && (
            <button
              onClick={() => setVisibleItemCount(items.length)}
              className="text-sm font-medium text-brand hover:text-brand/80 transition-colors"
            >
              Show all
            </button>
          )}
          {visibleItemCount > ITEM_LIST_INITIAL_VISIBLE && (
            <button
              onClick={() => setVisibleItemCount(ITEM_LIST_INITIAL_VISIBLE)}
              className="text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
            >
              Show less
            </button>
          )}
        </div>
      )}
    </div>
  )
}
