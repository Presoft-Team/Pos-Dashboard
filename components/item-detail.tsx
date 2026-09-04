'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/db/client'
import { CostingMethod, DocumentRow, Filters, ItemCatalogRow } from '@/types'
import { toParams } from '@/lib/filters'
import { formatAmount, formatMoney, formatQty } from '@/lib/currency'
import DetailOverlay from '@/components/detail-overlay'
import DocumentTable from '@/components/document-table'
import DocumentDetail, { DocumentTarget } from '@/components/document-detail'

const FIXED_COST: CostingMethod = 0

// Item.CostingMethod's tinyint values — confirmed against real AutoCount
// data, not documented in the schema.
const COSTING_METHOD_LABELS: Record<CostingMethod, string> = {
  0: 'Fixed Cost',
  1: 'Weighted Average',
  2: 'FIFO',
  3: 'LIFO',
}

// The catalog returns one row per (item, location); the detail wants one
// item with its locations underneath.
interface ItemStock {
  location_name: string | null
  qty_on_hand: number
  cost: number
}

function Tier({ label, value }: { label: string; value: number | null }) {
  if (value === null) return null
  return (
    <p className="text-gray-400">
      {label} <span className="text-gray-700 font-medium">{formatAmount(value)}</span>
    </p>
  )
}

interface Props {
  itemCode: string | null
  onClose: () => void
  filters: Filters
  // Which history to show. The Sales page opens an item's sales documents,
  // Purchase opens its purchases; the Item page shows both.
  history?: 'sales' | 'purchase' | 'both'
  // 'above' when opened from inside another overlay (e.g. an agent's own
  // item breakdown in EntityDetail) — stacks over it instead of racing it
  // for the same layer. Its own nested DocumentDetail stays 'above' too;
  // reusing the one higher tier is enough since DOM order still paints the
  // later-opened overlay on top.
  layer?: 'base' | 'above'
}

