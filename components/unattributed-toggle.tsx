'use client'

interface Props {
  checked: boolean
  onChange: (checked: boolean) => void
  // "(No Item) / (No Agent)" etc — spelled out so the label names the exact
  // rows it controls rather than making the reader guess.
  label: string
}

// Shows or hides the unattributed buckets across a page's breakdowns.
// Checked by default: with them shown, the breakdown rows add up to the KPI
// total above; unchecking trades that reconciliation for a chart that isn't
// dominated by one bucket.
export default function UnattributedToggle({ checked, onChange, label }: Props) {
  return (
    <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded border-gray-300 text-brand focus:ring-brand"
      />
      Show {label}
    </label>
  )
}
