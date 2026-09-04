'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/db/client'
import { PerformanceItemRow, SalesAnalysisRow } from '@/types'
import { useSharedFilters } from '@/lib/filter-context'
import { pivotRevenueByCurrency } from '@/lib/currency'
import { entityRevenueColumns } from '@/lib/export'
import { withoutUnattributed } from '@/lib/breakdown'
import {
  AnalysisColumnKey, AnalysisMeasureKey, DEFAULT_ANALYSIS_DOC_TYPES, DEFAULT_ANALYSIS_MEASURES,
} from '@/lib/sales-analysis'
import DatePresetFilter from '@/components/date-preset-filter'
import { EMPTY_SALES_FILTER_OPTIONS, SalesFilterOptions, SalesFilterState } from '@/components/sales-filter-panel'
import SalesAnalysisPanel from '@/components/sales-analysis-panel'
import SalesAnalysisTable from '@/components/sales-analysis-table'
import BarChartWidget from '@/components/bar-chart'
import PerformanceTable from '@/components/performance-table'
import ItemDetail from '@/components/item-detail'
import ExportModal, { ExportChartSpec, ExportTableSpec } from '@/components/export-modal'
import { Download } from 'lucide-react'

const TOP_N_CHOICES = [5, 10, 15, 20] as const

// Caps the line-level analysis fetch — a wide-open date range over every
// document line could otherwise pull hundreds of thousands of rows across
// the wire. The breakdown table above stays unlimited (it's pre-aggregated
// server-side); this is raw lines, so it needs its own ceiling.
const ANALYSIS_LIMIT = 5000

