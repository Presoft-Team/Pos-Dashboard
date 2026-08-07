'use client'

import { useEffect, useRef, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { formatMoney, CASH_CREDIT_COLORS, CashCreditPivotRow } from '@/lib/currency'
import { chooseRows, StaggeredTick, formatK } from '@/components/chart-axis-tick'

const TOTAL_COLOR = '#111827'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const row: CashCreditPivotRow | undefined = payload[0]?.payload
  if (!row) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm space-y-2">
      <p className="font-semibold text-gray-900">{label}</p>
      {row.breakdown.map((b) => (
        <div key={b.currency}>
          <p className="text-xs font-semibold text-gray-500">{b.currency}</p>
          <p style={{ color: TOTAL_COLOR }}>Total: {formatMoney(b.cash + b.credit, b.currency)}</p>
          <p style={{ color: CASH_CREDIT_COLORS.cash }}>Cash: {formatMoney(b.cash, b.currency)}</p>
          <p style={{ color: CASH_CREDIT_COLORS.credit }}>Credit: {formatMoney(b.credit, b.currency)}</p>
        </div>
      ))}
    </div>
  )
}

interface Props {
  data: CashCreditPivotRow[]
}

// 3 lines over time — Total, Cash, Credit. Values are cross-currency
// magnitudes; hover/tap a point for the real per-currency breakdown.
export default function MonthlyTrendChart({ data }: Props) {
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
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey="total" name="Total" stroke={TOTAL_COLOR} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
          <Line type="monotone" dataKey="cash" name="Cash" stroke={CASH_CREDIT_COLORS.cash} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
          <Line type="monotone" dataKey="credit" name="Credit" stroke={CASH_CREDIT_COLORS.credit} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
