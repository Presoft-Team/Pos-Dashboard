'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/db/client'
import { DocumentRow, GroupByMode, PurchaseItemRow, PurchaseKpiSummary, PurchaseRow } from '@/types'
import { toParams } from '@/lib/filters'
import { useSharedFilters } from '@/lib/filter-context'
import { pivotRevenueByCurrency } from '@/lib/currency'
import { documentColumns, entityPurchaseColumns, entityPurchaseOnlyColumns } from '@/lib/export'
import PurchaseKpiCards from '@/components/purchase-kpi-cards'
import FilterBar from '@/components/filter-bar'
import CurrencyFilter from '@/components/currency-filter'
import DatePresetFilter from '@/components/date-preset-filter'
import BarChartWidget from '@/components/bar-chart'
import PurchaseTable from '@/components/purchase-table'
import DocumentTable from '@/components/document-table'
import EntityDetail, { EntityTarget } from '@/components/entity-detail'
import DocumentDetail, { DocumentTarget } from '@/components/document-detail'
import ItemDetail from '@/components/item-detail'
import UnattributedToggle from '@/components/unattributed-toggle'
import { withoutUnattributed } from '@/lib/breakdown'
import ExportModal, { ExportChartSpec, ExportTableSpec } from '@/components/export-modal'
import { Download } from 'lucide-react'

const ENTITY_FIELDS = ['item', 'creditor'] as const
type EntityField = (typeof ENTITY_FIELDS)[number]

const GROUP_LABEL: Record<GroupByMode, string> = { item: 'Item', group: 'Group', type: 'Type' }

const CHART_LIMIT = 5

// How many documents the Purchases list asks for. The table shows 10
// at a time with a Show more/Show all control, so this is the ceiling on
// what "all" can reach — not the number on screen.
const RECENT_LIMIT = 100

function chartData(rows: (PurchaseRow | PurchaseItemRow)[]) {
  return pivotRevenueByCurrency(
    rows.map((r) => ({ ...r, total_revenue: r.purchase, total_qty: 'qty' in r ? r.qty : 0 })),
    (r) => r.name,
    CHART_LIMIT
  )
}

