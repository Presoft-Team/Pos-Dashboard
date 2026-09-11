'use client'

interface Props {
  value: string
  onChange: (value: string) => void
  placeholder: string
}

export default function CardSearch({ value, onChange, placeholder }: Props) {
  return (
    <div className="card-search relative flex items-center bg-paper border border-border rounded-lg px-2.5 mb-2.5 h-[35px] focus-within:bg-white focus-within:border-blue focus-within:shadow-[0_0_0_3px_rgba(37,99,235,0.1)]">
      <svg className="w-3.5 h-3.5 text-sand shrink-0 mr-2" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="9" cy="9" r="6"></circle>
        <path d="M13.5 13.5L18 18"></path>
      </svg>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="flex-1 min-w-0 border-none bg-transparent outline-none text-[12.5px] text-ink placeholder:text-[#9ca3af] placeholder:text-xs"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          title="Clear search"
          aria-label="Clear search"
          className="border-none bg-slate-200 text-slate-600 w-[18px] h-[18px] rounded-full flex items-center justify-center text-xs font-bold cursor-pointer ml-1.5 shrink-0 hover:bg-slate-300 hover:text-ink"
        >
          &times;
        </button>
      )}
    </div>
  )
}
