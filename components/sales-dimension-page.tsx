'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/db/client'
import { EntityOption, PerformanceItemRow, PerformanceRow } from '@/types'
import { useSharedFilters } from '@/lib/filter-context'
import { pivotRevenueByCurrency } from '@/lib/currency'
import { withoutUnattributed } from '@/lib/breakdown'
import { entityRevenueColumns, entityRevenueOnlyColumns } from '@/lib/export'
import DatePresetFilter from '@/components/date-preset-filter'
import MultiCombobox from '@/components/multi-combobox'
import SalesFilterPanel, {
  EMPTY_SALES_FILTER_OPTIONS, SalesFilterKey, SalesFilterOptions, SalesFilterState,
} from '@/components/sales-filter-panel'
import BarChartWidget from '@/components/bar-chart'
import PerformanceTable from '@/components/performance-table'
import EntityDetail, { EntityKind, EntityTarget } from '@/components/entity-detail'
import ItemDetail from '@/components/item-detail'
import ExportModal, { ExportChartSpec, ExportTableSpec } from '@/components/export-modal'
import { Download } from 'lucide-react'

// How many bars a chart shows. The breakdown table always holds every row —
// this only caps the charts, which stop being readable well before the data
// runs out.
const TOP_N_CHOICES = [5, 10, 15, 20] as const

// The second chart's dimension, chosen by the user. These measure revenue on
// an item's own lines rather than whole documents, so their totals are lower
// than the breakdown above — a document with no stock lines has no item to
// attribute.
const ITEM_DIMENSIONS = [
  { key: 'item', label: 'Item' },
  { key: 'item_group', label: 'Group' },
  { key: 'item_type', label: 'Type' },
  { key: 'item_brand', label: 'Brand' },
  { key: 'item_class', label: 'Class' },
  { key: 'item_category', label: 'Category' },
] as const

type ItemDimension = (typeof ITEM_DIMENSIONS)[number]['key']

interface Props {
  // 'agent' | 'area' | 'location' — the dimension this page groups by.
  dimension: SalesFilterKey & ('agent' | 'area' | 'location')
  title: string
  subtitle: string
  // Label for the primary filter and the breakdown's first column.
  label: string
  // Which list in the options payload feeds the primary filter.
  optionsKey: keyof SalesFilterOptions
  // Only agents have a detail overlay today; area and location have no
  // entity behind them to open.
  detailKind?: EntityKind
}

