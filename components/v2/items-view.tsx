'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/db/client'
import { ItemCatalogRow } from '@/types'
import { DEFAULT_CURRENCY } from '@/lib/currency'
import { fmtPrice, fmtQty } from '@/lib/v2/format'
import { groupItems, type V2Item } from '@/lib/v2/items'
import CardSearch from './card-search'
import ItemDetailOverlay, { ItemThumb } from './item-detail-overlay'

const db = createClient()

// One page of the catalog. The search below is sent to the report rather
// than applied to a slice of it, so a match outside the first N items is
// still found.
const ITEM_LIMIT = 200

export default function V2Items() {
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [items, setItems] = useState<V2Item[]>([])
  // Raw (item, location) rows returned, not grouped items — the report's
  // limit applies to those, so that is what tells us the page was capped.
  const [rawCount, setRawCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeItem, setActiveItem] = useState<V2Item | null>(null)

  // Debounced so typing doesn't fire one report query per keystroke.
  useEffect(() => {
    const id = setTimeout(() => setSearch(query.trim()), 300)
    return () => clearTimeout(id)
  }, [query])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    db.rpc<ItemCatalogRow[]>('get_item_catalog_v2', {
      p_search: search || null,
      p_sort: 'item_code',
      p_limit: ITEM_LIMIT,
    }).then(({ data, error: err }) => {
      if (cancelled) return
      if (err) {
        setError(err.message)
        setItems([])
        setRawCount(0)
      } else {
        setItems(groupItems(data ?? []))
        setRawCount((data ?? []).length)
      }
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [search])

  // get_item_catalog_v2 carries no currency column — item prices are in the
  // account book's own currency, the same one every report is labelled
  // with in app/api/presoft/[name]/route.ts.
  const currency = DEFAULT_CURRENCY

  const rows = useMemo(
    () =>
      items.map((item) => {
        const soleLocation = item.locations.length === 1 ? item.locations[0].location_name : null
        const qtyLabel = soleLocation
          ? `Qty ${fmtQty(item.total_qty)} @ ${soleLocation}`
          : `Qty ${fmtQty(item.total_qty)} · ${item.locations.length} locations`
        return { item, qtyLabel }
      }),
    [items]
  )

  return (
    <>
      <header className="sticky top-0 z-10 bg-paper/90 backdrop-blur-xs px-4 pt-3.5 pb-2.5 flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-2.5 min-w-0">
          <Link
            href="/v2"
            aria-label="Back to dashboard"
            title="Back to dashboard"
            className="w-8 h-8 rounded-lg border border-border bg-card text-ink flex items-center justify-center shadow-card shrink-0 hover:bg-white hover:border-slate-300 hover:text-blue"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </Link>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/presoft.png" alt="Presoft" className="h-7 w-auto shrink-0" />
          <div className="min-w-0">
            <h1 className="text-[15.5px] font-bold m-0 tracking-tight">Items</h1>
            <p className="m-0 text-[11px] text-sand">Stock item list</p>
          </div>
        </div>
      </header>

      <div className="max-w-[640px] mx-auto px-4 pt-3.5 pb-10 flex flex-col gap-3.5">
        <div className="bg-card border border-border rounded-2xl shadow-card px-4 pt-4 pb-3.5">
          <div className="mb-3.5">
            <h2 className="text-[14.5px] font-bold m-0 mb-0.5">All Items</h2>
            <p className="m-0 text-xs text-sand">Code, description, cost &amp; pricing</p>
          </div>

          <CardSearch value={query} onChange={setQuery} placeholder="Search items by code or description..." />

          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div className="py-6 px-3 text-center text-[12.5px] text-red">{error}</div>
          ) : (
            <>
              <div className="flex flex-col">
                {rows.map(({ item, qtyLabel }) => (
                  <button
                    key={item.item_code}
                    type="button"
                    onClick={() => setActiveItem(item)}
                    className="flex items-center gap-3 py-2.5 px-1 border-b border-border last:border-b-0 rounded-lg text-left w-full hover:bg-paper"
                  >
                    <ItemThumb item={item} size={42} rounded="rounded-[10px]" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-sand">{item.item_code}</div>
                      <div className="text-[13.5px] font-semibold truncate">{item.description}</div>
                      <div className="text-[11px] text-sand mt-0.5">Cost {fmtPrice(item.cost, currency)}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[13.5px] font-bold tabular-nums">{fmtPrice(item.unit_price, currency)}</div>
                      <div className={'text-[11px] mt-0.5 whitespace-nowrap ' + (item.total_qty < 0 ? 'text-red' : 'text-sand')}>
                        {qtyLabel}
                      </div>
                    </div>
                    <div className="text-sand text-base shrink-0">&rsaquo;</div>
                  </button>
                ))}
              </div>

              {rows.length === 0 && (
                <div className="py-6 px-3 text-center text-sand text-[12.5px]">
                  <div className="font-medium">
                    {search ? `No items found matching "${search}"` : 'No items in this book'}
                  </div>
                </div>
              )}

              {rawCount >= ITEM_LIMIT && (
                <p className="m-0 pt-3 text-center text-[10.5px] text-sand">
                  Showing the first {ITEM_LIMIT} items — narrow the search to find more.
                </p>
              )}
            </>
          )}
        </div>

        <footer className="text-center text-[11px] text-sand pt-2 pb-1">
          Live stock data from this client&apos;s AutoCount book
        </footer>
      </div>

      <ItemDetailOverlay item={activeItem} currency={currency} onClose={() => setActiveItem(null)} />
    </>
  )
}
