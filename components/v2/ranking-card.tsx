'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import TopNToggle from './top-n-toggle'
import CardSearch from './card-search'
import PeriodNav from './period-nav'
import UnavailableNote from './unavailable-note'
import { usePeriodSwipe } from './use-period-swipe'
import { usePreferences } from './preferences'
import { fmtMoney } from '@/lib/v2/format'
import { periodRange, type PeriodRange, type V2GroupBy } from '@/lib/v2/periods'

export interface RankingRow {
  // Stable React key — the display name isn't unique enough on its own
  // (two debtors can share a company name; an agent bucket can be '').
  key: string
  name: string
  amount: number
  currency: string
  // Secondary line under the name — the item cards' "142 units sold".
  meta?: string | null
}

export type RankingVariant = 'meta-amt' | 'avatar-amt' | 'rank-amt'

interface Props {
  id: string
  title: string
  sub: string
  variant: RankingVariant
  searchPlaceholder: string
  emptyNoun: string
  groupBy: V2GroupBy
  // Fetches this card's rows for one period. Must be referentially stable
  // (wrap it in useCallback) — it is an effect dependency.
  load?: (range: PeriodRange) => Promise<RankingRow[]>
  // Set instead of `load` when no endpoint can serve this card. Nothing is
  // fetched and the unavailable panel renders in place of the rows.
  unavailable?: { message: string; endpointHint: string }
  footer?: ReactNode
  headMarginClass?: string
}

// Deterministic avatar tint from the agent's name — presentation only, so
// the same agent keeps the same colour between renders and reloads. The
// prototype carried a hand-picked colour per mock agent; real agents come
// from the book, so there is no list to pick from.
const AVATAR_COLORS = ['#2563eb', '#7c3aed', '#0891b2', '#16a34a', '#d97706', '#db2777', '#475569', '#0d9488']

function avatarColor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

function avatarInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// Generic ranking card — Top Items / Top Area / Top Agents / Top Location.
// `variant` controls row layout:
//   'meta-amt'   — rank badge, name + meta line, amount right (Top Items)
//   'avatar-amt' — tinted avatar, name, amount right (Top Agents)
//   'rank-amt'   — rank badge, name, amount right (Top Area / Top Location)
export default function RankingCard({
  id,
  title,
  sub,
  variant,
  searchPlaceholder,
  emptyNoun,
  groupBy,
  load,
  unavailable,
  footer,
  headMarginClass = 'mb-3.5',
}: Props) {
  const { prefs } = usePreferences()
  const swipe = usePeriodSwipe(groupBy)
  const [topN, setTopN] = useState(5)
  const [query, setQuery] = useState('')
  const [rows, setRows] = useState<RankingRow[]>([])
  const [loading, setLoading] = useState(Boolean(load))
  const [error, setError] = useState<string | null>(null)

  // Preferences: lock to Top 5 when dynamic Top N is off; clear search when hidden.
  useEffect(() => {
    if (!prefs.dynamicTopN) setTopN(5)
  }, [prefs.dynamicTopN])

  useEffect(() => {
    if (!prefs.showSearch) setQuery('')
  }, [prefs.showSearch])

  // One fetch per (card, grouping, period). Each card pages independently —
  // that is the prototype's model, where every ranking card carries its own
  // PeriodNav — so each one requests its own date range rather than sharing
  // a page-level filter.
  const requestId = useRef(0)
  const offset = swipe.offset

  useEffect(() => {
    if (!load) return
    const id = ++requestId.current
    setLoading(true)
    setError(null)
    load(periodRange(groupBy, offset))
      .then((result) => {
        // Ignore a slow earlier period's response landing after a newer one.
        if (id !== requestId.current) return
        setRows(result)
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (id !== requestId.current) return
        setError(err instanceof Error ? err.message : 'Could not load this card')
        setRows([])
        setLoading(false)
      })
  }, [load, groupBy, offset])

  const q = query.trim().toLowerCase()
  const isSearching = q.length > 0
  const ranked = rows.map((row, idx) => ({ ...row, rank: idx + 1 }))
  const matches = isSearching
    ? ranked.filter((r) => `${r.name} ${r.meta ?? ''}`.toLowerCase().includes(q))
    : ranked
  const visibleRows = isSearching ? matches : matches.slice(0, topN)

  return (
    <div
      ref={swipe.cardRef}
      id={id}
      className={
        'swipeable bg-card border border-border rounded-2xl shadow-card px-4 pt-4 pb-3.5 ' +
        (unavailable ? '' : 'cursor-grab')
      }
    >
      <div className={`flex items-center justify-between gap-2.5 flex-wrap ${headMarginClass}`}>
        <div>
          <h2 className="text-[14.5px] font-bold m-0 mb-0.5">{title}</h2>
          <p className="m-0 text-xs text-sand">{sub}</p>
        </div>
        {!unavailable && prefs.dynamicTopN && (
          <TopNToggle value={topN} onChange={setTopN} label={`Select Top N ${emptyNoun}`} />
        )}
      </div>

      {unavailable ? (
        <UnavailableNote message={unavailable.message} endpointHint={unavailable.endpointHint} />
      ) : (
        <>
          {prefs.showSearch && (
            <CardSearch value={query} onChange={setQuery} placeholder={searchPlaceholder} />
          )}

          <PeriodNav swipe={swipe} />

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div className="py-6 px-3 text-center text-[12px] text-red">{error}</div>
          ) : (
            <>
              <div className="flex flex-col">
                {visibleRows.map((row, idx) => (
                  <Row key={row.key} row={row} variant={variant} isLast={idx === visibleRows.length - 1} />
                ))}
              </div>

              {visibleRows.length === 0 && (
                <div className="py-6 px-3 text-center text-sand text-[12.5px]">
                  <div className="font-medium">
                    {isSearching
                      ? `No ${emptyNoun} found matching "${query.trim()}"`
                      : `No ${emptyNoun} recorded for ${swipe.periodText}`}
                  </div>
                </div>
              )}
            </>
          )}

          {footer}
        </>
      )}
    </div>
  )
}

