'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/db/client'
import { DocumentRow, MonthlyRow } from '@/types'
import { DEFAULT_CURRENCY } from '@/lib/currency'
import { fmtQty } from '@/lib/v2/format'
import {
  buildDailyBars,
  buildMonthlyBars,
  chartRange,
  GROUPBY_CONFIG,
  sumByDate,
  type ChartBar,
  type PeriodRange,
  type V2GroupBy,
} from '@/lib/v2/periods'
import Header from './header'
import TodayYesterdayBox from './today-yesterday-box'
import SalesChart from './sales-chart'
import RankingCard, { type RankingRow } from './ranking-card'
import DimensionToggle, { ITEM_DIMENSIONS, type V2ItemDimension } from './dimension-toggle'
import SideDrawer from './side-drawer'
import SettingsOverlay from './settings-overlay'
import { usePreferences } from './preferences'

// The factory is stateless (lib/db/client.ts just wraps fetch), so one
// module-level instance keeps the load callbacks below referentially
// stable — RankingCard takes `load` as an effect dependency.
const db = createClient()

// Enough rows to cover Top 20 and still give the in-card search something
// to search through, without pulling an entire book over the wire.
const RANKING_LIMIT = 50

// get_sales_by_v2's row shape (see app/api/presoft/[name]/route.ts).
interface SalesByRow {
  name: string
  code: string
  currency: string
  revenue: number
  // Item dimensions only — document-level buckets (agent/area/location)
  // come from headers, which carry no quantity, so this is 0 there.
  qty: number
}

interface AgentRow {
  name: string
  code: string
  currency: string
  revenue: number
}

async function rpc<T>(name: string, params: Record<string, unknown>): Promise<T[]> {
  const { data, error } = await db.rpc<T[]>(name, params)
  if (error) throw new Error(error.message)
  return data ?? []
}

interface Props {
  clientName?: string | null
}

