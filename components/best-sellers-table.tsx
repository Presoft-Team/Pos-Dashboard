'use client'

import { ItemBucketRow } from '@/types'
import { formatAmount, formatQty } from '@/lib/currency'

interface Props {
  data: ItemBucketRow[]
  loading?: boolean
  title?: string
}

// Top 5 Best Sellers table (PLAN.md Section 4). Figures come from the stock
// documents linked to each AR document by DocNo, so they cover only AR
// documents that have a stock twin and will total less than the KPI's
// Total Revenue. Bucket is an item/group/type name
// depending on the page's active GroupByMode; the backend already limits to
// 5 rows and sorts by revenue, so no client-side sort/pagination here.
export default function BestSellersTable({ data, loading, title = 'Best Sellers' }: Props) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        </div>
      ) : data.length === 0 ? (
        <div className="flex items-center justify-center h-40 text-gray-400 text-sm">No data found</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide w-8">#</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Item</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Currency</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide text-right">Qty</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide text-right">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.map((row, i) => (
                <tr key={i} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-400 font-medium">{i + 1}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{row.bucket_name || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{row.currency}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{formatQty(row.qty)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatAmount(row.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
