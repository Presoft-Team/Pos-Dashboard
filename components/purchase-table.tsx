'use client'

import { useEffect, useState } from 'react'
import { PurchaseItemRow, PurchaseRow } from '@/types'
import { formatAmount, formatQty } from '@/lib/currency'

interface Props {
  title: string
  rows: (PurchaseRow | PurchaseItemRow)[]
  loading?: boolean
  // Only the Item breakdown has quantities — the Creditor one reads AP
  // document headers, which carry no Qty.
  showQty?: boolean
}

function qtyOf(row: PurchaseRow | PurchaseItemRow): number {
  return 'qty' in row ? row.qty : 0
}

const INITIAL_VISIBLE = 5
const SHOW_MORE_STEP = 5

// Purchase-side twin of PerformanceTable — same layout, but a Purchase
// column instead of Revenue (this is purchase spend, not revenue — a
// duplicated component rather than a relabeled shared one,
// since PerformanceTable's column labels aren't parameterized and Sales/
// Purchase are different enough domains that forcing one generic table to
// serve both isn't worth the indirection for 3 dimensions each).
export default function PurchaseTable({ title, rows, loading, showQty = false }: Props) {
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE)

  useEffect(() => { setVisibleCount(INITIAL_VISIBLE) }, [rows])

  const visibleRows = rows.slice(0, visibleCount)
  const hasMore = visibleCount < rows.length
  const isExpanded = visibleCount > INITIAL_VISIBLE

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <div className="flex items-center justify-center h-40 text-gray-400 text-sm">No data found</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide w-8">#</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Name</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Currency</th>
                {showQty && <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide text-right">Qty</th>}
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide text-right">Purchase</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {visibleRows.map((row, i) => (
                <tr key={i}>
                  <td className="px-4 py-3 text-gray-400 font-medium">{i + 1}</td>
                  <td className="px-4 py-3 font-semibold text-gray-900">{row.name}</td>
                  <td className="px-4 py-3 text-gray-600">{row.currency}</td>
                  {showQty && <td className="px-4 py-3 text-right text-gray-600">{formatQty(qtyOf(row))}</td>}
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatAmount(row.purchase)}</td>
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
              onClick={() => setVisibleCount((c) => Math.min(c + SHOW_MORE_STEP, rows.length))}
              className="text-sm font-medium text-brand hover:text-brand/80 transition-colors"
            >
              Show 5 more
            </button>
          )}
          {hasMore && (
            <button
              onClick={() => setVisibleCount(rows.length)}
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
