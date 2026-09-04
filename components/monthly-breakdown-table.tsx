'use client'

import { useEffect, useMemo, useState } from 'react'
import { MonthlyRow } from '@/types'
import { formatMoney } from '@/lib/currency'
import Combobox from '@/components/combobox'
import SortSelect, { SortOption } from '@/components/sort-select'

const MONTH_NAMES = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const INITIAL_VISIBLE = 6
const SHOW_MORE_STEP = 6

// Which figure this table reports. The Monthly page renders one instance per
// metric, so each keeps its own search, sort and expansion state.
export type MonthlyMetric = 'revenue' | 'purchase'

export function monthLabel(m: MonthlyRow): string {
  return `${MONTH_NAMES[m.month]} ${m.year}`
}

// Months sort by their real (year, month), never by the "Aug 2026" label —
// alphabetising that would put April before January.
function sortOptionsFor(label: string): SortOption[] {
  return [
    { value: 'month_desc', label: 'Month desc' },
    { value: 'month_asc', label: 'Month' },
    { value: 'amount_desc', label: `${label} desc` },
    { value: 'amount_asc', label },
  ]
}

interface Props {
  title: string
  rows: MonthlyRow[]
  metric: MonthlyMetric
  // Column header and sort-menu wording — "Sales" or "Purchase".
  label: string
}

export default function MonthlyBreakdownTable({ title, rows, metric, label }: Props) {
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('month_desc')

  // Reset expansion when the data changes, and whenever the user narrows or
  // reorders — a "view 6 more" position means nothing against a different set.
  useEffect(() => { setVisibleCount(INITIAL_VISIBLE) }, [rows, search, sort])

  const sortOptions = useMemo(() => sortOptionsFor(label), [label])

  const searchOptions = useMemo(
    () => [...new Set(rows.map(monthLabel))].map((name) => ({ id: name, name })),
    [rows]
  )

  const displayRows = useMemo(() => {
    const term = search.trim().toLowerCase()
    const matched = term ? rows.filter((m) => monthLabel(m).toLowerCase().includes(term)) : rows

    const amount = (m: MonthlyRow) => (metric === 'revenue' ? m.revenue : m.purchase)
    const chronological = (a: MonthlyRow, b: MonthlyRow) => a.year - b.year || a.month - b.month

    const sorted = [...matched]
    switch (sort) {
      case 'month_asc': sorted.sort(chronological); break
      case 'amount_desc': sorted.sort((a, b) => amount(b) - amount(a)); break
      case 'amount_asc': sorted.sort((a, b) => amount(a) - amount(b)); break
      default: sorted.sort((a, b) => chronological(b, a))
    }
    return sorted
  }, [rows, search, sort, metric])

  const visibleRows = displayRows.slice(0, visibleCount)
  const hasMore = visibleCount < displayRows.length
  const isExpanded = visibleCount > INITIAL_VISIBLE

  // The month-divider border only means something when a month can have more
  // than one row (one per currency) — with a single currency every row is
  // trivially "last of its month," so the border would show on every row.
  const hasMultipleCurrencies = new Set(rows.map((m) => m.currency)).size > 1

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4 border-b border-gray-100">
        <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="flex-1 min-w-0 sm:w-48">
            <Combobox
              value={search}
              options={searchOptions}
              placeholder="All months"
              onChange={setSearch}
              ariaLabel={`Search ${title}`}
              fullWidth
            />
          </div>
          <SortSelect value={sort} options={sortOptions} onChange={setSort} />
        </div>
      </div>

      {displayRows.length === 0 ? (
        <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
          {rows.length === 0 ? 'No data found' : 'No rows match that search'}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Month</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide text-right">{label}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {visibleRows.map((m, i) => {
                const next = visibleRows[i + 1]
                const isLastOfMonth = !next || next.year !== m.year || next.month !== m.month
                return (
                  <tr key={i} className={`hover:bg-gray-50 ${hasMultipleCurrencies && isLastOfMonth ? 'border-b-2 border-gray-300' : ''}`}>
                    <td className="px-4 py-3 font-medium text-gray-900">{monthLabel(m)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900 whitespace-nowrap">
                      {formatMoney(metric === 'revenue' ? m.revenue : m.purchase, m.currency)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {(hasMore || isExpanded) && (
        <div className="flex items-center justify-center gap-3 px-5 py-3 border-t border-gray-100">
          {hasMore && (
            <button
              onClick={() => setVisibleCount((c) => Math.min(c + SHOW_MORE_STEP, displayRows.length))}
              className="text-sm font-medium text-brand hover:text-brand/80 transition-colors"
            >
              View 6 more
            </button>
          )}
          {hasMore && (
            <button
              onClick={() => setVisibleCount(displayRows.length)}
              className="text-sm font-medium text-brand hover:text-brand/80 transition-colors"
            >
              View all
            </button>
          )}
          {isExpanded && (
            <button
              onClick={() => setVisibleCount(INITIAL_VISIBLE)}
              className="text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
            >
              View less
            </button>
          )}
        </div>
      )}
    </div>
  )
}
