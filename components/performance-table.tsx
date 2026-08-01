'use client'

import { PerformanceRow } from '@/types'
import { formatAmount } from '@/lib/currency'

interface Props {
  title: string
  rows: PerformanceRow[]
  loading?: boolean
  focusedId?: string | null   // this dimension's own focused row, if any
  onRowClick: (id: string) => void
}

// One of Performance's 5 breakdown tables (Branch/Item/Sales Agent/Debtor/
// Creditor) — see PLAN.md Section 6. Clicking a row reports it up to the
// page, which owns the single global focus and re-fetches the other 4.
// Rows with a null id (Item table grouped by Group/Type) aren't clickable —
// a group/type aggregate isn't one focusable entity.
export default function PerformanceTable({ title, rows, loading, focusedId, onRowClick }: Props) {
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
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide text-right">Credit Qty</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide text-right">Cash Qty</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide text-right">Credit Revenue</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide text-right">Cash Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((row, i) => (
                <tr
                  key={i}
                  onClick={() => row.id && onRowClick(row.id)}
                  className={`transition-colors ${row.id ? 'hover:bg-gray-50 cursor-pointer' : ''} ${focusedId && focusedId === row.id ? 'bg-brand/10' : ''}`}
                >
                  <td className="px-4 py-3 text-gray-400 font-medium">{i + 1}</td>
                  <td className="px-4 py-3 font-semibold text-gray-900">{row.name}</td>
                  <td className="px-4 py-3 text-gray-600">{row.currency}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{row.credit_qty.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{row.cash_qty.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatAmount(row.credit_revenue)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatAmount(row.cash_revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
