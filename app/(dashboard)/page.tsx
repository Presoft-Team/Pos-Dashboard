'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/db/client'
import { FilterOptions, Filters, GroupByMode, ItemBestSellerRow, ItemRevenueRow, KpiSummary } from '@/types'
import { DEFAULT_FILTERS, DEFAULT_OPTIONS, toParams } from '@/lib/filters'
import { pivotItemRevenue } from '@/lib/currency'
import KpiCards from '@/components/kpi-cards'
import BestSellersTable from '@/components/best-sellers-table'
import FilterBar from '@/components/filter-bar'
import CurrencyFilter from '@/components/currency-filter'
import StackedBarChartWidget from '@/components/stacked-bar-chart'
import ExportModal, { ExportChartSpec, ExportTableSpec } from '@/components/export-modal'
import { entityRevenueColumns } from '@/lib/export'
import { Download } from 'lucide-react'

const GROUP_LABEL: Record<GroupByMode, string> = { item: 'Item', group: 'Group', type: 'Type' }

export default function DashboardPage() {
  const supabase = createClient()

  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [options, setOptions] = useState<FilterOptions>(DEFAULT_OPTIONS)
  const [groupBy, setGroupBy] = useState<GroupByMode>('item')
  const [kpi, setKpi] = useState<KpiSummary[]>([])
  const [itemRevenue, setItemRevenue] = useState<ItemRevenueRow[]>([])
  const [bestSellers, setBestSellers] = useState<ItemBestSellerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [exportOpen, setExportOpen] = useState(false)

  useEffect(() => { fetchOptions() }, [])
  useEffect(() => { fetchData() }, [filters, groupBy])

  // FilterBar's Item/Group/Type slot swaps meaning with the toggle — clear
  // whichever of the 3 fields was set so switching modes doesn't leave a
  // stale, now-invisible filter silently narrowing results.
  function handleGroupByChange(next: GroupByMode) {
    setGroupBy(next)
    setFilters((f) => ({ ...f, item: '', item_group: '', item_type: '' }))
  }

  async function fetchOptions() {
    const { data, error } = await supabase.rpc('get_filter_options_v2')
    if (error) console.error('get_filter_options_v2 error:', error.message)
    if (data?.[0]) setOptions(data[0] as FilterOptions)
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
    setItemRevenue((itemRevenueRes.data as ItemRevenueRow[]) ?? [])
    setBestSellers((bestSellersRes.data as ItemBestSellerRow[]) ?? [])
    setLoading(false)
  }

  // Top 5 + "Other" — see PLAN.md Section 4.
  const chartData = pivotItemRevenue(itemRevenue, (r) => r.bucket_name, 5)
  const chartTitle = `Revenue by ${GROUP_LABEL[groupBy]}`

  const exportCharts: ExportChartSpec[] = [
    { id: 'kpi', label: 'KPI Summary', render: () => <KpiCards data={kpi} /> },
    { id: 'revenue-chart', label: chartTitle, render: () => <StackedBarChartWidget data={chartData} /> },
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
          <p className="text-sm text-gray-500">Overview of all branches and items</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <FilterBar
            filters={filters}
            options={options}
            onChange={setFilters}
            groupBy={groupBy}
            onGroupByChange={handleGroupByChange}
            trailing={[
              <CurrencyFilter
                key="currency"
                value={filters.currency}
                options={options.currencies}
                onChange={(v) => setFilters({ ...filters, currency: v })}
              />,
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
          <StackedBarChartWidget data={chartData} />
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
