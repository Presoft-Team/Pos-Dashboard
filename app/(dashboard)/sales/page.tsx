'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/db/client'
import { DocumentRow, GroupByMode, KpiSummary, PerformanceItemRow, PerformanceRow } from '@/types'
import { toParams } from '@/lib/filters'
import { useSharedFilters } from '@/lib/filter-context'
import { pivotRevenueByCurrency } from '@/lib/currency'
import { documentColumns, entityRevenueColumns, entityRevenueOnlyColumns } from '@/lib/export'
import KpiCards from '@/components/kpi-cards'
import FilterBar from '@/components/filter-bar'
import CurrencyFilter from '@/components/currency-filter'
import DatePresetFilter from '@/components/date-preset-filter'
import BarChartWidget from '@/components/bar-chart'
import PerformanceTable from '@/components/performance-table'
import DocumentTable from '@/components/document-table'
import EntityDetail, { EntityTarget } from '@/components/entity-detail'
import DocumentDetail, { DocumentTarget } from '@/components/document-detail'
import ItemDetail from '@/components/item-detail'
import UnattributedToggle from '@/components/unattributed-toggle'
import { withoutUnattributed } from '@/lib/breakdown'
import ExportModal, { ExportChartSpec, ExportTableSpec } from '@/components/export-modal'
import { Download } from 'lucide-react'

const ENTITY_FIELDS = ['item', 'sales_agent', 'debtor'] as const
type EntityField = (typeof ENTITY_FIELDS)[number]

const GROUP_LABEL: Record<GroupByMode, string> = { item: 'Item', group: 'Group', type: 'Type' }

const CHART_LIMIT = 5

// How many documents the Recent Sales list asks for. The table itself shows
// 10 at a time with a Show more/Show all control, so this is the ceiling on
// what "all" can reach — not the number on screen.
const RECENT_LIMIT = 100

function chartData(rows: (PerformanceRow | PerformanceItemRow)[]) {
  return pivotRevenueByCurrency(
    rows.map((r) => ({ ...r, total_revenue: r.revenue, total_qty: 'qty' in r ? r.qty : 0 })),
    (r) => r.name,
    CHART_LIMIT
  )
}