// The full item record plus the documents it appears on. Opened from the
// Item page's cards and from the Item breakdown rows on Sales/Purchase, so
// it fetches by code rather than taking a preloaded row.
export default function ItemDetail({ itemCode, onClose, filters, history = 'both', layer = 'base' }: Props) {
  const supabase = createClient()

  const [rows, setRows] = useState<ItemCatalogRow[]>([])
  const [sales, setSales] = useState<DocumentRow[]>([])
  const [purchases, setPurchases] = useState<DocumentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [docDetail, setDocDetail] = useState<DocumentTarget | null>(null)

  useEffect(() => {
    if (!itemCode) return
    // Guards against a slow response for a previously-opened item landing
    // after the user has closed it or opened another.
    let cancelled = false

    async function fetchDetail() {
      if (!itemCode) return
      setLoading(true)
      setRows([]); setSales([]); setPurchases([])

      const dateRange = toParams(filters)
      const wantSales = history === 'sales' || history === 'both'
      const wantPurchases = history === 'purchase' || history === 'both'

      const [catalogRes, salesRes, purchaseRes] = await Promise.all([
        supabase.rpc('get_item_catalog_v2', { p_item: itemCode, p_limit: null }),
        wantSales
          ? supabase.rpc('get_recent_sales_v2', { ...dateRange, p_item: itemCode, p_limit: null })
          : Promise.resolve({ data: [], error: null }),
        wantPurchases
          ? supabase.rpc('get_recent_purchases_v2', { ...dateRange, p_item: itemCode, p_limit: null })
          : Promise.resolve({ data: [], error: null }),
      ])
      if (cancelled) return

      if (catalogRes.error) console.error('get_item_catalog_v2 error:', catalogRes.error.message)
      if (salesRes.error) console.error('item sales history error:', salesRes.error.message)
      if (purchaseRes.error) console.error('item purchase history error:', purchaseRes.error.message)

      setRows((catalogRes.data as ItemCatalogRow[]) ?? [])
      setSales((salesRes.data as DocumentRow[]) ?? [])
      setPurchases((purchaseRes.data as DocumentRow[]) ?? [])
      setLoading(false)
    }

    fetchDetail()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemCode, filters, history])

  if (!itemCode) return null

  // Per-item fields repeat across that item's location rows, so the first
  // row carries them all.
  const item = rows[0]
  const locations: ItemStock[] = rows.map((r) => ({
    location_name: r.location_name,
    qty_on_hand: r.qty_on_hand,
    cost: r.cost,
  }))
  const totalQty = locations.reduce((sum, l) => sum + l.qty_on_hand, 0)
  // Fixed Cost items have one cost item-wide; every other method's cost is
  // per-location, so only that table can show it honestly.
  const showLocationCost = item ? item.costing_method !== FIXED_COST : false

  return (
    <DetailOverlay
      open
      onClose={onClose}
      layer={layer}
      title={itemCode}
      subtitle={
        item
          ? [item.description, item.item_group, item.item_type].filter(Boolean).join(' · ')
          : undefined
      }
    >
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !item ? (
        <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
          No master record found for this item
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-start gap-4">
              {item.has_image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/presoft/items/${encodeURIComponent(item.item_code)}/image`}
                  alt={item.description || item.item_code}
                  className="w-20 h-20 rounded-lg object-cover border border-gray-100 shrink-0"
                />
              ) : (
                <div className="w-20 h-20 rounded-lg bg-gray-50 border border-gray-100 shrink-0" aria-hidden />
              )}
              <div className="min-w-0 grid grid-cols-2 gap-x-6 gap-y-2 flex-1">
                <div>
                  <p className="text-xs text-gray-400">Costing Method</p>
                  <p className="text-sm text-gray-800">{COSTING_METHOD_LABELS[item.costing_method]}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Unit Price</p>
                  <p className="text-sm text-gray-800">{formatAmount(item.unit_price)}</p>
                </div>
                {item.costing_method === FIXED_COST && (
                  <div>
                    <p className="text-xs text-gray-400">Standard Cost</p>
                    <p className="text-sm text-gray-800">{formatAmount(item.cost)}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-gray-400">Total Qty on Hand</p>
                  <p className="text-sm text-gray-800">{formatQty(totalQty)}</p>
                </div>
              </div>
            </div>

            {/* All six tiers plus min/max. A tier that's null in the database
                is hidden entirely — "not set" and "priced at 0" differ. */}
            <div className="px-5 py-3 border-b border-gray-100 flex flex-wrap gap-x-4 gap-y-1 text-xs">
              <Tier label="Price 1" value={item.price1} />
              <Tier label="Price 2" value={item.price2} />
              <Tier label="Price 3" value={item.price3} />
              <Tier label="Price 4" value={item.price4} />
              <Tier label="Price 5" value={item.price5} />
              <Tier label="Price 6" value={item.price6} />
              <Tier label="Min Price" value={item.min_price} />
              <Tier label="Max Price" value={item.max_price} />
            </div>

            {locations.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left">
                      <th className="px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Location</th>
                      {showLocationCost && (
                        <th className="px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide text-right">Up to Date Cost</th>
                      )}
                      <th className="px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide text-right">Qty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {locations.map((l, i) => (
                      <tr key={i}>
                        <td className="px-4 py-2.5 text-gray-700">{l.location_name ?? '—'}</td>
                        {showLocationCost && (
                          <td className="px-4 py-2.5 text-right text-gray-700">{formatAmount(l.cost)}</td>
                        )}
                        <td className="px-4 py-2.5 text-right text-gray-700">{formatQty(l.qty_on_hand)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="px-5 py-3 text-xs text-gray-400">No stock location recorded</p>
            )}
          </div>

          {/* Documents this item appears on. Each row's amount is the whole
              document's total, not this item's share of it — the item's own
              lines are inside the document's detail. */}
          {(history === 'sales' || history === 'both') && (
            <DocumentTable
              title="Sales History"
              rows={sales}
              partyLabel="Debtor"
              onRowClick={(row) => setDocDetail({ row, side: 'sales' })}
            />
          )}
          {(history === 'purchase' || history === 'both') && (
            <DocumentTable
              title="Purchase History"
              rows={purchases}
              partyLabel="Creditor"
              onRowClick={(row) => setDocDetail({ row, side: 'purchase' })}
            />
          )}

          <DocumentDetail target={docDetail} onClose={() => setDocDetail(null)} layer="above" />
        </>
      )}
    </DetailOverlay>
  )
}
