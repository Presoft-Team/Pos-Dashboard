import { KpiSummary } from '@/types'
import { formatMoneyLines } from '@/lib/currency'
import { Wallet, ShoppingCart } from 'lucide-react'
import KpiCard from '@/components/kpi-card'

// Totals only — the API still returns a cash/credit split per currency, but
// the dashboard deliberately doesn't surface it: revenue is revenue however
// it was paid for.
export default function KpiCards({ data }: { data: KpiSummary[] }) {
  const total = formatMoneyLines(
    [...data].sort((a, b) => b.total_revenue - a.total_revenue).map((d) => ({ currency: d.currency, amount: d.total_revenue }))
  )
  const purchase = formatMoneyLines(
    [...data].sort((a, b) => b.total_purchase - a.total_purchase).map((d) => ({ currency: d.currency, amount: d.total_purchase }))
  )

  return (
    <div className="grid grid-cols-2 gap-4">
      <KpiCard label="Total Revenue" value={total} icon={Wallet} color="bg-mint/10 text-mint" />
      <KpiCard label="Purchase" value={purchase} sub="Total purchase amount" icon={ShoppingCart} color="bg-gray-200/60 text-gray-600" />
    </div>
  )
}