export default function SalesPage() {
  const supabase = createClient()

  const { filters, setFilters, groupBy, setGroupBy, options } = useSharedFilters()
  const [kpi, setKpi] = useState<KpiSummary[]>([])
  const [itemRows, setItemRows] = useState<PerformanceItemRow[]>([])
  const [agentRows, setAgentRows] = useState<PerformanceRow[]>([])
  const [debtorRows, setDebtorRows] = useState<PerformanceRow[]>([])
  const [recentSales, setRecentSales] = useState<DocumentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [exportOpen, setExportOpen] = useState(false)
  const [detail, setDetail] = useState<EntityTarget | null>(null)
  const [docDetail, setDocDetail] = useState<DocumentTarget | null>(null)
  const [detailItem, setDetailItem] = useState<string | null>(null)
  // Shown by default — with the unattributed buckets in, the breakdown rows
  // still add up to the KPI totals above them.
  const [showUnattributed, setShowUnattributed] = useState(true)

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
    // All 3 functions now accept every entity filter, including their own
    // dimension — filtering by "Ah Chong" collapses the Sales Agent table
    // to just his row too, not only the other 2.
    // p_limit defaults to 5 server-side (it feeds the "Top 5" chart) — the
    // breakdown tables need the full set, so pass null (= no LIMIT) here and
    // let chartData() above re-slice down to 5 for the chart only.
    const p = { ...toParams(filters), p_limit: null }

    const [kpiRes, itemRes, agentRes, debtorRes, recentRes] = await Promise.all([
      // Unlike the breakdowns, the KPI tiles are a single total — they take
      // the plain filters, with no p_limit to widen.
      supabase.rpc('get_kpi_summary_v2', toParams(filters)),
      supabase.rpc('get_performance_item_v2', { ...p, p_group_by: groupBy }),
      supabase.rpc('get_performance_sales_agent_v2', p),
      supabase.rpc('get_performance_debtor_v2', p),
      // Capped rather than unlimited (p_limit: null above): this is a
      // "recent" list, and an all-time date range would otherwise pull every
      // document in the book across the wire to show the newest few.
      supabase.rpc('get_recent_sales_v2', { ...toParams(filters), p_limit: RECENT_LIMIT }),
    ])

    for (const [label, res] of [['item', itemRes], ['sales_agent', agentRes], ['debtor', debtorRes]] as const) {
      if (res.error) console.error(`get_performance_${label}_v2 error:`, res.error.message)
    }
    if (kpiRes.error) console.error('get_kpi_summary_v2 error:', kpiRes.error.message)
    if (recentRes.error) console.error('get_recent_sales_v2 error:', recentRes.error.message)

    setKpi((kpiRes.data as KpiSummary[]) ?? [])
    setItemRows((itemRes.data as PerformanceItemRow[]) ?? [])
    setAgentRows((agentRes.data as PerformanceRow[]) ?? [])
    setDebtorRows((debtorRes.data as PerformanceRow[]) ?? [])
    setRecentSales((recentRes.data as DocumentRow[]) ?? [])
    setLoading(false)
  }

  const itemLabel = GROUP_LABEL[groupBy]
  // Filtered here rather than per-consumer so the charts, the tables and the
  // PDF export all reflect the checkbox from one place.
  const sections: { field: EntityField; title: string; rows: (PerformanceRow | PerformanceItemRow)[] }[] = [
    { field: 'item', title: `${itemLabel} Breakdown`, rows: withoutUnattributed(itemRows, showUnattributed) },
    { field: 'sales_agent', title: 'Sales Agent Breakdown', rows: withoutUnattributed(agentRows, showUnattributed) },
    { field: 'debtor', title: 'Debtor Breakdown', rows: withoutUnattributed(debtorRows, showUnattributed) },
  ]
  // A dimension with no rows for the current filters has nothing to chart
  // or table, so it hides itself — while loading, keep every section
  // rendered (with its own spinner) since rows are just empty-so-far, not
  // empty-for-real yet.
  const visibleSections = loading ? sections : sections.filter((s) => s.rows.length > 0)

  const exportCharts: ExportChartSpec[] = [
    { id: 'kpi', label: 'KPI Summary', render: () => <KpiCards data={kpi} /> },
    ...visibleSections.map((s) => ({
      id: `${s.field}-chart`, label: `Top 5 ${s.title}`, render: () => <BarChartWidget data={chartData(s.rows)} showQty={s.field === 'item'} />,
    })),
  ]
  const exportTables: ExportTableSpec[] = visibleSections.map((s) => ({
    id: `${s.field}-table`, label: s.title,
    columns: s.field === 'item'
      ? entityRevenueColumns('name', itemLabel)
      : entityRevenueOnlyColumns('name', s.title.split(' Breakdown')[0]),
    rows: s.rows as unknown as Record<string, unknown>[],
  }))
  exportTables.push({
    id: 'sales-documents',
    label: 'Sales',
    columns: documentColumns('Debtor', true),
    rows: recentSales as unknown as Record<string, unknown>[],
  })

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Sales</h1>
          <p className="text-sm text-gray-500">Item, Sales Agent, and Debtor performance, plus sales documents</p>
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

      <UnattributedToggle
        checked={showUnattributed}
        onChange={setShowUnattributed}
        label="(No Item) / (No Agent)"
      />

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {visibleSections.map((s) => (
          <div key={s.field} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h3 className="font-semibold text-gray-900 text-sm mb-4">Top 5 {s.title}</h3>
            {loading ? (
              <div className="flex items-center justify-center h-[260px]">
                <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <BarChartWidget data={chartData(s.rows)} showQty={s.field === 'item'} />
            )}
          </div>
        ))}
      </div>

      {/* Tables */}
      <div className="space-y-4">
        {visibleSections.map((s) => (
          <PerformanceTable
            key={s.field}
            title={s.title}
            rows={s.rows}
            loading={loading}
            showQty={s.field === 'item'}
            // Item rows drill in only in Item mode — the API leaves a
            // Group/Type bucket's code empty, and the table only makes rows
            // with a code clickable.
            onRowClick={
              s.field === 'item'
                ? (row) => setDetailItem(row.name)
                : (row) => setDetail({
                    kind: s.field === 'sales_agent' ? 'sales_agent' : 'debtor',
                    code: row.code ?? row.name,
                    name: row.name,
                  })
            }
          />
        ))}
      </div>

      {/* Sales Documents */}
      <DocumentTable
        title="Sales"
        rows={recentSales}
        loading={loading}
        partyLabel="Debtor"
        onRowClick={(row) => setDocDetail({ row, side: 'sales' })}
      />

      <EntityDetail target={detail} onClose={() => setDetail(null)} filters={filters} />
      <DocumentDetail target={docDetail} onClose={() => setDocDetail(null)} />
      <ItemDetail itemCode={detailItem} onClose={() => setDetailItem(null)} filters={filters} history="sales" />

      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        pageTitle="Sales"
        filters={filters}
        options={options}
        charts={exportCharts}
        tables={exportTables}
      />
    </div>
  )
}
