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
    <div className="flex w-full sm:inline-flex sm:w-auto bg-gray-100 rounded-lg p-1">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`flex-1 sm:flex-none px-2 sm:px-3 py-1 rounded-md text-xs font-medium transition-colors ${
            value === opt.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
