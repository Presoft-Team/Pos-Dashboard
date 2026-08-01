'use client'

import { useEffect, useRef, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { formatMoney, STATUS_COLORS, StatusPivotRow } from '@/lib/currency'
import { chooseRows, StaggeredTick, fmtInt, formatK } from '@/components/chart-axis-tick'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const row: StatusPivotRow | undefined = payload[0]?.payload
  if (!row) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm space-y-2">
      <p className="font-semibold text-gray-900">{row.name}</p>
      {row.breakdown.map((b) => (
        <div key={b.currency}>
          <p className="text-xs font-semibold text-gray-500">{b.currency}</p>
          <p style={{ color: STATUS_COLORS.paid }}>Paid: {formatMoney(b.paid, b.currency)} · Qty {fmtInt(b.qtyPaid)}</p>
          <p style={{ color: STATUS_COLORS.notDue }}>Not due: {formatMoney(b.notDue, b.currency)} · Qty {fmtInt(b.qtyNotDue)}</p>
          <p style={{ color: STATUS_COLORS.overdue }}>Overdue: {formatMoney(b.overdue, b.currency)} · Qty {fmtInt(b.qtyOverdue)}</p>
        </div>
      ))}
    </div>
  )
}

interface Props {
  data: StatusPivotRow[]
}

// One bar per bucket (item/group/type), 3 stacked layers bottom-to-top:
// Paid (brand), Not-due (neutral), Overdue (danger red) — see PLAN.md
// Section 4. Bar height is a cross-currency magnitude; hover/tap for the
// real per-currency revenue + qty breakdown of each layer.
export default function StackedBarChartWidget({ data }: Props) {
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
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
          <Bar dataKey="paid" stackId="revenue" fill={STATUS_COLORS.paid} radius={[0, 0, 0, 0]} />
          <Bar dataKey="notDue" stackId="revenue" fill={STATUS_COLORS.notDue} radius={[0, 0, 0, 0]} />
          <Bar dataKey="overdue" stackId="revenue" fill={STATUS_COLORS.overdue} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
