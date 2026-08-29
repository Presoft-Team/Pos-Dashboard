'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/db/client'
import { GroupByMode, ItemBucketRow, KpiSummary } from '@/types'
import { toParams } from '@/lib/filters'
import { useSharedFilters } from '@/lib/filter-context'
import { pivotRevenueByCurrency } from '@/lib/currency'
import KpiCards from '@/components/kpi-cards'
import BestSellersTable from '@/components/best-sellers-table'
import FilterBar from '@/components/filter-bar'
import DatePresetFilter from '@/components/date-preset-filter'
import CurrencyFilter from '@/components/currency-filter'
import BarChartWidget from '@/components/bar-chart'
import ExportModal, { ExportChartSpec, ExportTableSpec } from '@/components/export-modal'
import { entityRevenueColumns } from '@/lib/export'
import { Download } from 'lucide-react'

const GROUP_LABEL: Record<GroupByMode, string> = { item: 'Item', group: 'Group', type: 'Type' }

export default function DashboardPage() {
  const supabase = createClient()

  const { filters, setFilters, groupBy, setGroupBy, options } = useSharedFilters()
  const [kpi, setKpi] = useState<KpiSummary[]>([])
  const [itemRevenue, setItemRevenue] = useState<ItemBucketRow[]>([])
  const [bestSellers, setBestSellers] = useState<ItemBucketRow[]>([])
  const [loading, setLoading] = useState(true)
  const [exportOpen, setExportOpen] = useState(false)

  useEffect(() => { fetchData() }, [filters, groupBy])

  // FilterBar's Item/Group/Type slot swaps meaning with the toggle — clear
  // whichever of the 3 fields was set so switching modes doesn't leave a
  // stale, now-invisible filter silently narrowing results.
  function handleGroupByChange(next: GroupByMode) {
    setGroupBy(next)
    setFilters((f) => ({ ...f, item: '', item_group: '', item_type: '' }))
  }

  async function fetchData() {
    setLoading(true)
    const params = toParams(filters)

    const [kpiRes, itemRevenueRes, bestSellersRes] = await Promise.all([
      supabase.rpc('get_kpi_summary_v2', params),
      supabase.rpc('get_item_revenue_v2', { ...params, p_group_by: groupBy }),
      supabase.rpc('get_item_best_sellers_v2', { ...params, p_group_by: groupBy, p_limit: 5 }),
    ])

    if (kpiRes.error) console.error('get_kpi_summary_v2 error:', kpiRes.error.message)
    if (itemRevenueRes.error) console.error('get_item_revenue_v2 error:', itemRevenueRes.error.message)
    if (bestSellersRes.error) console.error('get_item_best_sellers_v2 error:', bestSellersRes.error.message)

    setKpi((kpiRes.data as KpiSummary[]) ?? [])
    setItemRevenue((itemRevenueRes.data as ItemBucketRow[]) ?? [])
    setBestSellers((bestSellersRes.data as ItemBucketRow[]) ?? [])
    setLoading(false)
  }

  // Top 5 + "Other" — see PLAN.md Section 4.
  const chartData = pivotRevenueByCurrency(
    itemRevenue.map((r) => ({ ...r, total_revenue: r.revenue, total_qty: r.qty })),
    (r) => r.bucket_name,
    5,
    true
  )
  const chartTitle = `Revenue by ${GROUP_LABEL[groupBy]}`

  const exportCharts: ExportChartSpec[] = [
    { id: 'kpi', label: 'KPI Summary', render: () => <KpiCards data={kpi} /> },
    { id: 'revenue-chart', label: chartTitle, render: () => <BarChartWidget data={chartData} /> },
  ]

  const exportTables: ExportTableSpec[] = [
    {
      id: 'best-sellers',
      label: `Top 5 Best Sellers by ${GROUP_LABEL[groupBy]}`,
      columns: entityRevenueColumns('bucket_name', GROUP_LABEL[groupBy]),
      rows: bestSellers as unknown as Record<string, unknown>[],
    },
  ]

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Sales Dashboard</h1>
          <p className="text-sm text-gray-500">Overview of all items</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <FilterBar
            filters={filters}
            options={options}
            onChange={setFilters}
            groupBy={groupBy}
            onGroupByChange={handleGroupByChange}
            datePicker={<DatePresetFilter filters={filters} options={options} onChange={setFilters} />}
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

      {/* KPI Cards */}
      <KpiCards data={kpi} />

      {/* Chart */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-semibold text-gray-900 text-sm mb-4">{chartTitle}</h3>
        {loading ? (
          <div className="flex items-center justify-center h-[300px]">
            <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <BarChartWidget data={chartData} />
        )}
      </div>

      {/* Best sellers table */}
      <BestSellersTable data={bestSellers} loading={loading} title={`Top 5 Best Sellers by ${GROUP_LABEL[groupBy]}`} />

      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        pageTitle="Sales Dashboard"
        filters={filters}
        options={options}
        charts={exportCharts}
        tables={exportTables}
      />
    </div>
  )
}