function Row({ row, variant, isLast }: { row: RankingRow & { rank: number }; variant: RankingVariant; isLast: boolean }) {
  const borderClass = isLast ? '' : 'border-b border-border'
  const amount = fmtMoney(row.amount, row.currency)

  if (variant === 'avatar-amt') {
    return (
      <div className={`flex items-center justify-between gap-2.5 py-2.5 text-[13px] ${borderClass}`}>
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-[30px] h-[30px] rounded-full flex items-center justify-center text-[11.5px] font-bold text-white shrink-0"
            style={{ background: avatarColor(row.name) }}
          >
            {avatarInitials(row.name)}
          </div>
          <div className="font-semibold truncate">{row.name}</div>
        </div>
        <div className="font-bold text-[13px] shrink-0 tabular-nums">{amount}</div>
      </div>
    )
  }

  if (variant === 'rank-amt') {
    return (
      <div className={`flex items-center justify-between gap-2.5 py-[9px] text-[13px] ${borderClass}`}>
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-6 h-6 rounded-md bg-paper border border-border flex items-center justify-center text-[11px] font-bold text-sand shrink-0">
            {row.rank}
          </div>
          <span className="font-semibold truncate">{row.name}</span>
        </div>
        <div className="font-bold shrink-0 tabular-nums">{amount}</div>
      </div>
    )
  }

  return (
    <div className={`flex items-center gap-2.5 py-2.5 ${borderClass}`}>
      <div className="w-6 h-6 rounded-md bg-paper border border-border flex items-center justify-center text-[11px] font-bold text-sand shrink-0">
        {row.rank}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold mb-0.5 truncate">{row.name}</div>
        {row.meta && <div className="text-[11px] text-sand">{row.meta}</div>}
      </div>
      <div className="shrink-0 text-right">
        <div className="text-[13px] font-bold tabular-nums">{amount}</div>
      </div>
    </div>
  )
}
