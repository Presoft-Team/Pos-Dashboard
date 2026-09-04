'use client'

import { useEffect, useMemo, useState } from 'react'
import { PerformanceItemRow, PerformanceRow } from '@/types'
import { formatMoney, formatQty } from '@/lib/currency'
import { applyBreakdown, breakdownSortOptions, DEFAULT_BREAKDOWN_SORT } from '@/lib/breakdown'
import SortSelect from '@/components/sort-select'

interface Props {
  title: string
  rows: (PerformanceRow | PerformanceItemRow)[]
  loading?: boolean
  // Only the Item breakdown has quantities — Sales Agent and Debtor come
  // from AR document headers, which carry no Qty at all. Rather than print
  // a column of zeroes there, the caller says whether it has one.
  showQty?: boolean
  // Opens the row's detail overlay. Omitted on the Item breakdown, whose
  // bucket can be a group/type label rather than one drillable entity.
  onRowClick?: (row: PerformanceRow | PerformanceItemRow) => void
}

function qtyOf(row: PerformanceRow | PerformanceItemRow): number {
  return 'qty' in row ? row.qty : 0
}

const INITIAL_VISIBLE = 5
const SHOW_MORE_STEP = 5

// One of Performance's 3 breakdown tables (Item/Sales Agent/Debtor)
// — plain display, filtered only by the Global FilterBar above (click-to-
// focus was removed).
export default function PerformanceTable({ title, rows, loading, showQty = false, onRowClick }: Props) {
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE)
  const [sort, setSort] = useState(DEFAULT_BREAKDOWN_SORT)

  // Reset expansion when the underlying rows change (new filters/data), and
  // whenever the user reorders — a "show 5 more" position from the previous
  // view means nothing against a different set of rows.
  useEffect(() => { setVisibleCount(INITIAL_VISIBLE) }, [rows, sort])

  const displayRows = useMemo(
    () => applyBreakdown(rows, sort, (r) => r.revenue, qtyOf),
    [rows, sort]
  )

  const visibleRows = displayRows.slice(0, visibleCount)
  const hasMore = visibleCount < displayRows.length
  const isExpanded = visibleCount > INITIAL_VISIBLE

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-100">
        <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
        {/* Hidden while loading and when there's nothing to act on. */}
        {!loading && rows.length > 0 && (
          <SortSelect value={sort} options={breakdownSortOptions('Revenue', showQty)} onChange={setSort} />
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        </div>
      ) : displayRows.length === 0 ? (
        <div className="flex items-center justify-center h-40 text-gray-400 text-sm">No data found</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide w-8">#</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Name</th>
                {showQty && <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide text-right">Qty</th>}
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide text-right">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {visibleRows.map((row, i) => (
                <tr
                  key={i}
                  // Only rows that resolve to a real entity are clickable —
                  // a Group/Type bucket has no code and nothing to drill to.
                  onClick={onRowClick && row.code ? () => onRowClick(row) : undefined}
                  className={onRowClick && row.code ? 'cursor-pointer hover:bg-gray-50 transition-colors' : ''}
                >
                  <td className="px-4 py-3 text-gray-400 font-medium">{i + 1}</td>
                  <td className="px-4 py-3 font-semibold text-gray-900">{row.name}</td>
                  {showQty && <td className="px-4 py-3 text-right text-gray-600">{formatQty(qtyOf(row))}</td>}
                  <td className="px-4 py-3 text-right font-semibold text-gray-900 whitespace-nowrap">{formatMoney(row.revenue, row.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && (hasMore || isExpanded) && (
        <div className="flex items-center justify-center gap-3 px-5 py-3 border-t border-gray-100">
          {hasMore && (
            <button
              onClick={() => setVisibleCount((c) => Math.min(c + SHOW_MORE_STEP, displayRows.length))}
              className="text-sm font-medium text-brand hover:text-brand/80 transition-colors"
            >
              Show 5 more
            </button>
          )}
          {hasMore && (
            <button
              onClick={() => setVisibleCount(displayRows.length)}
              className="text-sm font-medium text-brand hover:text-brand/80 transition-colors"
            >
              Show all
            </button>
          )}
          {isExpanded && (
            <button
              onClick={() => setVisibleCount(INITIAL_VISIBLE)}
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