// Purchase-side twin of Performance — same Top-N-breakdown-per-dimension
// layout, but Item/Creditor only (no Sales Agent, not a
// purchase-side concept — see FilterBar's showSalesAgent prop), plus a KPI
// row up top so Total Purchase can be read alongside Total Revenue for a
// quick purchase-vs-revenue comparison.
export default function PurchasePage() {
  const supabase = createClient()

  const { filters, setFilters, groupBy, setGroupBy, options } = useSharedFilters()
  const [kpi, setKpi] = useState<PurchaseKpiSummary[]>([])
  const [itemRows, setItemRows] = useState<PurchaseItemRow[]>([])
  const [creditorRows, setCreditorRows] = useState<PurchaseRow[]>([])
  const [recentPurchases, setRecentPurchases] = useState<DocumentRow[]>([])
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
    // p_limit defaults to 5 server-side (it feeds the "Top 5" chart) — the
    // breakdown tables need the full set, so pass null (= no LIMIT) here and
    // let chartData() above re-slice down to 5 for the chart only.
    const p = { ...toParams(filters), p_limit: null }

    const [kpiRes, itemRes, creditorRes, recentRes] = await Promise.all([
      supabase.rpc('get_kpi_summary_v2', toParams(filters)),
      supabase.rpc('get_purchase_item_v2', { ...p, p_group_by: groupBy }),
      supabase.rpc('get_purchase_creditor_v2', p),
      // Capped rather than unlimited (p_limit: null above): this is a
      // purchase documents list, and an all-time date range would otherwise pull every
      // document in the book across the wire to show the newest few.
      supabase.rpc('get_recent_purchases_v2', { ...toParams(filters), p_limit: RECENT_LIMIT }),
    ])

    for (const [label, res] of [['kpi_summary', kpiRes], ['item', itemRes], ['creditor', creditorRes]] as const) {
      if (res.error) console.error(`get_purchase_${label}_v2 error:`, res.error.message)
    }
    if (recentRes.error) console.error('get_recent_purchases_v2 error:', recentRes.error.message)

    setKpi((kpiRes.data as PurchaseKpiSummary[]) ?? [])
    setItemRows((itemRes.data as PurchaseItemRow[]) ?? [])
    setCreditorRows((creditorRes.data as PurchaseRow[]) ?? [])
    setRecentPurchases((recentRes.data as DocumentRow[]) ?? [])
    setLoading(false)
  }

  const itemLabel = GROUP_LABEL[groupBy]
  const sections: { field: EntityField; title: string; rows: PurchaseRow[] }[] = [
    // Filtered here rather than per-consumer so the charts, the tables and
    // the PDF export all reflect the checkbox from one place.
    { field: 'item', title: `${itemLabel} Breakdown`, rows: withoutUnattributed(itemRows, showUnattributed) },
    { field: 'creditor', title: 'Creditor Breakdown', rows: withoutUnattributed(creditorRows, showUnattributed) },
  ]
  // A dimension with no rows for the current filters has nothing to chart
  // or table, so it hides itself — while loading, keep every section
  // rendered (with its own spinner) since rows are just empty-so-far, not
  // empty-for-real yet.
  const visibleSections = loading ? sections : sections.filter((s) => s.rows.length > 0)

  const exportCharts: ExportChartSpec[] = visibleSections.map((s) => ({
    id: `${s.field}-chart`, label: `Top 5 ${s.title}`, render: () => <BarChartWidget data={chartData(s.rows)} showQty={s.field === 'item'} />,
  }))
  const exportTables: ExportTableSpec[] = visibleSections.map((s) => ({
    id: `${s.field}-table`, label: s.title,
    // Only the Item breakdown has quantities — the Creditor one reads AP
    // document headers, which carry none, so it would export a column of
    // zeroes.
    columns: s.field === 'item'
      ? entityPurchaseColumns('name', itemLabel)
      : entityPurchaseOnlyColumns('name', s.title.split(' Breakdown')[0]),
    rows: s.rows as unknown as Record<string, unknown>[],
  }))
  exportTables.push({
    id: 'purchase-documents',
    label: 'Purchases',
    columns: documentColumns('Creditor', false),
    rows: recentPurchases as unknown as Record<string, unknown>[],
  })

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Purchase</h1>
          <p className="text-sm text-gray-500">Item and Creditor purchase performance</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <FilterBar
            filters={filters}
            options={options}
            onChange={setFilters}
            groupBy={groupBy}
            onGroupByChange={handleGroupByChange}
            datePicker={<DatePresetFilter filters={filters} options={options} onChange={setFilters} />}
            showSalesAgent={false}
            showDebtor={false}
            showCreditor
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
      <PurchaseKpiCards data={kpi} />

      <UnattributedToggle
        checked={showUnattributed}
        onChange={setShowUnattributed}
        label="(No Item)"
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
          <PurchaseTable
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
                : (row) => setDetail({ kind: 'creditor', code: row.code ?? row.name, name: row.name })
            }
          />
        ))}
      </div>

      {/* Purchase Documents */}
      <DocumentTable
        title="Purchases"
        rows={recentPurchases}
        loading={loading}
        partyLabel="Creditor"
        onRowClick={(row) => setDocDetail({ row, side: 'purchase' })}
      />


      <EntityDetail target={detail} onClose={() => setDetail(null)} filters={filters} />
      <DocumentDetail target={docDetail} onClose={() => setDocDetail(null)} />
      <ItemDetail itemCode={detailItem} onClose={() => setDetailItem(null)} filters={filters} history="purchase" />

      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        pageTitle="Purchase"
        filters={filters}
        options={options}
        charts={exportCharts}
        tables={exportTables}
      />
    </div>
  )
}