// Sales overview — Item performance, filtered by the full field set (same
// panel as the Sales by Agent/Area/Location pages), with no single field
// pinned outside it since this page has no one dimension of its own. Also
// hosts the Multi Dimension Sales Analysis panel, a line-level browser
// separate from the pre-aggregated Item breakdown below.
export default function SalesPage() {
  const supabase = createClient()

  const { filters, setFilters, options: sharedOptions } = useSharedFilters()

  const [extra, setExtra] = useState<SalesFilterState>({})
  const [filterOptions, setFilterOptions] = useState<SalesFilterOptions>(EMPTY_SALES_FILTER_OPTIONS)
  const [itemRows, setItemRows] = useState<PerformanceItemRow[]>([])
  const [topN, setTopN] = useState<number>(5)
  const [loading, setLoading] = useState(true)
  const [exportOpen, setExportOpen] = useState(false)
  const [detailItem, setDetailItem] = useState<string | null>(null)
  // Hidden by default — the unattributed bucket routinely dwarfs every real
  // row, and it's tucked into the Filters panel rather than its own row now.
  const [showUnattributed, setShowUnattributed] = useState(false)

  // Multi Dimension Sales Analysis panel state — separate from the Item
  // breakdown above, and only fetched on demand (Apply), not on every
  // filter change, since it's a much heavier line-level query.
  const [analysisColumns, setAnalysisColumns] = useState<AnalysisColumnKey[]>([])
  const [analysisMeasures, setAnalysisMeasures] = useState<AnalysisMeasureKey[]>(DEFAULT_ANALYSIS_MEASURES)
  const [analysisDocTypes, setAnalysisDocTypes] = useState<string[]>(DEFAULT_ANALYSIS_DOC_TYPES)
  const [analysisRows, setAnalysisRows] = useState<SalesAnalysisRow[]>([])
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [analysisRan, setAnalysisRan] = useState(false)

  // Option lists are master data — fetched once, not per filter change.
  useEffect(() => {
    supabase.rpc('get_sales_filter_options_v2').then(({ data, error }) => {
      if (error) return console.error('get_sales_filter_options_v2 error:', error.message)
      setFilterOptions((data?.[0] as SalesFilterOptions) ?? EMPTY_SALES_FILTER_OPTIONS)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { fetchData() }, [filters.date_from, filters.date_to, extra])

  function filterParams() {
    const params: Record<string, unknown> = {
      p_date_from: filters.date_from || null,
      p_date_to: filters.date_to || null,
    }
    for (const [key, value] of Object.entries(extra)) {
      if (value && value.length > 0) params[`p_${key}`] = value
    }
    return params
  }

  async function fetchData() {
    setLoading(true)
    const params = filterParams()

    const itemRes = await supabase.rpc('get_sales_by_v2', { ...params, p_sales_by: 'item', p_limit: null })
    if (itemRes.error) console.error('get_sales_by_v2 (item) error:', itemRes.error.message)

    setItemRows((itemRes.data as PerformanceItemRow[]) ?? [])
    setLoading(false)
  }

  async function runAnalysis() {
    setAnalysisLoading(true)
    const params = filterParams()
    const res = await supabase.rpc('get_sales_analysis_v2', {
      ...params, p_doc_types: analysisDocTypes, p_limit: ANALYSIS_LIMIT,
    })
    if (res.error) console.error('get_sales_analysis_v2 error:', res.error.message)
    setAnalysisRows((res.data as SalesAnalysisRow[]) ?? [])
    setAnalysisRan(true)
    setAnalysisLoading(false)
  }

  // Filtered here rather than per-consumer so the chart, the table and the
  // PDF export all reflect the checkbox from one place.
  const visibleItemRows = withoutUnattributed(itemRows, showUnattributed)

  const chartData = pivotRevenueByCurrency(
    visibleItemRows.map((r) => ({ ...r, total_revenue: r.revenue, total_qty: r.qty ?? 0 })),
    (r) => r.name,
    topN
  )

  const exportCharts: ExportChartSpec[] = [
    { id: 'item-chart', label: `Top ${topN} by Item`, render: () => <BarChartWidget data={chartData} showQty /> },
  ]
  const exportTables: ExportTableSpec[] = [
    {
      id: 'item-table',
      label: 'Item Breakdown',
      columns: entityRevenueColumns('name', 'Item'),
      rows: visibleItemRows as unknown as Record<string, unknown>[],
    },
  ]

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Sales</h1>
          <p className="text-sm text-gray-500">Item performance</p>
        </div>
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 w-full sm:w-auto">
          <DatePresetFilter filters={filters} options={sharedOptions} onChange={setFilters} />
          <SalesAnalysisPanel
            filterValue={extra}
            onFilterChange={setExtra}
            filterOptions={filterOptions}
            unattributed={[{ checked: showUnattributed, onChange: setShowUnattributed, label: '(No Item)' }]}
            columns={analysisColumns}
            onColumnsChange={setAnalysisColumns}
            docTypes={analysisDocTypes}
            onDocTypesChange={setAnalysisDocTypes}
            measures={analysisMeasures}
            onMeasuresChange={setAnalysisMeasures}
            onApply={runAnalysis}
          />
          <button
            onClick={() => setExportOpen(true)}
            className="h-9 flex items-center justify-center gap-1.5 px-3 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg transition-colors whitespace-nowrap w-full sm:w-auto shrink-0"
          >
            <Download size={15} />
            Export
          </button>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h3 className="font-semibold text-gray-900 text-sm">Top {topN} by Item</h3>
          {/* Caps the chart only — the breakdown below always shows all. */}
          <div className="flex rounded-lg border border-gray-200 bg-white p-0.5 gap-0.5 self-start">
            {TOP_N_CHOICES.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setTopN(n)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  topN === n ? 'bg-brand text-white' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-[300px]">
            <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <BarChartWidget data={chartData} showQty />
        )}
      </div>

      {/* Item Breakdown */}
      <PerformanceTable
        title="Item Breakdown"
        rows={visibleItemRows}
        loading={loading}
        showQty
        onRowClick={(row) => setDetailItem(row.name)}
      />

      {analysisRan && (
        <SalesAnalysisTable
          rows={analysisRows}
          columns={analysisColumns}
          measures={analysisMeasures}
          loading={analysisLoading}
        />
      )}

      <ItemDetail itemCode={detailItem} onClose={() => setDetailItem(null)} filters={filters} history="sales" />

      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        pageTitle="Sales"
        filters={filters}
        options={sharedOptions}
        charts={exportCharts}
        tables={exportTables}
      />
    </div>
  )
}