export default function V2Dashboard({ clientName }: Props) {
  const { prefs } = usePreferences()
  const [groupBy, setGroupBy] = useState<V2GroupBy>('month')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [dimension, setDimension] = useState<V2ItemDimension>('item')

  const [monthly, setMonthly] = useState<MonthlyRow[]>([])
  const [byDate, setByDate] = useState<Map<string, number>>(() => new Map())
  const [chartCurrency, setChartCurrency] = useState<string | null>(null)
  const [chartLoading, setChartLoading] = useState(true)
  const [chartError, setChartError] = useState<string | null>(null)

  const cfg = GROUPBY_CONFIG[groupBy]
  const source = cfg.source

  // --- Chart -----------------------------------------------------------
  // Month / Year read get_monthly_trend_v2 (one row per month, already
  // aggregated server-side). Date / Week read get_recent_sales_v2 — the
  // individual sales documents — and sum them by DocDate here, because the
  // service has no daily report. Both come off the same `docs` CTE, so the
  // two agree: the days of a month add up to that month's bar.
  useEffect(() => {
    let cancelled = false
    const range = chartRange(groupBy)
    setChartLoading(true)
    setChartError(null)

    const request =
      source === 'monthly'
        ? rpc<MonthlyRow>('get_monthly_trend_v2', {
            p_date_from: range.date_from,
            p_date_to: range.date_to,
          }).then((rows) => {
            if (cancelled) return
            setMonthly(rows)
            setChartCurrency(rows[0]?.currency ?? null)
          })
        : rpc<DocumentRow>('get_recent_sales_v2', {
            p_date_from: range.date_from,
            p_date_to: range.date_to,
            // NO LIMIT — lib/db/client.ts maps null onto the NO_LIMIT
            // sentinel, which app/api/presoft/[name]/route.ts drops instead
            // of forwarding, so the service adds no TOP. Capping here would
            // truncate a 30-day window on any busy book, and since the
            // service orders documents newest-first the rows lost would be
            // the oldest — the chart's left-hand bars would quietly sag
            // toward zero instead of erroring.
            p_limit: null,
          }).then((docs) => {
            if (cancelled) return
            setByDate(sumByDate(docs))
            setChartCurrency(docs[0]?.currency ?? null)
          })

    request
      .then(() => { if (!cancelled) setChartLoading(false) })
      .catch((err: unknown) => {
        if (cancelled) return
        setChartError(err instanceof Error ? err.message : 'Could not load the sales trend')
        setMonthly([])
        setByDate(new Map())
        setChartLoading(false)
      })

    return () => { cancelled = true }
  }, [groupBy, source])

  const bars: ChartBar[] = useMemo(
    () =>
      source === 'monthly'
        ? buildMonthlyBars(groupBy as 'month' | 'year', monthly)
        : buildDailyBars(groupBy as 'day' | 'week', byDate),
    [source, groupBy, monthly, byDate]
  )
  // Every aggregate is reported in the account book's own currency, so the
  // first row's label applies to all of them.
  const currency = chartCurrency ?? DEFAULT_CURRENCY

  // --- Ranking card loaders -------------------------------------------
  const loadItems = useCallback(async (range: PeriodRange): Promise<RankingRow[]> => {
    const rows = await rpc<SalesByRow>('get_sales_by_v2', {
      p_date_from: range.date_from,
      p_date_to: range.date_to,
      p_sales_by: dimension,
      p_limit: RANKING_LIMIT,
    })
    return rows.map((r, i) => ({
      key: `${i}-${r.code || r.name}`,
      name: r.name,
      amount: r.revenue,
      currency: r.currency,
      // Real quantity off the stock lines — only the item dimensions have
      // one, hence the guard rather than an unconditional label.
      meta: r.qty ? `${fmtQty(r.qty)} units sold` : null,
    }))
  }, [dimension])

  const loadAgents = useCallback(async (range: PeriodRange): Promise<RankingRow[]> => {
    const rows = await rpc<AgentRow>('get_performance_sales_agent_v2', {
      p_date_from: range.date_from,
      p_date_to: range.date_to,
      p_limit: RANKING_LIMIT,
    })
    return rows.map((r, i) => ({
      key: `${i}-${r.code || r.name}`,
      name: r.name,
      amount: r.revenue,
      currency: r.currency,
    }))
  }, [])

  // Area is a debtor attribute (Debtor.AreaCode -> Area.Description) and
  // Location is line-level, with each document's amount apportioned across
  // its locations — both are real buckets of /api/reports/sales-by, already
  // mapped here as get_sales_by_v2.
  const loadArea = useCallback(async (range: PeriodRange): Promise<RankingRow[]> => {
    const rows = await rpc<SalesByRow>('get_sales_by_v2', {
      p_date_from: range.date_from,
      p_date_to: range.date_to,
      p_sales_by: 'area',
      p_limit: RANKING_LIMIT,
    })
    return rows.map((r, i) => ({ key: `${i}-${r.name}`, name: r.name, amount: r.revenue, currency: r.currency }))
  }, [])

  const loadLocation = useCallback(async (range: PeriodRange): Promise<RankingRow[]> => {
    const rows = await rpc<SalesByRow>('get_sales_by_v2', {
      p_date_from: range.date_from,
      p_date_to: range.date_to,
      p_sales_by: 'location',
      p_limit: RANKING_LIMIT,
    })
    return rows.map((r, i) => ({ key: `${i}-${r.name}`, name: r.name, amount: r.revenue, currency: r.currency }))
  }, [])

  // Reset to the "Item" dimension whenever dynamic grouping is turned off.
  useEffect(() => {
    if (!prefs.dynamicGrouping) setDimension('item')
  }, [prefs.dynamicGrouping])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      if (settingsOpen) setSettingsOpen(false)
      else if (drawerOpen) setDrawerOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [settingsOpen, drawerOpen])

  const itemDim = ITEM_DIMENSIONS.find((d) => d.key === dimension) ?? ITEM_DIMENSIONS[0]

  return (
    <>
      <Header
        subtitle={cfg.sub}
        groupBy={groupBy}
        onGroupByChange={setGroupBy}
        onOpenDrawer={() => setDrawerOpen(true)}
        clientName={clientName}
      />

      <div className="max-w-[640px] lg:max-w-[1180px] mx-auto px-4 pt-3.5 pb-10 flex flex-col gap-3.5">
        {/* Fetches its own two days of documents — see
            components/v2/today-yesterday-box.tsx. */}
        <TodayYesterdayBox />

        <div className="flex flex-col gap-3.5 lg:grid lg:grid-cols-[1.6fr_1fr] lg:gap-3.5 lg:items-start">
          {/* min-w-0: a grid item defaults to min-width:auto, so the chart's
              w-max track would push this column — and the whole page —
              wider than the viewport instead of scrolling inside the card. */}
          <div className="bg-card border border-border rounded-2xl shadow-card px-4 pt-4 pb-3.5 min-w-0">
            <div className="flex items-center justify-between gap-2.5 mb-3.5">
              <div>
                <h2 className="text-[14.5px] font-bold m-0 mb-0.5">{cfg.title}</h2>
                <p className="m-0 text-xs text-sand">{cfg.cardSub}</p>
              </div>
            </div>
            {chartError ? (
              <div className="py-10 text-center text-[12.5px] text-red">{chartError}</div>
            ) : (
              <SalesChart bars={bars} currency={currency} loading={chartLoading} />
            )}
          </div>

          <RankingCard
            id="topItemsCard"
            title={itemDim.title}
            sub={itemDim.sub}
            variant="meta-amt"
            searchPlaceholder="Search items by name..."
            emptyNoun="items"
            groupBy={groupBy}
            load={loadItems}
            footer={prefs.dynamicGrouping && <DimensionToggle value={dimension} onChange={setDimension} />}
          />
        </div>

        <div className="flex flex-col gap-3.5 lg:grid lg:grid-cols-[1.6fr_1fr] lg:gap-3.5 lg:items-start">
          <RankingCard
            id="topAreaCard"
            title="Top Area"
            sub="Ranked by revenue, this period"
            variant="rank-amt"
            searchPlaceholder="Search area by name or number..."
            emptyNoun="areas"
            groupBy={groupBy}
            load={loadArea}
          />

          <div className="flex flex-col gap-3.5">
            <RankingCard
              id="topAgentsCard"
              title="Top Sales Agents"
              sub="By revenue this period"
              variant="avatar-amt"
              searchPlaceholder="Search agents by name..."
              emptyNoun="agents"
              groupBy={groupBy}
              load={loadAgents}
              headMarginClass="mb-2"
            />
            <RankingCard
              id="topLocationCard"
              title="Top Location"
              sub="Ranked by revenue this period"
              variant="rank-amt"
              searchPlaceholder="Search location by name..."
              emptyNoun="locations"
              groupBy={groupBy}
              load={loadLocation}
              headMarginClass="mb-1.5"
            />
          </div>
        </div>

        <footer className="text-center text-[11px] text-sand pt-2 pb-1">
          Live figures from this client&apos;s AutoCount book
        </footer>
      </div>

      <SideDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onOpenSettings={() => { setDrawerOpen(false); setSettingsOpen(true) }}
      />
      <SettingsOverlay
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onBack={() => { setSettingsOpen(false); setDrawerOpen(true) }}
      />
    </>
  )
}
