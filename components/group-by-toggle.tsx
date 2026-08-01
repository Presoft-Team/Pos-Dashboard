'use client'

import { GroupByMode } from '@/types'

const OPTIONS: { value: GroupByMode; label: string }[] = [
  { value: 'item', label: 'Item' },
  { value: 'group', label: 'Group' },
  { value: 'type', label: 'Type' },
]

// Individual Item / Item Group / Item Type toggle — shared by the Sales
// Dashboard "Revenue by Item" chart+table and the Performance page's Item
// dimension. See PLAN.md Sections 4 and 6.
export default function GroupByToggle({ value, onChange }: { value: GroupByMode; onChange: (v: GroupByMode) => void }) {
  return (
    <div className="inline-flex bg-gray-100 rounded-lg p-1">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
            value === opt.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
