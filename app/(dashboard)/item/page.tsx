'use client'

import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { createClient } from '@/lib/db/client'
import { FilterOptions, Filters, GroupByMode, ItemCatalogRow } from '@/types'
import { DEFAULT_FILTERS, DEFAULT_OPTIONS } from '@/lib/filters'
import { formatAmount } from '@/lib/currency'
import Combobox from '@/components/combobox'
import GroupByToggle from '@/components/group-by-toggle'

interface ItemGroup {
  item_id: string
  item_code: string
  description: string
  item_group: string | null
  item_type: string | null
  cost: number         // one value per item, same across every branch
  unit_price: number
  qty_sold: number
  branches: { branch_name: string; qty_on_hand: number }[]
}

function groupByItem(rows: ItemCatalogRow[]): ItemGroup[] {
  const map = new Map<string, ItemGroup>()
  for (const row of rows) {
    const entry = map.get(row.item_id) ?? {
      item_id: row.item_id, item_code: row.item_code, description: row.description,
      item_group: row.item_group, item_type: row.item_type,
      cost: row.cost, unit_price: row.unit_price, qty_sold: row.qty_sold, branches: [],
    }
    if (row.branch_name) entry.branches.push({ branch_name: row.branch_name, qty_on_hand: row.qty_on_hand })
    map.set(row.item_id, entry)
  }
  return [...map.values()]
}

const BRANCH_TABLE_INITIAL_VISIBLE = 5
const BRANCH_TABLE_SHOW_MORE_STEP = 5

// Per-item branch stock table — needs its own expand/collapse state per
// item card, hence a separate component rather than inline JSX in the
// items.map() below.
function BranchStockTable({ branches }: { branches: ItemGroup['branches'] }) {
  const [visibleCount, setVisibleCount] = useState(BRANCH_TABLE_INITIAL_VISIBLE)

  const visibleBranches = branches.slice(0, visibleCount)
  const hasMore = visibleCount < branches.length
  const isExpanded = visibleCount > BRANCH_TABLE_INITIAL_VISIBLE

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left">
              <th className="px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Branch</th>
              <th className="px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide text-right">Qty on Hand</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {visibleBranches.map((b, i) => (
              <tr key={i}>
                <td className="px-4 py-2.5 text-gray-700">{b.branch_name}</td>
                <td className="px-4 py-2.5 text-right text-gray-700">{b.qty_on_hand.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(hasMore || isExpanded) && (
        <div className="flex items-center justify-center gap-3 px-5 py-3 border-t border-gray-100">
          {hasMore && (
            <button
              onClick={() => setVisibleCount((c) => Math.min(c + BRANCH_TABLE_SHOW_MORE_STEP, branches.length))}
              className="text-sm font-medium text-brand hover:text-brand/80 transition-colors"
            >
              Show 5 more
            </button>
          )}
          {hasMore && (
            <button
              onClick={() => setVisibleCount(branches.length)}
              className="text-sm font-medium text-brand hover:text-brand/80 transition-colors"
            >
              Show all
            </button>
          )}
          {isExpanded && (
            <button
              onClick={() => setVisibleCount(BRANCH_TABLE_INITIAL_VISIBLE)}
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
// shows the top 5 items by qty sold; searching by name/ID switches to a
// direct lookup instead of a ranking (PLAN.md Section 7).
export default function ItemPage() {
  const supabase = createClient()

  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [options, setOptions] = useState<FilterOptions>(DEFAULT_OPTIONS)
  const [groupBy, setGroupBy] = useState<GroupByMode>('item')
  const [search, setSearch] = useState('')
  const [items, setItems] = useState<ItemGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [visibleItemCount, setVisibleItemCount] = useState(ITEM_LIST_INITIAL_VISIBLE)

  useEffect(() => { fetchOptions() }, [])

  // Debounced so fast typing doesn't fire an RPC call per keystroke.
  useEffect(() => {
    const t = setTimeout(fetchData, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, filters.branch, filters.item, filters.item_group, filters.item_type])

  // The Item/Group/Type toggle swaps which of the 3 fields the dynamic
  // combobox filters by — clear the other two so switching modes doesn't
  // leave a stale, now-invisible filter silently narrowing results.
  function handleGroupByChange(next: GroupByMode) {
    setGroupBy(next)
    setFilters((f) => ({ ...f, item: '', item_group: '', item_type: '' }))
  }

  async function fetchOptions() {
    const { data } = await supabase.rpc('get_filter_options_v2')
    if (data?.[0]) setOptions(data[0] as FilterOptions)
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
      p_branch: filters.branch || null,
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
      />
    ) : groupBy === 'type' ? (
      <Combobox
        value={filters.item_type}
        onChange={(v) => setFilters({ ...filters, item_type: v })}
        options={options.item_types.map((t) => ({ id: t, name: t }))}
        placeholder="All Item Types"
        ariaLabel="Item Type"
      />
    ) : (
      <Combobox
        value={filters.item}
        onChange={(v) => setFilters({ ...filters, item: v })}
        options={options.items}
        placeholder="All Items"
        ariaLabel="Item"
      />
    )

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Item</h1>
        <p className="text-sm text-gray-500">
          {search.trim() ? 'Search results' : 'Top 5 items by quantity sold'}
        </p>
      </div>

      {/* Filters — Search + Branch (50/50 on mobile), Toggle + Item/Group/Type (50/50 on mobile) */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex gap-2">
          <div className="relative flex-1 min-w-0 sm:flex-none sm:w-64">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by item name or ID…"
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
            />
          </div>
          <div className="flex-1 min-w-0 sm:flex-none">
            <Combobox
              value={filters.branch}
              onChange={(v) => setFilters({ ...filters, branch: v })}
              options={options.branches}
              placeholder="All Branches"
              ariaLabel="Branch"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <div className="flex-1 min-w-0 sm:flex-none">
            <GroupByToggle value={groupBy} onChange={handleGroupByChange} />
          </div>
          <div className="flex-1 min-w-0 sm:flex-none">{itemDynamic}</div>
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
              <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm">{item.description}</h3>
                  <p className="text-xs text-gray-400">
                    {item.item_code}
                    {item.item_group ? ` · ${item.item_group}` : ''}
                    {item.item_type ? ` · ${item.item_type}` : ''}
                  </p>
                </div>
                <div className="flex gap-6 text-right">
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide">Cost</p>
                    <p className="font-semibold text-gray-900">{formatAmount(item.cost)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide">Unit Price</p>
                    <p className="font-semibold text-gray-900">{formatAmount(item.unit_price)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide">Qty Sold</p>
                    <p className="font-semibold text-gray-900">{item.qty_sold.toLocaleString()}</p>
                  </div>
                </div>
              </div>

              {item.branches.length > 0 ? (
                <BranchStockTable branches={item.branches} />
              ) : (
                <p className="px-5 py-3 text-xs text-gray-400">No branch stock recorded</p>
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
