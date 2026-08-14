import { KpiSummary } from '@/types'
import { formatMoneyLines } from '@/lib/currency'
import { Wallet, Banknote, CreditCard, ShoppingCart } from 'lucide-react'
import KpiCard from '@/components/kpi-card'

// Total Revenue = Cash + Credit combined, no paid/unpaid distinction.
export default function KpiCards({ data }: { data: KpiSummary[] }) {
  const total = formatMoneyLines(
    [...data].sort((a, b) => b.total_revenue - a.total_revenue).map((d) => ({ currency: d.currency, amount: d.total_revenue }))
  )
  const cash = formatMoneyLines(
    [...data].sort((a, b) => b.cash_revenue - a.cash_revenue).map((d) => ({ currency: d.currency, amount: d.cash_revenue }))
  )
  const credit = formatMoneyLines(
    [...data].sort((a, b) => b.credit_revenue - a.credit_revenue).map((d) => ({ currency: d.currency, amount: d.credit_revenue }))
  )
  const purchase = formatMoneyLines(
    [...data].sort((a, b) => b.total_purchase - a.total_purchase).map((d) => ({ currency: d.currency, amount: d.total_purchase }))
  )

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard label="Total Revenue" value={total} sub="Cash + Credit" icon={Wallet} color="bg-mint/10 text-mint" />
      <KpiCard label="Revenue Cash" value={cash} icon={Banknote} color="bg-brand/10 text-brand" />
      <KpiCard label="Revenue Credit" value={credit} icon={CreditCard} color="bg-sand/20 text-ink" />
      <KpiCard label="Purchase" value={purchase} sub="Total purchase amount" icon={ShoppingCart} color="bg-gray-200/60 text-gray-600" />
    </div>
  )
}
