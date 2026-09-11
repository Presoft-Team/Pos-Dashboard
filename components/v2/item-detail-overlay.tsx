'use client'

import { fmtPrice, fmtQty } from '@/lib/v2/format'
import { COSTING_METHOD_LABELS, FIXED_COST, marginPct, type V2Item } from '@/lib/v2/items'

const PRICE_LABELS = ['Price 1', 'Price 2', 'Price 3', 'Price 4', 'Price 5', 'Price 6']

interface Props {
  item: V2Item | null
  currency: string
  onClose: () => void
}

export default function ItemDetailOverlay({ item, currency, onClose }: Props) {
  // The prototype had a UOM switcher across the top (its mock items carried
  // a `uoms` array with a price table each). get_item_catalog_v2 returns
  // the base UOM's tiers only, so there is nothing to switch between and
  // the control is gone rather than shown with one dead tab. Bringing it
  // back means proxying autocount-write-service's existing
  // GET /api/reports/item-uoms?itemCode= behind a new RPC name in
  // app/api/presoft/[name]/route.ts.
  // Unmounted when there is no item — see settings-overlay.tsx for why a
  // `hidden` attribute is not enough against a `.flex` utility.
  if (!item) return null

  const perLocationCost = item.costing_method !== FIXED_COST

  return (
    <div
      role="dialog"
      aria-labelledby="v2ItemDetailTitle"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      className="fixed inset-0 bg-slate-900/45 backdrop-blur-[5px] z-[110] flex items-center justify-center p-4"
    >
      <div className="w-full max-w-[560px] max-h-[88vh] bg-card rounded-[18px] border border-border shadow-[0_20px_45px_rgba(15,23,42,0.2)] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-[1.125rem] py-3.5 border-b border-border bg-paper">
          <h2 id="v2ItemDetailTitle" className="text-[15px] font-bold m-0 truncate">
            {`${item.item_code} — ${item.description}`}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close item detail"
            className="w-[30px] h-[30px] rounded-lg border-none bg-transparent text-sand text-xl leading-none flex items-center justify-center shrink-0 hover:bg-card hover:text-ink"
          >
            &times;
          </button>
        </div>

        <div className="p-5 overflow-y-auto">
            <div className="flex items-center gap-3.5 mb-4">
              <ItemThumb item={item} size={64} rounded="rounded-2xl" />
              <div className="min-w-0">
                <div className="text-xs font-bold text-sand">{item.item_code}</div>
                <div className="text-base font-bold my-0.5">{item.description}</div>
                <div className="text-[11.5px] text-sand">
                  {COSTING_METHOD_LABELS[item.costing_method]} · Total Balance Qty: {fmtQty(item.total_qty)}
                  {item.item_group ? ` · ${item.item_group}` : ''}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 mb-4">
              <div className="bg-paper border border-border rounded-xl px-3.5 py-2.5">
                <div className="text-[11px] text-sand font-semibold mb-0.5">
                  {perLocationCost ? 'Up to Date Cost' : 'Standard Cost'}
                </div>
                <div className="text-base font-bold">
                  {perLocationCost ? 'Varies by location' : fmtPrice(item.cost, currency)}
                </div>
              </div>
              <div className="bg-paper border border-border rounded-xl px-3.5 py-2.5">
                <div className="text-[11px] text-sand font-semibold mb-0.5">Unit Price</div>
                <div className="text-base font-bold">{fmtPrice(item.unit_price, currency)}</div>
              </div>
            </div>

            <div className="flex flex-col mb-5">
              {item.prices.map((price, i) => {
                // A null tier is "not set" in AutoCount — skipped entirely
                // rather than rendered as 0.00.
                if (price == null) return null
                const margin = marginPct(price, item.cost)
                return (
                  <div
                    key={PRICE_LABELS[i]}
                    className="flex items-center justify-between gap-2.5 py-2.5 border-b border-border last:border-b-0"
                  >
                    <div className="text-[12.5px] font-semibold text-sand w-14 shrink-0">{PRICE_LABELS[i]}</div>
                    <div className="text-[14.5px] font-bold flex-1">{fmtPrice(price, currency)}</div>
                    {margin != null && (
                      <div
                        className={
                          'inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold shrink-0 whitespace-nowrap ' +
                          (margin >= 0 ? 'bg-green-bg text-green' : 'bg-red-bg text-red')
                        }
                        title="Gross margin against this item's cost"
                      >
                        {margin.toFixed(2)}%
                      </div>
                    )}
                  </div>
                )
              })}
              {item.prices.every((p) => p == null) && (
                <div className="py-3 text-[12.5px] text-sand">No price tiers set on this item.</div>
              )}
            </div>

            <div>
              <div className="text-[13px] font-bold mb-2">
                {perLocationCost ? 'Up To Date Cost' : 'Stock by Location'}
              </div>
              <div className="border border-border rounded-xl overflow-hidden">
                <div className="grid grid-cols-[1.4fr_1fr_1fr] gap-2 px-3 py-2.5 text-[11px] font-bold text-sand uppercase tracking-wide bg-paper">
                  <div>Location</div>
                  <div className="text-right">Qty</div>
                  <div className="text-right">Unit Cost</div>
                </div>
                {item.locations.map((row, i) => (
                  <div
                    key={`${row.location_name ?? 'none'}-${i}`}
                    className="grid grid-cols-[1.4fr_1fr_1fr] gap-2 px-3 py-2.5 text-[12.5px] border-t border-border"
                  >
                    <div className="truncate">{row.location_name || '(No Location)'}</div>
                    <div className="text-right tabular-nums">{fmtQty(row.qty_on_hand)}</div>
                    <div className="text-right tabular-nums">{fmtPrice(row.cost, currency)}</div>
                  </div>
                ))}
                {item.locations.length > 1 && (
                  <div className="grid grid-cols-[1.4fr_1fr_1fr] gap-2 px-3 py-2.5 text-[12.5px] border-t border-border bg-paper font-bold">
                    <div>Total ({item.locations.length} locations)</div>
                    <div className="text-right tabular-nums">{fmtQty(item.total_qty)}</div>
                    <div className="text-right">&mdash;</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
  )
}

// The prototype used an emoji per mock item. Real items either have a photo
// in AutoCount (Item.Image, served by /api/presoft/items/{code}/image) or
// none at all — in which case a neutral glyph stands in, not a made-up one.
export function ItemThumb({ item, size, rounded }: { item: V2Item; size: number; rounded: string }) {
  return (
    <div
      className={`${rounded} bg-paper border border-border flex items-center justify-center shrink-0 overflow-hidden text-sand`}
      style={{ width: size, height: size }}
    >
      {item.has_image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/presoft/items/${encodeURIComponent(item.item_code)}/image`}
          alt=""
          className="w-full h-full object-cover"
        />
      ) : (
        <svg viewBox="0 0 24 24" width={Math.round(size * 0.45)} height={Math.round(size * 0.45)} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 8l-9-5-9 5 9 5 9-5z"></path>
          <path d="M3 8v8l9 5 9-5V8"></path>
        </svg>
      )}
    </div>
  )
}
