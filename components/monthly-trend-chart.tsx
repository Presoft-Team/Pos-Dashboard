'use client'

import { useEffect, useRef, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { formatMoney, MonthlyTrendPivotRow } from '@/lib/currency'
import { chooseRows, StaggeredTick, formatK } from '@/components/chart-axis-tick'

const SALES_COLOR = '#F97316'   // Orange for Sales
const PURCHASE_COLOR = '#111827' // Black for Purchase

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label, series }: any) {
  if (!active || !payload?.length) return null
  const row: MonthlyTrendPivotRow | undefined = payload[0]?.payload
  if (!row) return null
  // The tooltip lists only the lines actually drawn — naming a series the
  // reader can't see on the chart is just noise.
  const showSales = series !== 'purchase'
  const showPurchase = series !== 'sales'
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm space-y-2">
      <p className="font-semibold text-gray-900">{label}</p>
      {/* A month with no rows at all (a gap the pivot zero-filled) has an
          empty breakdown — show the zeroed totals rather than nothing. */}
      {row.breakdown.length === 0 ? (
        <>
          {showSales && <p style={{ color: SALES_COLOR }}>Sales {formatMoney(0, null)}</p>}
          {showPurchase && <p style={{ color: PURCHASE_COLOR }}>Purchase {formatMoney(0, null)}</p>}
        </>
      ) : (
        row.breakdown.map((b) => (
          <div key={b.currency} className="space-y-0.5">
            <p className="text-xs font-semibold text-gray-500">{b.currency}</p>
            {showSales && <p style={{ color: SALES_COLOR }}>Sales {formatMoney(b.revenue, b.currency)}</p>}
            {showPurchase && <p style={{ color: PURCHASE_COLOR }}>Purchase {formatMoney(b.purchase, b.currency)}</p>}
          </div>
        ))
      )}
    </div>
  )
}

// Which line(s) to draw. 'both' overlays them on one axis for comparison;
// the single-series variants let Sales and Purchase sit in their own
// sections, each readable on its own scale.
export type TrendSeries = 'sales' | 'purchase' | 'both'

interface Props {
  data: MonthlyTrendPivotRow[]
  series?: TrendSeries
}

// Two lines over time — sales and purchase spend, so the two can be read
// against each other month by month. Values are cross-currency magnitudes;
// hover/tap a point for the real per-currency breakdown of both.
export default function MonthlyTrendChart({ data, series = 'both' }: Props) {
  const showSales = series !== 'purchase'
  const showPurchase = series !== 'sales'
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => setWidth(entries[0].contentRect.width))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const names = data.map((d) => d.name)
  const rows = chooseRows(names, width)
  const slotWidth = width && data.length ? (width / data.length) * rows * 0.9 : 0

  return (
    <div ref={containerRef}>
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={data} margin={{ top: 4, right: 16, left: 8, bottom: 4 + (rows - 1) * 14 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis
            dataKey="name"
            interval={0}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            tick={(props: any) => <StaggeredTick {...props} rows={rows} slotWidth={slotWidth} />}
            axisLine={false}
            tickLine={false}
          />
          <YAxis tickFormatter={formatK} tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={52} />
          <Tooltip content={<CustomTooltip series={series} />} />
          {/* A legend only earns its space when there are two lines to tell
              apart — a single-series chart is already named by its heading. */}
          {series === 'both' && (
            <Legend verticalAlign="top" height={28} iconType="plainline" wrapperStyle={{ fontSize: 12 }} />
          )}
          {showSales && (
            <Line type="monotone" dataKey="total" name="Sales" stroke={SALES_COLOR} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
          )}
          {showPurchase && (
            <Line type="monotone" dataKey="totalPurchase" name="Purchase" stroke={PURCHASE_COLOR} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
