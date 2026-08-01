'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FilterOptions, Filters, MonthlyBreakdownRow, MonthlyTrendRow } from '@/types'
import { DEFAULT_FILTERS, DEFAULT_OPTIONS, toParams } from '@/lib/filters'
import { formatAmount, pivotMonthlyTrend } from '@/lib/currency'
import { ExportColumn } from '@/lib/export'
import FilterBar from '@/components/filter-bar'
import MonthlyTrendChart from '@/components/monthly-trend-chart'
import ExportModal, { ExportChartSpec, ExportTableSpec } from '@/components/export-modal'
import { Download } from 'lucide-react'

const MONTH_NAMES = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const MONTHLY_COLUMNS: ExportColumn[] = [
  { key: 'month_label', label: 'Month' },
  { key: 'currency', label: 'Currency' },
  { key: 'credit_revenue', label: 'Credit Revenue', align: 'right', formatForPdf: (r) => formatAmount(Number(r.credit_revenue ?? 0)) },
  { key: 'cash_revenue', label: 'Cash Revenue', align: 'right', formatForPdf: (r) => formatAmount(Number(r.cash_revenue ?? 0)) },
  { key: 'credit_qty', label: 'Credit Qty', align: 'right', formatForPdf: (r) => Number(r.credit_qty ?? 0).toLocaleString('en-MY') },
  { key: 'cash_qty', label: 'Cash Qty', align: 'right', formatForPdf: (r) => Number(r.cash_qty ?? 0).toLocaleString('en-MY') },
]

export default function MonthlyPage() {
  const supabase = createClient()

  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [options, setOptions] = useState<FilterOptions>(DEFAULT_OPTIONS)
  const [trend, setTrend] = useState<MonthlyTrendRow[]>([])
  const [breakdown, setBreakdown] = useState<MonthlyBreakdownRow[]>([])
  const [loading, setLoading] = useState(true)
  const [exportOpen, setExportOpen] = useState(false)

  useEffect(() => { fetchOptions() }, [])
  useEffect(() => { fetchData() }, [filters])

  async function fetchOptions() {
    const { data } = await supabase.rpc('get_filter_options_v2')
    if (data?.[0]) setOptions(data[0] as FilterOptions)
  }

  async function fetchData() {
    setLoading(true)
    const params = toParams(filters)

    const [trendRes, breakdownRes] = await Promise.all([
      supabase.rpc('get_monthly_trend_v2', params),
      supabase.rpc('get_monthly_breakdown_v2', { ...params, p_limit_months: 6 }),
    ])

    if (trendRes.error) console.error('get_monthly_trend_v2 error:', trendRes.error.message)
    if (breakdownRes.error) console.error('get_monthly_breakdown_v2 error:', breakdownRes.error.message)

    setTrend((trendRes.data as MonthlyTrendRow[]) ?? [])
    setBreakdown((breakdownRes.data as MonthlyBreakdownRow[]) ?? [])
    setLoading(false)
  }

  // 4 lines (Total, Cash+Paid, Credit not-due, Credit overdue), chronological.
  const chartData = pivotMonthlyTrend(trend, MONTH_NAMES)

  const exportCharts: ExportChartSpec[] = [
    { id: 'trend-chart', label: 'Monthly Revenue Trend', render: () => <MonthlyTrendChart data={chartData} /> },
  ]

  const exportTables: ExportTableSpec[] = [
    {
      id: 'monthly-breakdown',
      label: 'Monthly Breakdown',
      columns: MONTHLY_COLUMNS,
      rows: breakdown.map((m) => ({ ...m, month_label: `${MONTH_NAMES[m.month]} ${m.year}` })) as unknown as Record<string, unknown>[],
    },
  ]

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Monthly Sales</h1>
          <p className="text-sm text-gray-500">Revenue trend and monthly breakdown</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <FilterBar filters={filters} options={options} onChange={setFilters} />
          <button
            onClick={() => setExportOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
          >
            <Download size={15} />
            Export
          </button>
        </div>
      </div>

      {/* Monthly trend chart */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-semibold text-gray-900 text-sm mb-4">Monthly Revenue Trend</h3>
        {loading ? (
          <div className="flex items-center justify-center h-[320px]">
            <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <MonthlyTrendChart data={chartData} />
        )}
      </div>

      {/* Monthly breakdown table — latest 6 months */}
      {!loading && breakdown.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900 text-sm">Monthly Breakdown</h3>
            <p className="text-xs text-gray-400">Latest 6 months</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Month</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Currency</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide text-right">Credit Revenue</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide text-right">Cash Revenue</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide text-right">Credit Qty</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide text-right">Cash Qty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {breakdown.map((m, i) => {
                  const next = breakdown[i + 1]
                  const isLastOfMonth = !next || next.year !== m.year || next.month !== m.month
                  return (
                    <tr key={i} className={`hover:bg-gray-50 ${isLastOfMonth ? 'border-b-2 border-gray-300' : ''}`}>
                      <td className="px-4 py-3 font-medium text-gray-900">{MONTH_NAMES[m.month]} {m.year}</td>
                      <td className="px-4 py-3 text-gray-600">{m.currency}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatAmount(m.credit_revenue)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatAmount(m.cash_revenue)}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{m.credit_qty.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{m.cash_qty.toLocaleString()}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        pageTitle="Monthly Sales"
        filters={filters}
        options={options}
        charts={exportCharts}
        tables={exportTables}
      />
    </div>
  )
}
