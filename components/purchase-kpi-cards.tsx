import { KpiSummary } from '@/types'
import { formatMoneyLines } from '@/lib/currency'
import { ShoppingCart, CreditCard, Banknote, Wallet } from 'lucide-react'
import KpiCard from '@/components/kpi-card'

// Total Purchase = Cash + Credit combined. Total Revenue is included last,
// in its own mint color (matching the Sales Dashboard's Total Revenue tile)
// so it reads visually as "the comparison figure from the other domain,"
// not a 5th purchase metric.
export default function PurchaseKpiCards({ data }: { data: KpiSummary[] }) {
  const totalPurchase = formatMoneyLines(
    [...data].sort((a, b) => b.total_purchase - a.total_purchase).map((d) => ({ currency: d.currency, amount: d.total_purchase }))
  )
  const creditPurchase = formatMoneyLines(
    [...data].sort((a, b) => b.credit_purchase - a.credit_purchase).map((d) => ({ currency: d.currency, amount: d.credit_purchase }))
  )
  const cashPurchase = formatMoneyLines(
    [...data].sort((a, b) => b.cash_purchase - a.cash_purchase).map((d) => ({ currency: d.currency, amount: d.cash_purchase }))
  )
  const totalRevenue = formatMoneyLines(
    [...data].sort((a, b) => b.total_revenue - a.total_revenue).map((d) => ({ currency: d.currency, amount: d.total_revenue }))
  )

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard label="Total Purchase" value={totalPurchase} sub="Cash + Credit" icon={ShoppingCart} color="bg-gray-200/60 text-gray-600" />
      <KpiCard label="Credit Purchase" value={creditPurchase} icon={CreditCard} color="bg-sand/20 text-ink" />
      <KpiCard label="Cash Purchase" value={cashPurchase} icon={Banknote} color="bg-brand/10 text-brand" />
      <KpiCard label="Total Revenue" value={totalRevenue} sub="For comparison" icon={Wallet} color="bg-mint/10 text-mint" />
    </div>
  )
}
