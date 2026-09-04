import { KpiSummary } from '@/types'
import { formatMoneyLines } from '@/lib/currency'
import { Wallet, ReceiptText } from 'lucide-react'
import KpiCard from '@/components/kpi-card'

// Two tiles: what was earned, and how much of it came back as credit notes.
// Credit notes are already netted off inside total_revenue — the tile shows
// the magnitude so it can be read at a glance, not so it can be subtracted
// again.
export default function KpiCards({ data }: { data: KpiSummary[] }) {
  const total = formatMoneyLines(
    [...data].sort((a, b) => b.total_revenue - a.total_revenue).map((d) => ({ currency: d.currency, amount: d.total_revenue }))
  )
  const creditNotes = formatMoneyLines(
    [...data].sort((a, b) => b.credit_note_total - a.credit_note_total).map((d) => ({ currency: d.currency, amount: d.credit_note_total }))
  )

  return (
    <div className="grid grid-cols-2 gap-4">
      <KpiCard label="Total Revenue" value={total} sub="AR invoices + debit notes, net of credit notes and refunds" icon={Wallet} color="bg-mint/10 text-mint" />
      <KpiCard label="Credit Notes" value={creditNotes} sub="Already deducted above" icon={ReceiptText} color="bg-sand/20 text-ink" />
    </div>
  )
}
