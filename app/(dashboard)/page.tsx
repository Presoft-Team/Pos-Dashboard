'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/db/client'
import { MonthlyRow } from '@/types'
import { useSharedFilters } from '@/lib/filter-context'
import { formatMoney, formatMoneyLines, pivotMonthlyTrend } from '@/lib/currency'
import { ExportColumn } from '@/lib/export'
import DatePresetFilter from '@/components/date-preset-filter'
import MonthlyTrendChart from '@/components/monthly-trend-chart'
import MonthlyBreakdownTable from '@/components/monthly-breakdown-table'
import KpiCard from '@/components/kpi-card'
import ExportModal, { ExportChartSpec, ExportTableSpec } from '@/components/export-modal'
import { Download, Wallet, Truck } from 'lucide-react'

const MONTH_NAMES = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// One column set per section, mirroring the two tables on the page.
//
// No Qty column: monthly figures come from AR/AP documents, which carry
// amounts only — quantity exists on stock-document lines alone.
//
// The currency is printed with the amount rather than in a column of its own
// — the PDF mirrors what the on-screen table shows. Excel still gets the raw
// numeric value, so the figure stays sortable there.
function monthlyColumns(key: 'revenue' | 'purchase', label: string): ExportColumn[] {
  return [
    { key: 'month_label', label: 'Month' },
    {
      key, label, align: 'right',
      formatForPdf: (r) => formatMoney(Number(r[key] ?? 0), String(r.currency ?? '')),
    },
  ]
}

const SALES_COLUMNS = monthlyColumns('revenue', 'Sales')
const PURCHASE_COLUMNS = monthlyColumns('purchase', 'Purchase')

// Period totals for the KPI tiles, summed per currency from the same rows
// the tables below show — so a tile can never disagree with the breakdown
// under it. Sorted largest-first, matching how the other pages' tiles read.
function totalsFor(rows: MonthlyRow[], metric: 'revenue' | 'purchase') {
  const byCurrency = new Map<string, number>()
  for (const row of rows) {
    byCurrency.set(row.currency, (byCurrency.get(row.currency) ?? 0) + row[metric])
  }
  return [...byCurrency.entries()]
    .map(([currency, amount]) => ({ currency, amount }))
    .sort((a, b) => b.amount - a.amount)
}

export default function MonthlyPage() {
  const supabase = createClient()

  // `options` is still needed — DatePresetFilter uses date_min/date_max to
  // bound the Custom pickers. The entity filters and groupBy are not.
  const { filters, setFilters, options } = useSharedFilters()
  const [trend, setTrend] = useState<MonthlyRow[]>([])
  const [breakdown, setBreakdown] = useState<MonthlyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [exportOpen, setExportOpen] = useState(false)

  useEffect(() => { fetchData() }, [filters])
  // Search, sort and expansion now live inside each MonthlyBreakdownTable,
  // so the two sections filter independently of one another.
  //
  // No landing reconciliation any more: every page now offers the same
  // preset set, so a range set elsewhere is always one this page can
  // represent. (This used to reset 30 Days / 4 Months, which existed on
  // Sales/Purchase but had no button here.)


  async function fetchData() {
    setLoading(true)
    // Date range only, not toParams(): this page shows no entity filters, so
    // an Item/Agent/Debtor left set on Sales or Purchase would otherwise
    // follow the user here and silently narrow the trend with no visible
    // control to clear it. Same reasoning as p_location in lib/filters.ts.
    const params = { p_date_from: filters.date_from || null, p_date_to: filters.date_to || null }

    const [trendRes, breakdownRes] = await Promise.all([
      supabase.rpc('get_monthly_trend_v2', params),
      supabase.rpc('get_monthly_breakdown_v2', params),
    ])

    if (trendRes.error) console.error('get_monthly_trend_v2 error:', trendRes.error.message)
    if (breakdownRes.error) console.error('get_monthly_breakdown_v2 error:', breakdownRes.error.message)

    setTrend((trendRes.data as MonthlyRow[]) ?? [])
    setBreakdown((breakdownRes.data as MonthlyRow[]) ?? [])
    setLoading(false)
  }

  // One Total line, chronological — zero-sales months in the filtered range
  // still get a row so they don't vanish from the x-axis.
  const chartData = pivotMonthlyTrend(trend, MONTH_NAMES, filters.date_from, filters.date_to)

  // The export mirrors the page: Sales and Purchase as separate sections.
  const exportCharts: ExportChartSpec[] = [
    { id: 'sales-chart', label: 'Monthly Sales Trend', render: () => <MonthlyTrendChart data={chartData} series="sales" /> },
    { id: 'purchase-chart', label: 'Monthly Purchase Trend', render: () => <MonthlyTrendChart data={chartData} series="purchase" /> },
  ]

  const exportRows = breakdown.map((m) => ({
    ...m,
    month_label: `${MONTH_NAMES[m.month]} ${m.year}`,
  })) as unknown as Record<string, unknown>[]

  const exportTables: ExportTableSpec[] = [
    { id: 'sales-breakdown', label: 'Sales Breakdown', columns: SALES_COLUMNS, rows: exportRows },
    { id: 'purchase-breakdown', label: 'Purchase Breakdown', columns: PURCHASE_COLUMNS, rows: exportRows },
  ]

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Monthly</h1>
          <p className="text-sm text-gray-500">Sales and purchase trend, with a month-by-month breakdown</p>
        </div>
        {/* Date range only. The entity filters (Item/Group/Type, Sales
            Agent, Debtor) and the currency picker don't belong on a
            company-wide monthly trend — and multi-currency is on hold, so
            there's nothing for a currency filter to switch between. */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
          <DatePresetFilter filters={filters} options={options} onChange={setFilters} />
          <button
            onClick={() => setExportOpen(true)}
            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg transition-colors whitespace-nowrap w-full sm:w-auto shrink-0"
          >
            <Download size={15} />
            Export
          </button>
        </div>
      </div>

      {/* Two tiles only — Sales beside Purchase. No credit-note tile here;
          that detail belongs on the Sales page, not a monthly overview. */}
      <div className="grid grid-cols-2 gap-4">
        <KpiCard
          label="Total Sales"
          value={formatMoneyLines(totalsFor(breakdown, 'revenue'))}
          icon={Wallet}
          color="bg-mint/10 text-mint"
        />
        <KpiCard
          label="Total Purchase"
          value={formatMoneyLines(totalsFor(breakdown, 'purchase'))}
          icon={Truck}
          color="bg-brand/10 text-brand"
        />
      </div>

      {/* --- Sales --- */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-semibold text-gray-900 text-sm mb-4">Monthly Sales Trend</h3>
        {loading ? (
          <div className="flex items-center justify-center h-[320px]">
            <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <MonthlyTrendChart data={chartData} series="sales" />
        )}
      </div>

      {!loading && (
        <MonthlyBreakdownTable title="Sales Breakdown" rows={breakdown} metric="revenue" label="Sales" />
      )}

      {/* --- Purchase --- */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-semibold text-gray-900 text-sm mb-4">Monthly Purchase Trend</h3>
        {loading ? (
          <div className="flex items-center justify-center h-[320px]">
            <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <MonthlyTrendChart data={chartData} series="purchase" />
        )}
      </div>

      {!loading && (
        <MonthlyBreakdownTable title="Purchase Breakdown" rows={breakdown} metric="purchase" label="Purchase" />
      )}

      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        pageTitle="Monthly"
        filters={filters}
        options={options}
        charts={exportCharts}
        tables={exportTables}
      />
    </div>
  )
}