// Shared body of the three Sales sub-pages. They differ only in which
// dimension they group by, so the page is written once and each route is a
// thin wrapper — the same approach PartyCatalog takes for Debtor/Creditor.
export default function SalesDimensionPage({
  dimension, title, subtitle, label, optionsKey, detailKind,
}: Props) {
  const supabase = createClient()
  const { filters, setFilters, options: sharedOptions } = useSharedFilters()

  const [primary, setPrimary] = useState<string[]>([])
  const [extra, setExtra] = useState<SalesFilterState>({})
  const [filterOptions, setFilterOptions] = useState<SalesFilterOptions>(EMPTY_SALES_FILTER_OPTIONS)
  const [rows, setRows] = useState<PerformanceRow[]>([])
  const [itemRows, setItemRows] = useState<PerformanceItemRow[]>([])
  const [itemDimension, setItemDimension] = useState<ItemDimension>('item')
  const [topN, setTopN] = useState<number>(5)
  const [itemTopN, setItemTopN] = useState<number>(5)
  const [loading, setLoading] = useState(true)
  const [exportOpen, setExportOpen] = useState(false)
  const [detail, setDetail] = useState<EntityTarget | null>(null)
  const [detailItem, setDetailItem] = useState<string | null>(null)
  // Two distinct buckets — (No Agent)/(No Area)/(No Location) on the main
  // breakdown, (No Item)/(No Item Group)/etc on the best-sellers side —
  // toggled independently. Both hidden by default: each routinely dwarfs
  // every real row. Tucked into the Filters panel rather than their own row.
  const [showUnattributed, setShowUnattributed] = useState(false)
  const [showItemUnattributed, setShowItemUnattributed] = useState(false)

  // Option lists are master data — fetched once, not per filter change.
  useEffect(() => {
    supabase.rpc('get_sales_filter_options_v2').then(({ data, error }) => {
      if (error) return console.error('get_sales_filter_options_v2 error:', error.message)
      setFilterOptions((data?.[0] as SalesFilterOptions) ?? EMPTY_SALES_FILTER_OPTIONS)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { fetchData() }, [filters.date_from, filters.date_to, primary, extra, itemDimension])

  // The page's own dimension is filtered by the control outside the panel,
  // so it's merged in here rather than living in `extra`.
  function filterParams() {
    const params: Record<string, unknown> = {
      p_date_from: filters.date_from || null,
      p_date_to: filters.date_to || null,
      [`p_${dimension}`]: primary,
    }
    for (const [key, value] of Object.entries(extra)) {
      if (value && value.length > 0) params[`p_${key}`] = value
    }
    return params
  }

  async function fetchData() {
    setLoading(true)
    const params = filterParams()

    const [byRes, itemRes] = await Promise.all([
      supabase.rpc('get_sales_by_v2', { ...params, p_sales_by: dimension, p_limit: null }),
      supabase.rpc('get_sales_by_v2', { ...params, p_sales_by: itemDimension, p_limit: null }),
    ])

    if (byRes.error) console.error('get_sales_by_v2 error:', byRes.error.message)
    if (itemRes.error) console.error(`get_sales_by_v2 (${itemDimension}) error:`, itemRes.error.message)

    setRows((byRes.data as PerformanceRow[]) ?? [])
    setItemRows((itemRes.data as PerformanceItemRow[]) ?? [])
    setLoading(false)
  }

  // Filtered here rather than in fetchData so switching either checkbox
  // doesn't need a re-fetch.
  const visibleRows = withoutUnattributed(rows, showUnattributed)
  const visibleItemRows = withoutUnattributed(itemRows, showItemUnattributed)

  const chartData = pivotRevenueByCurrency(
    visibleRows.map((r) => ({ ...r, total_revenue: r.revenue, total_qty: 0 })),
    (r) => r.name,
    topN
  )

  // Item lines do carry a quantity, unlike the document-level rows above —
  // so this chart's tooltip can show Qty honestly.
  const itemChartData = pivotRevenueByCurrency(
    visibleItemRows.map((r) => ({ ...r, total_revenue: r.revenue, total_qty: r.qty ?? 0 })),
    (r) => r.name,
    itemTopN
  )

  const primaryOptions: EntityOption[] = filterOptions[optionsKey]

  const itemLabel = ITEM_DIMENSIONS.find((d) => d.key === itemDimension)?.label ?? 'Item'
  // The bucket's real name — "Item Group"/"Item Type"/etc, matching
  // lib/breakdown.ts's UNATTRIBUTED_LABELS — not the toggle's shorter
  // "Group"/"Type" label.
  const itemBucketLabel = itemDimension === 'item' ? 'Item' : `Item ${itemLabel}`

  // Mirrors the page: the two charts, then the breakdown and the best-seller
  // figures behind the second chart.
  const exportCharts: ExportChartSpec[] = [
    { id: 'chart', label: `Top ${topN} by ${label}`, render: () => <BarChartWidget data={chartData} /> },
    { id: 'item-chart', label: `Top ${itemTopN} by ${itemLabel}`, render: () => <BarChartWidget data={itemChartData} showQty /> },
  ]
  const exportTables: ExportTableSpec[] = [
    {
      id: 'breakdown',
      label: `${label} Breakdown`,
      columns: entityRevenueOnlyColumns('name', label),
      rows: visibleRows as unknown as Record<string, unknown>[],
    },
    {
      id: 'item-breakdown',
      label: `${itemLabel} Breakdown`,
      columns: entityRevenueColumns('name', itemLabel),
      rows: visibleItemRows as unknown as Record<string, unknown>[],
    },
  ]

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{title}</h1>
          <p className="text-sm text-gray-500">{subtitle}</p>
        </div>

        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 w-full lg:w-auto">
          <DatePresetFilter filters={filters} options={sharedOptions} onChange={setFilters} />
          <div className="w-full sm:w-56 min-w-0">
            <MultiCombobox
              value={primary}
              options={primaryOptions}
              placeholder={`All ${label}s`}
              onChange={setPrimary}
              ariaLabel={label}
            />
          </div>
          <SalesFilterPanel
            value={extra}
            onChange={setExtra}
            options={filterOptions}
            exclude={dimension}
            unattributed={[
              { checked: showUnattributed, onChange: setShowUnattributed, label: `(No ${label})` },
              { checked: showItemUnattributed, onChange: setShowItemUnattributed, label: `(No ${itemBucketLabel})` },
            ]}
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
          <h3 className="font-semibold text-gray-900 text-sm">Top {topN} by {label}</h3>
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
          <BarChartWidget data={chartData} />
        )}
      </div>

      {/* Breakdown */}
      <PerformanceTable
        title={`${label} Breakdown`}
        rows={visibleRows}
        loading={loading}
        onRowClick={
          detailKind
            ? (row) => setDetail({ kind: detailKind, code: row.code ?? row.name, name: row.name })
            : undefined
        }
      />

      {/* Best sellers — same filters, grouped by whichever item dimension
          the user picks. */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h3 className="font-semibold text-gray-900 text-sm">
            Top {itemTopN} by {ITEM_DIMENSIONS.find((d) => d.key === itemDimension)?.label}
          </h3>
          <div className="flex rounded-lg border border-gray-200 bg-white p-0.5 gap-0.5 self-start">
            {TOP_N_CHOICES.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setItemTopN(n)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  itemTopN === n ? 'bg-brand text-white' : 'text-gray-600 hover:bg-gray-50'
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
          <BarChartWidget data={itemChartData} showQty />
        )}
        <div className="grid grid-cols-3 sm:flex sm:overflow-x-auto rounded-lg border border-gray-200 bg-white p-0.5 gap-0.5 mt-4">
          {ITEM_DIMENSIONS.map((d) => (
            <button
              key={d.key}
              type="button"
              onClick={() => setItemDimension(d.key)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                itemDimension === d.key ? 'bg-brand text-white' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <PerformanceTable
        title={`${itemLabel} Breakdown`}
        rows={visibleItemRows}
        loading={loading}
        showQty
        // Only the Item dimension has a real item code to drill into — a
        // Group/Type/Brand/Class/Category bucket has none, same rule
        // PerformanceTable already applies via row.code.
        onRowClick={itemDimension === 'item' ? (row) => setDetailItem(row.name) : undefined}
      />

      <EntityDetail target={detail} onClose={() => setDetail(null)} filters={filters} />
      <ItemDetail itemCode={detailItem} onClose={() => setDetailItem(null)} filters={filters} history="sales" />

      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        pageTitle={title}
        filters={filters}
        options={sharedOptions}
        charts={exportCharts}
        tables={exportTables}
      />
    </div>
  )
}
