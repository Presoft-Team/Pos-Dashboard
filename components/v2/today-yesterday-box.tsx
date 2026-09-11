'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/db/client'
import { DocumentRow } from '@/types'
import { DEFAULT_CURRENCY } from '@/lib/currency'
import { fmtMoney } from '@/lib/v2/format'
import { isoDate, sumByDate } from '@/lib/v2/periods'

const db = createClient()

// Today's / Yesterday's sales.
//
// There is no daily *report* on autocount-write-service, but
// GET /api/reports/sales-documents (proxied as get_recent_sales_v2) returns
// one row per document with its DocDate and signed amount, from the same
// `docs` CTE the monthly report sums. Two days of documents summed by date
// is therefore the real figure, not an approximation of one.
//
// Fetched here rather than passed down, so the box is independent of the
// chart's group-by: it means today and yesterday whatever the chart shows.
export default function TodayYesterdayBox() {
  const [totals, setTotals] = useState<{ today: number; yesterday: number } | null>(null)
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    const now = new Date()
    const today = isoDate(now)
    const yesterday = isoDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))

    db.rpc<DocumentRow[]>('get_recent_sales_v2', {
      p_date_from: yesterday,
      p_date_to: today,
      // NO LIMIT. lib/db/client.ts turns null into the NO_LIMIT sentinel,
      // which app/api/presoft/[name]/route.ts drops rather than forwarding,
      // so the service applies no TOP. A limit here would silently truncate
      // a busy day — and because the service orders documents newest-first,
      // it would drop the oldest ones, quietly understating yesterday.
      p_limit: null,
    }).then(({ data, error: err }) => {
      if (cancelled) return
      if (err || !data) {
        setError(true)
        return
      }
      const byDate = sumByDate(data)
      setTotals({ today: byDate.get(today) ?? 0, yesterday: byDate.get(yesterday) ?? 0 })
      if (data[0]?.currency) setCurrency(data[0].currency)
    })

    return () => { cancelled = true }
  }, [])

  return (
    <div className="bg-card border border-border rounded-2xl shadow-card px-4 py-3 flex items-center gap-4">
      <Slot label="Today's Sales" amount={totals?.today} currency={currency} error={error} />
      <div className="w-px h-9 bg-border shrink-0" aria-hidden="true"></div>
      <Slot label="Yesterday's Sales" amount={totals?.yesterday} currency={currency} error={error} />
    </div>
  )
}

function Slot({
  label,
  amount,
  currency,
  error,
}: {
  label: string
  amount: number | undefined
  currency: string
  error: boolean
}) {
  return (
    <div className="flex-1 min-w-0">
      <div className="text-xs font-semibold text-sand mb-0.5">{label}</div>
      {error ? (
        <div className="text-sm font-semibold text-sand leading-tight py-1">Couldn&apos;t load</div>
      ) : amount == null ? (
        <div className="h-7 w-28 max-w-full rounded bg-paper animate-pulse" aria-hidden="true" />
      ) : (
        <div className="text-xl font-bold text-ink tracking-tight leading-tight tabular-nums">
          {fmtMoney(amount, currency)}
        </div>
      )}
    </div>
  )
}
