import { KpiSummary } from '@/types'
import { formatMoneyLines } from '@/lib/currency'
import { Wallet, Banknote, CreditCard, ShoppingCart } from 'lucide-react'

interface CardProps {
  label: string
  value: string[]
  sub?: string
  icon: React.ElementType
  color: string
}

function Card({ label, value, sub, icon: Icon, color }: CardProps) {
  const compact = value.length > 1
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 lg:p-5 overflow-hidden">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
        <div className={`p-2 lg:p-2.5 rounded-xl shrink-0 ${color}`}>
          <Icon size={16} className="lg:hidden" />
          <Icon size={18} className="hidden lg:block" />
        </div>
      </div>
      <div className={`font-bold text-gray-900 mt-1.5 break-words ${compact ? 'text-base leading-tight' : 'text-xl lg:text-2xl'}`}>
        {value.map((line, i) => <p key={i}>{line}</p>)}
      </div>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

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
      <Card label="Total Revenue" value={total} sub="Cash + Credit" icon={Wallet} color="bg-mint/10 text-mint" />
      <Card label="Revenue Cash" value={cash} icon={Banknote} color="bg-brand/10 text-brand" />
      <Card label="Revenue Credit" value={credit} icon={CreditCard} color="bg-sand/20 text-ink" />
      <Card label="Purchase" value={purchase} sub="Total purchase amount" icon={ShoppingCart} color="bg-gray-200/60 text-gray-600" />
    </div>
  )
}
