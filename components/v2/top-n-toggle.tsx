'use client'

const OPTIONS = [5, 10, 15, 20] as const

interface Props {
  value: number
  onChange: (value: number) => void
  label: string
}

export default function TopNToggle({ value, onChange, label }: Props) {
  return (
    <div
      className="top-n-toggle inline-flex items-center bg-[#f1f3f6] border border-border rounded-lg p-0.5 gap-0.5 select-none shrink-0"
      aria-label={label}
    >
      {OPTIONS.map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={
            'h-6 px-2 rounded-md text-[11px] font-bold leading-none transition-colors ' +
            (n === value
              ? 'bg-white text-blue shadow-[0_1px_3px_rgba(20,24,31,0.1)]'
              : 'text-sand hover:text-ink hover:bg-white/70')
          }
        >
          {n}
        </button>
      ))}
    </div>
  )
}
