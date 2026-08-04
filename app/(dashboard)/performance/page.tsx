'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FilterOptions, Filters, GroupByMode, PerformanceRow } from '@/types'
import { DEFAULT_FILTERS, DEFAULT_OPTIONS, toParams } from '@/lib/filters'
import { pivotRevenueByCurrency } from '@/lib/currency'
import { entityRevenueColumns } from '@/lib/export'
import FilterBar from '@/components/filter-bar'
import CurrencyFilter from '@/components/currency-filter'
import BarChartWidget from '@/components/bar-chart'
import PerformanceTable from '@/components/performance-table'
import ExportModal, { ExportChartSpec, ExportTableSpec } from '@/components/export-modal'
import { Download } from 'lucide-react'

const ENTITY_FIELDS = ['branch', 'item', 'sales_agent', 'debtor', 'creditor'] as const
type EntityField = (typeof ENTITY_FIELDS)[number]

const GROUP_LABEL: Record<GroupByMode, string> = { item: 'Item', group: 'Group', type: 'Type' }

const CHART_LIMIT = 5

function chartData(rows: PerformanceRow[]) {
  return pivotRevenueByCurrency(
    rows.map((r) => ({ ...r, total_revenue: r.credit_revenue + r.cash_revenue, total_qty: r.credit_qty + r.cash_qty })),
    (r) => r.name,
    CHART_LIMIT
  )
}

export default function PerformancePage() {
  const supabase = createClient()

  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [options, setOptions] = useState<FilterOptions>(DEFAULT_OPTIONS)
  const [groupBy, setGroupBy] = useState<GroupByMode>('item')
  const [branchRows, setBranchRows] = useState<PerformanceRow[]>([])
  const [itemRows, setItemRows] = useState<PerformanceRow[]>([])
  const [agentRows, setAgentRows] = useState<PerformanceRow[]>([])
  const [debtorRows, setDebtorRows] = useState<PerformanceRow[]>([])
  const [creditorRows, setCreditorRows] = useState<PerformanceRow[]>([])
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
    const { data } = await supabase.rpc('get_filter_options_v2')
    if (data?.[0]) setOptions(data[0] as FilterOptions)
  }

  async function fetchData() {
    setLoading(true)
    // All 5 functions now accept every entity filter, including their own
    // dimension — filtering by "Ah Chong" collapses the Sales Agent table
    // to just his row too, not only the other 4.
    // p_limit defaults to 5 server-side (it feeds the "Top 5" chart) — the
    // breakdown tables need the full set, so pass null (= no LIMIT) here and
    // let chartData() above re-slice down to 5 for the chart only.
    const p = { ...toParams(filters), p_limit: null }

    const [branchRes, itemRes, agentRes, debtorRes, creditorRes] = await Promise.all([
      supabase.rpc('get_performance_branch_v2', p),
      supabase.rpc('get_performance_item_v2', { ...p, p_group_by: groupBy }),
      supabase.rpc('get_performance_sales_agent_v2', p),
      supabase.rpc('get_performance_debtor_v2', p),
      supabase.rpc('get_performance_creditor_v2', p),
    ])

    for (const [label, res] of [['branch', branchRes], ['item', itemRes], ['sales_agent', agentRes], ['debtor', debtorRes], ['creditor', creditorRes]] as const) {
      if (res.error) console.error(`get_performance_${label}_v2 error:`, res.error.message)
    }

    setBranchRows((branchRes.data as PerformanceRow[]) ?? [])
    setItemRows((itemRes.data as PerformanceRow[]) ?? [])
    setAgentRows((agentRes.data as PerformanceRow[]) ?? [])
    setDebtorRows((debtorRes.data as PerformanceRow[]) ?? [])
    setCreditorRows((creditorRes.data as PerformanceRow[]) ?? [])
    setLoading(false)
  }

  const itemLabel = GROUP_LABEL[groupBy]
  const sections: { field: EntityField; title: string; rows: PerformanceRow[] }[] = [
    { field: 'item', title: `${itemLabel} Breakdown`, rows: itemRows },
    { field: 'branch', title: 'Branch Breakdown', rows: branchRows },
    { field: 'sales_agent', title: 'Sales Agent Breakdown', rows: agentRows },
    { field: 'debtor', title: 'Debtor Breakdown', rows: debtorRows },
    { field: 'creditor', title: 'Creditor Breakdown', rows: creditorRows },
  ]

  const exportCharts: ExportChartSpec[] = sections.map((s) => ({
    id: `${s.field}-chart`, label: `Top 5 ${s.title}`, render: () => <BarChartWidget data={chartData(s.rows)} />,
  }))
  const exportTables: ExportTableSpec[] = sections.map((s) => ({
    id: `${s.field}-table`, label: s.title,
    columns: entityRevenueColumns('name', s.field === 'item' ? itemLabel : s.title.split(' Breakdown')[0]),
    rows: s.rows as unknown as Record<string, unknown>[],
  }))

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Performance</h1>
          <p className="text-sm text-gray-500">Branch, Item, Sales Agent, Debtor, and Creditor performance</p>
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

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {sections.map((s) => (
          <div key={s.field} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h3 className="font-semibold text-gray-900 text-sm mb-4">Top 5 {s.title}</h3>
            {loading ? (
              <div className="flex items-center justify-center h-[260px]">
                <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <BarChartWidget data={chartData(s.rows)} />
            )}
          </div>
        ))}
      </div>

      {/* Tables */}
      <div className="space-y-4">
        {sections.map((s) => (
          <PerformanceTable key={s.field} title={s.title} rows={s.rows} loading={loading} />
        ))}
      </div>

      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        pageTitle="Performance"
        filters={filters}
        options={options}
        charts={exportCharts}
        tables={exportTables}
      />
    </div>
  )
}
