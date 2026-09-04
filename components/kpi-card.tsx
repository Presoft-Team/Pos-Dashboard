// Single stat tile — shared by KpiCards (Sales page) and
// PurchaseKpiCards (Purchase page). Pulled out once a second page needed
// the identical tile, rather than duplicating the markup.
export interface KpiCardProps {
  label: string
  value: string[]
  sub?: string
  icon: React.ElementType
  color: string
}

export default function KpiCard({ label, value, sub, icon: Icon, color }: KpiCardProps) {
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
