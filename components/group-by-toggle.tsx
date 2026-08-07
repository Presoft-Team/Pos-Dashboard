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
//
// Always fills its container (every usage now sits in a grid/percentage
// layout expecting that) — `sm:inline-flex sm:w-auto` used to keep it at
// intrinsic width on desktop, but `width:auto` on an inline-level box
// sizes to its content, not its container, the same "doesn't fill" quirk
// Combobox's `fullWidth` prop works around for its <input>.
export default function GroupByToggle({ value, onChange }: { value: GroupByMode; onChange: (v: GroupByMode) => void }) {
  return (
    <div className="flex w-full bg-gray-100 rounded-lg p-1">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`flex-1 px-2 sm:px-3 py-1 rounded-md text-xs font-medium transition-colors ${
            value === opt.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
