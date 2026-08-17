'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/db/client'
import { GroupByMode, MonthlyBreakdownRow, MonthlyTrendRow } from '@/types'
import { toParams } from '@/lib/filters'
import { useSharedFilters } from '@/lib/filter-context'
import { formatAmount, pivotMonthlyTrend } from '@/lib/currency'
import { ExportColumn } from '@/lib/export'
import FilterBar from '@/components/filter-bar'
import CurrencyFilter from '@/components/currency-filter'
import DatePresetFilter, { MONTHLY_PRESETS, DASHBOARD_PRESETS, findMatchingPreset, defaultDateRange } from '@/components/date-preset-filter'
import MonthlyTrendChart from '@/components/monthly-trend-chart'
import ExportModal, { ExportChartSpec, ExportTableSpec } from '@/components/export-modal'
import { Download } from 'lucide-react'

const MONTH_NAMES = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const BREAKDOWN_INITIAL_VISIBLE = 6
const BREAKDOWN_SHOW_MORE_STEP = 6

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

  const { filters, setFilters, groupBy, setGroupBy, options } = useSharedFilters()
  const [trend, setTrend] = useState<MonthlyTrendRow[]>([])
  const [breakdown, setBreakdown] = useState<MonthlyBreakdownRow[]>([])
  const [loading, setLoading] = useState(true)
  const [exportOpen, setExportOpen] = useState(false)
  const [visibleCount, setVisibleCount] = useState(BREAKDOWN_INITIAL_VISIBLE)

  useEffect(() => { fetchData() }, [filters])
  // Reset expansion whenever new data comes in (new filters/date range).
  useEffect(() => { setVisibleCount(BREAKDOWN_INITIAL_VISIBLE) }, [breakdown])
  // Date range is shared with Sales Dashboard/Performance, but Monthly's
  // own preset buttons only go down to 6 Months — 30 Days / 4 Months exist
  // there but have no equivalent button here. Landing on Monthly with one
  // of those active falls back to Monthly's own 6-month default instead of
  // showing an unrepresentable range; a genuine custom range (or 6m/12m,
  // which both pages share) is left alone. Runs once per page visit, not on
  // every filters change, since this is a one-time landing reconciliation.
  useEffect(() => {
    const dashboardOnly = findMatchingPreset(filters, DASHBOARD_PRESETS) && !findMatchingPreset(filters, MONTHLY_PRESETS)
    if (dashboardOnly) setFilters((f) => ({ ...f, ...defaultDateRange(MONTHLY_PRESETS) }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // FilterBar's Item/Group/Type slot swaps meaning with the toggle — clear
  // whichever of the 3 fields was set so switching modes doesn't leave a
  // stale, now-invisible filter silently narrowing results. Monthly has no
  // p_group_by RPC param (no item-grouping here) — the toggle only decides
  // which filter field is shown.
  function handleGroupByChange(next: GroupByMode) {
    setGroupBy(next)
    setFilters((f) => ({ ...f, item: '', item_group: '', item_type: '' }))
  }

  async function fetchData() {
    setLoading(true)
    const params = toParams(filters)

    const [trendRes, breakdownRes] = await Promise.all([
      supabase.rpc('get_monthly_trend_v2', params),
      supabase.rpc('get_monthly_breakdown_v2', params),
    ])

    if (trendRes.error) console.error('get_monthly_trend_v2 error:', trendRes.error.message)
    if (breakdownRes.error) console.error('get_monthly_breakdown_v2 error:', breakdownRes.error.message)

    setTrend((trendRes.data as MonthlyTrendRow[]) ?? [])
    setBreakdown((breakdownRes.data as MonthlyBreakdownRow[]) ?? [])
    setLoading(false)
  }

  // 3 lines (Total, Cash, Credit), chronological — zero-sales months in the
  // filtered range still get a row so they don't vanish from the x-axis.
  const chartData = pivotMonthlyTrend(trend, MONTH_NAMES, filters.date_from, filters.date_to)

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
          <FilterBar
            filters={filters}
            options={options}
            onChange={setFilters}
            groupBy={groupBy}
            onGroupByChange={handleGroupByChange}
            datePicker={<DatePresetFilter filters={filters} options={options} onChange={setFilters} presets={MONTHLY_PRESETS} />}
            trailing={[
              // Omitted entirely (not just left to CurrencyFilter's own
              // null-render) when there's only 0/1 currency — a rendered-
              // but-empty slot still occupies a mobile grid cell, leaving a
              // real gap instead of letting Export slide into it.
              ...(options.currencies.length > 1
                ? [
                    <CurrencyFilter
                      key="currency"
                      value={filters.currency}
                      options={options.currencies}
                      onChange={(v) => setFilters({ ...filters, currency: v })}
                    />,
                  ]
                : []),
              <button
                key="export"
                onClick={() => setExportOpen(true)}
                className="flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg transition-colors whitespace-nowrap w-full sm:w-auto"
              >
                <Download size={15} />
                Export
              </button>,
            ]}
          />
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

      {/* Monthly breakdown table */}
      {!loading && breakdown.length > 0 && (() => {
        const visibleRows = breakdown.slice(0, visibleCount)
        const hasMore = visibleCount < breakdown.length
        const isExpanded = visibleCount > BREAKDOWN_INITIAL_VISIBLE
        // The month-divider border only means something when a month can
        // have more than one row (one per currency) — with a single
        // currency every row is trivially "last of its month," so the
        // border would show on every row for no reason.
        const hasMultipleCurrencies = new Set(breakdown.map((m) => m.currency)).size > 1
        return (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900 text-sm">Monthly Breakdown</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left">
                    <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Month</th>
                    <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Currency</th>
                    <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide text-right">Credit Revenue</th>
                    <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide text-right">Cash Revenue</th>
                    <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {visibleRows.map((m, i) => {
                    const next = visibleRows[i + 1]
                    const isLastOfMonth = !next || next.year !== m.year || next.month !== m.month
                    return (
                      <tr key={i} className={`hover:bg-gray-50 ${hasMultipleCurrencies && isLastOfMonth ? 'border-b-2 border-gray-300' : ''}`}>
                        <td className="px-4 py-3 font-medium text-gray-900">{MONTH_NAMES[m.month]} {m.year}</td>
                        <td className="px-4 py-3 text-gray-600">{m.currency}</td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatAmount(m.credit_revenue)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatAmount(m.cash_revenue)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatAmount(m.credit_revenue + m.cash_revenue)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {(hasMore || isExpanded) && (
              <div className="flex items-center justify-center gap-3 px-5 py-3 border-t border-gray-100">
                {hasMore && (
                  <button
                    onClick={() => setVisibleCount((c) => Math.min(c + BREAKDOWN_SHOW_MORE_STEP, breakdown.length))}
                    className="text-sm font-medium text-brand hover:text-brand/80 transition-colors"
                  >
                    View 6 more
                  </button>
                )}
                {hasMore && (
                  <button
                    onClick={() => setVisibleCount(breakdown.length)}
                    className="text-sm font-medium text-brand hover:text-brand/80 transition-colors"
                  >
                    View all
                  </button>
                )}
                {isExpanded && (
                  <button
                    onClick={() => setVisibleCount(BREAKDOWN_INITIAL_VISIBLE)}
                    className="text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    View less
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })()}

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
