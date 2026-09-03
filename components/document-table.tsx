'use client'

import { useEffect, useMemo, useState } from 'react'
import { DocumentRow } from '@/types'
import { formatMoney } from '@/lib/currency'
import Combobox from '@/components/combobox'
import SortSelect, { SortOption } from '@/components/sort-select'

interface Props {
  title: string
  rows: DocumentRow[]
  loading?: boolean
  // "Debtor" on the sales side, "Creditor" on the purchase side. Ignored
  // when `middle` is 'type'.
  partyLabel: string
  // What the middle column shows. Inside one entity's own detail overlay
  // every row names that same entity, so a party column there is a wall of
  // one repeated value — those callers pass 'type' to get the document type
  // (Invoice / Cash Sale / Credit Note …) in its place.
  middle?: 'party' | 'type'
  // Opens the document's detail overlay, where doc no, sales agent, and the
  // item lines all live. The list itself deliberately stays at three
  // columns.
  onRowClick?: (row: DocumentRow) => void
}

const INITIAL_VISIBLE = 10
const SHOW_MORE_STEP = 10
const DEFAULT_SORT = 'date_desc'

// `middleLabel` names whichever field the middle column is showing, so the
// sort menu reads in the same terms as the table it reorders.
function documentSortOptions(middleLabel: string): SortOption[] {
  return [
    { value: 'date_desc', label: 'Date (Newest → Oldest)' },
    { value: 'date_asc', label: 'Date (Oldest → Newest)' },
    { value: 'amount_desc', label: 'Amount (High → Low)' },
    { value: 'amount_asc', label: 'Amount (Low → High)' },
    { value: 'party_asc', label: `${middleLabel} (A → Z)` },
    { value: 'party_desc', label: `${middleLabel} (Z → A)` },
    { value: 'doc_no_asc', label: 'Doc No (A → Z)' },
    { value: 'doc_no_desc', label: 'Doc No (Z → A)' },
  ]
}

// DocDate is a datetime; only the date part means anything to the reader.
// Sliced rather than parsed via Date — the value is already local wall-clock
// time from SQL Server, and new Date() would shift it by the browser's zone.
function formatDate(value: string): string {
  return value ? value.slice(0, 10) : ''
}

export default function DocumentTable({ title, rows, loading, partyLabel, middle = 'party', onRowClick }: Props) {
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState(DEFAULT_SORT)

  // Reset expansion when rows change (new filters/data), and whenever
  // the user narrows or reorders.
  useEffect(() => { setVisibleCount(INITIAL_VISIBLE) }, [rows, search, sort])

  const showType = middle === 'type'
  const middleLabel = showType ? 'Type' : partyLabel
  // Search and sort both follow whatever the middle column is showing —
  // offering a party filter next to a Type column would be a dead control.
  const middleValue = useMemo(
    () => (row: DocumentRow) => (showType ? row.doc_type : row.party_name),
    [showType]
  )

  const searchOptions = useMemo(() => {
    const seen = new Set<string>()
    const options: { id: string; name: string }[] = []
    for (const row of rows) {
      const value = middleValue(row)
      if (!value || seen.has(value)) continue
      seen.add(value)
      options.push({ id: value, name: value })
    }
    return options.sort((a, b) => a.name.localeCompare(b.name))
  }, [rows, middleValue])

  const sortOptions = useMemo(() => documentSortOptions(middleLabel), [middleLabel])

  const displayRows = useMemo(() => {
    const term = search.trim().toLowerCase()
    const filtered = term
      ? rows.filter(
          (r) =>
            middleValue(r).toLowerCase().includes(term) ||
            r.doc_no.toLowerCase().includes(term) ||
            r.party_code.toLowerCase().includes(term) ||
            (r.agent && r.agent.toLowerCase().includes(term))
        )
      : rows

    const sorted = [...filtered]
    switch (sort) {
      case 'date_asc':
        sorted.sort((a, b) => a.doc_date.localeCompare(b.doc_date) || a.doc_no.localeCompare(b.doc_no))
        break
      case 'amount_desc':
        sorted.sort((a, b) => b.amount - a.amount)
        break
      case 'amount_asc':
        sorted.sort((a, b) => a.amount - b.amount)
        break
      case 'party_asc':
        sorted.sort((a, b) => middleValue(a).localeCompare(middleValue(b)))
        break
      case 'party_desc':
        sorted.sort((a, b) => middleValue(b).localeCompare(middleValue(a)))
        break
      case 'doc_no_asc':
        sorted.sort((a, b) => a.doc_no.localeCompare(b.doc_no))
        break
      case 'doc_no_desc':
        sorted.sort((a, b) => b.doc_no.localeCompare(a.doc_no))
        break
      case 'date_desc':
      default:
        sorted.sort((a, b) => b.doc_date.localeCompare(a.doc_date) || b.doc_no.localeCompare(a.doc_no))
    }
    return sorted
  }, [rows, search, sort, middleValue])

  const visibleRows = displayRows.slice(0, visibleCount)
  const hasMore = visibleCount < displayRows.length
  const isExpanded = visibleCount > INITIAL_VISIBLE

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4 border-b border-gray-100">
        <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
        {!loading && rows.length > 0 && (
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 sm:w-auto">
            <Combobox
              value={search}
              options={searchOptions}
              placeholder="All"
              onChange={setSearch}
              ariaLabel={`Search ${title}`}
              fullWidth
            />
            <SortSelect value={sort} options={sortOptions} onChange={setSort} />
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        </div>
      ) : displayRows.length === 0 ? (
        <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
          {rows.length === 0 ? 'No documents found' : 'No documents match that search'}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Date</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">{middleLabel}</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {visibleRows.map((row) => (
                <tr
                  key={`${row.doc_type}-${row.doc_no}`}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={onRowClick ? 'cursor-pointer hover:bg-gray-50 transition-colors' : ''}
                >
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDate(row.doc_date)}</td>
                  <td className={`px-4 py-3 ${onRowClick ? 'text-gray-900 font-medium' : 'text-gray-600'}`}>{middleValue(row)}</td>
                  <td className={`px-4 py-3 text-right font-semibold whitespace-nowrap ${row.amount < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                    {formatMoney(row.amount, row.currency)}
                  </td>
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
              Show 10 more
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
