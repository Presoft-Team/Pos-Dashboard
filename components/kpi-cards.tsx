import { KpiSummary } from '@/types'
import { formatMoneyLines } from '@/lib/currency'
import { Wallet, TrendingUp, Clock, AlertTriangle, Receipt, Coins } from 'lucide-react'

function fmtInt(n: number) {
  return new Intl.NumberFormat('en-MY').format(Math.round(n))
}

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

// Revenue: 3 buckets (Paid, Not-due, Overdue), each per-currency.
// Transactions: 2 buckets (Cash, Credit), summed across currency since
// unit counts aren't currency-denominated. See PLAN.md Section 4.
export default function KpiCards({ data }: { data: KpiSummary[] }) {
  // Paid (cash + credit-paid) + not-yet-due credit — everything except
  // overdue, i.e. revenue that's either in hand or still expected on time.
  const total = formatMoneyLines(
    [...data]
      .map((d) => ({ currency: d.currency, amount: d.revenue_paid + d.revenue_not_due }))
      .sort((a, b) => b.amount - a.amount)
  )
  const paid = formatMoneyLines(
    [...data].sort((a, b) => b.revenue_paid - a.revenue_paid).map((d) => ({ currency: d.currency, amount: d.revenue_paid }))
  )
  const notDue = formatMoneyLines(
    [...data].sort((a, b) => b.revenue_not_due - a.revenue_not_due).map((d) => ({ currency: d.currency, amount: d.revenue_not_due }))
  )
  const overdue = formatMoneyLines(
    [...data].sort((a, b) => b.revenue_overdue - a.revenue_overdue).map((d) => ({ currency: d.currency, amount: d.revenue_overdue }))
  )
  const cost = formatMoneyLines(
    [...data].sort((a, b) => b.total_cost - a.total_cost).map((d) => ({ currency: d.currency, amount: d.total_cost }))
  )

  const cashTx = data.reduce((sum, d) => sum + d.cash_transactions, 0)
  const creditTx = data.reduce((sum, d) => sum + d.credit_transactions, 0)

  return (
    <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
      <Card label="Total Revenue" value={total} sub="Paid + not yet due" icon={Wallet} color="bg-mint/10 text-mint" />
      <Card label="Revenue" value={paid} sub="Cash + Credit paid" icon={TrendingUp} color="bg-brand/10 text-brand" />
      <Card label="Outstanding" value={notDue} sub="Credit, not yet due" icon={Clock} color="bg-gray-200/60 text-gray-600" />
      <Card label="Overdue" value={overdue} sub="Credit, past due date" icon={AlertTriangle} color="bg-danger/10 text-danger" />
      <Card label="Cost" value={cost} sub="Qty sold × item cost" icon={Coins} color="bg-sand/20 text-ink" />
      <Card
        label="Transactions"
        value={[`Cash ${fmtInt(cashTx)}`, `Credit ${fmtInt(creditTx)}`]}
        icon={Receipt}
        color="bg-sand/20 text-ink"
      />
    </div>
  )
}
