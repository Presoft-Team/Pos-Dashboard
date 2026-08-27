import { KpiSummary } from '@/types'
import { formatMoneyLines } from '@/lib/currency'
import { ShoppingCart, Wallet } from 'lucide-react'
import KpiCard from '@/components/kpi-card'

// Totals only, no cash/credit split (same call as the Sales Dashboard's KPI
// row). Total Revenue is included in its own mint color (matching the Sales
// Dashboard's Total Revenue tile) so it reads visually as "the comparison
// figure from the other domain," not a second purchase metric.
export default function PurchaseKpiCards({ data }: { data: KpiSummary[] }) {
  const totalPurchase = formatMoneyLines(
    [...data].sort((a, b) => b.total_purchase - a.total_purchase).map((d) => ({ currency: d.currency, amount: d.total_purchase }))
  )
  const totalRevenue = formatMoneyLines(
    [...data].sort((a, b) => b.total_revenue - a.total_revenue).map((d) => ({ currency: d.currency, amount: d.total_revenue }))
  )

  return (
    <div className="grid grid-cols-2 gap-4">
      <KpiCard label="Total Purchase" value={totalPurchase} icon={ShoppingCart} color="bg-gray-200/60 text-gray-600" />
      <KpiCard label="Total Revenue" value={totalRevenue} sub="For comparison" icon={Wallet} color="bg-mint/10 text-mint" />
    </div>
  )
}
