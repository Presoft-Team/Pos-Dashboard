'use client'

import { usePreferences, type V2PreferenceKey } from './preferences'

interface ToggleProps {
  id: string
  label: string
  sub: string
  checked: boolean
  onChange: (value: boolean) => void
}

function PrefToggle({ id, label, sub, checked, onChange }: ToggleProps) {
  return (
    <label
      htmlFor={id}
      className="relative flex items-center justify-between gap-4 px-4 py-3.5 border border-border rounded-xl bg-paper cursor-pointer select-none hover:bg-white hover:border-slate-300"
    >
      <div className="flex-1">
        <span className="block text-[13.5px] font-bold text-ink mb-0.5">{label}</span>
        <span className="block text-[11.5px] text-sand leading-snug">{sub}</span>
      </div>
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="pref-checkbox absolute opacity-0 pointer-events-none"
      />
      <span className="pref-switch" aria-hidden="true"></span>
    </label>
  )
}

const PREFS: { key: V2PreferenceKey; id: string; label: string; sub: string }[] = [
  {
    key: 'dynamicTopN',
    id: 'prefDynamicTopN',
    label: 'Show dynamic top N',
    sub: 'Check to show the 5, 10, 15, 20 selector pills. Uncheck to fix display to Top 5.',
  },
  {
    key: 'showSearch',
    id: 'prefShowSearch',
    label: 'Show searchbar',
    sub: 'Check to display search bar on ranking cards. Uncheck to hide search bars.',
  },
  {
    key: 'dynamicGrouping',
    id: 'prefDynamicGrouping',
    label: 'Show dynamic item grouping',
    sub: 'Check to show the dimension selector (Item / Group / Type / Brand / Category / Class) at the bottom of Top Items.',
  },
]

interface Props {
  open: boolean
  onClose: () => void
  onBack: () => void
}

export default function SettingsOverlay({ open, onClose, onBack }: Props) {
  const { prefs, setPref } = usePreferences()

  // Unmounted rather than hidden when closed. The prototype toggled a
  // `hidden`/`flex` class pair, which is a coin flip: both are display
  // utilities of equal specificity, so which one wins depends on the order
  // Tailwind happens to emit them in. A `hidden` attribute alone loses too
  // — the UA's [hidden] rule can't beat an author `.flex`.
  if (!open) return null

  return (
    <div
      role="dialog"
      aria-labelledby="settingsTitle"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      className="fixed inset-0 bg-slate-900/45 backdrop-blur-[5px] z-[110] flex items-center justify-center p-4"
    >
      <div className="w-full max-w-[520px] max-h-[88vh] bg-card rounded-[18px] border border-border shadow-[0_20px_45px_rgba(15,23,42,0.2)] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4.5 py-3.5 border-b border-border bg-paper">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to menu"
            className="inline-flex items-center gap-1.5 border border-border bg-card px-2.5 py-1.5 rounded-lg text-xs font-semibold text-ink hover:bg-white hover:border-slate-300 hover:text-blue"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
            <span>Back</span>
          </button>
          <h2 id="settingsTitle" className="text-[15px] font-bold m-0">Settings</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="w-[30px] h-[30px] rounded-lg border-none bg-transparent text-sand text-xl leading-none flex items-center justify-center hover:bg-paper hover:text-ink"
          >
            &times;
          </button>
        </div>

        <div className="p-5 overflow-y-auto">
          <div className="mb-4.5">
            <div className="inline-block bg-blue-bg text-blue text-[10.5px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wide mb-1.5">
              Preferences
            </div>
            <h3 className="text-base font-bold m-0 mb-1">Dashboard Preferences</h3>
            <p className="text-xs text-sand m-0 leading-snug">
              Customize interactive components, rankings, and filtering options. Saved in this browser only.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {PREFS.map((p) => (
              <PrefToggle
                key={p.key}
                id={p.id}
                label={p.label}
                sub={p.sub}
                checked={prefs[p.key]}
                onChange={(v) => setPref(p.key, v)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
