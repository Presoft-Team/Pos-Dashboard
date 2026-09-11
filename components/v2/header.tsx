'use client'

import { GROUPBY_CONFIG, type V2GroupBy } from '@/lib/v2/periods'

interface Props {
  subtitle: string
  groupBy: V2GroupBy
  onGroupByChange: (value: V2GroupBy) => void
  onOpenDrawer: () => void
  clientName?: string | null
}

// All four of the prototype's groupings. Month and Year come off the
// monthly report; Date and Week are summed from sales documents, which
// carry their own DocDate (see lib/v2/periods.ts).
const GROUP_BY_OPTIONS: { value: V2GroupBy; label: string }[] = [
  { value: 'day', label: 'By Date' },
  { value: 'week', label: 'By Week' },
  { value: 'month', label: 'By Month' },
  { value: 'year', label: 'By Year' },
]

export default function Header({ subtitle, groupBy, onGroupByChange, onOpenDrawer, clientName }: Props) {
  return (
    <header className="sticky top-0 z-10 bg-paper/90 backdrop-blur-xs px-4 pt-3.5 pb-2.5 flex items-center justify-between border-b border-border gap-2">
      <div className="flex items-center gap-2.5 min-w-0">
        <button
          type="button"
          onClick={onOpenDrawer}
          aria-label="Open navigation menu"
          title="Menu"
          className="w-8 h-8 rounded-lg border border-border bg-card text-ink flex items-center justify-center shadow-card shrink-0 transition-all hover:bg-white hover:border-slate-300 hover:text-blue active:scale-95"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" aria-hidden="true">
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>
        {/* The prototype's compact gradient badge, kept as-is: the full
            Presoft lockup is far too wide for a 32px-tall app bar and
            squeezed the title out of shape. */}
        <div className="w-8 h-8 rounded-[9px] bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center text-white font-bold text-sm shadow-card shrink-0">
          P
        </div>
        <div className="min-w-0">
          <h1 className="text-[15.5px] font-bold m-0 tracking-tight truncate">
            {clientName || 'Sales Dashboard'}
          </h1>
          <p className="m-0 text-[11px] text-sand truncate">{subtitle}</p>
        </div>
      </div>

      <select
        value={groupBy}
        onChange={(e) => onGroupByChange(e.target.value as V2GroupBy)}
        aria-label="Group by"
        title={`Group by · ${GROUPBY_CONFIG[groupBy].periodName}`}
        className="h-[34px] pl-[11px] pr-7 rounded-[9px] border border-border bg-card font-sans text-[13px] font-semibold text-ink shadow-card cursor-pointer appearance-none shrink-0"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23475569' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\")",
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 9px center',
        }}
      >
        {GROUP_BY_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </header>
  )
}
