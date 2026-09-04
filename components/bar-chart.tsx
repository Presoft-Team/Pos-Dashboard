'use client'

import { useEffect, useRef, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { formatMoney, CHART_PALETTE, CurrencyPivotRow } from '@/lib/currency'
import { chooseRows, StaggeredTick, fmtInt, formatK } from '@/components/chart-axis-tick'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, showQty }: any) {
  if (!active || !payload?.length) return null
  const row: CurrencyPivotRow | undefined = payload[0]?.payload
  if (!row) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-900 mb-1">{row.name}</p>
      {row.breakdown.map((b, i) => (
        <p key={b.currency} style={{ color: CHART_PALETTE[i % CHART_PALETTE.length] }}>
          {b.currency}: {formatMoney(b.revenue, b.currency)}
          {showQty && ` · Qty ${fmtInt(b.qty)}`}
        </p>
      ))}
    </div>
  )
}

interface Props {
  data: CurrencyPivotRow[]
  color?: string
  // Only the Item charts have real quantities. Sales Agent, Debtor and
  // Creditor are summed from AR/AP document headers, which carry no Qty
  // column at all — their pivot rows are zero because there is nothing to
  // count, not because nothing was sold, so the tooltip omits Qty rather
  // than printing a fabricated "Qty 0".
  showQty?: boolean
}

// One bar per entity — its height is a cross-currency sum (a magnitude only,
// never a real total). Hover/tap the bar to see each currency's actual
// revenue (and, where the dimension has one, quantity) broken out
// separately in the tooltip.
export default function BarChartWidget({ data, color = '#F2AA24', showQty = false }: Props) {
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
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 4, right: 16, left: 8, bottom: 4 + (rows - 1) * 14 }}>
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
          <Tooltip content={<CustomTooltip showQty={showQty} />} cursor={{ fill: '#f8fafc' }} />
          <Bar dataKey="total" fill={color} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
