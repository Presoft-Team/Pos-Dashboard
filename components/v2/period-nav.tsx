'use client'

import type { PeriodSwipe } from './use-period-swipe'

export default function PeriodNav({ swipe }: { swipe: PeriodSwipe }) {
  const { prevBtnRef, nextBtnRef, pillRef, periodText, prevDisabled, nextDisabled, stepPrev, stepNext } = swipe

  return (
    <div className="period-nav flex items-center justify-between bg-[#f1f3f6] border border-border rounded-[10px] px-1.5 py-1 -mt-1 mb-3 select-none relative gap-1.5">
      <button
        type="button"
        ref={prevBtnRef}
        disabled={prevDisabled}
        onClick={(e) => { e.stopPropagation(); stepPrev() }}
        title="Previous period (or drag right)"
        className="period-btn inline-flex items-center gap-1 h-[25px] px-2 rounded-md border border-transparent bg-card text-ink text-[11px] font-semibold shrink-0 shadow-[0_1px_2px_rgba(20,24,31,0.04)] transition-all disabled:opacity-30 disabled:cursor-not-allowed enabled:hover:bg-white enabled:hover:border-slate-300 enabled:hover:text-blue enabled:active:bg-blue-bg enabled:active:border-blue-300 enabled:active:text-blue enabled:active:scale-[1.06]"
      >
        <span className="text-[13px] leading-none font-bold">‹</span>
        <span>Prev</span>
      </button>

      <div className="flex flex-col items-center justify-center text-center flex-1 min-w-0">
        <div className="text-[11.5px] font-bold text-ink leading-tight whitespace-nowrap overflow-hidden text-ellipsis">
          {periodText}
        </div>
      </div>

      <button
        type="button"
        ref={nextBtnRef}
        disabled={nextDisabled}
        onClick={(e) => { e.stopPropagation(); stepNext() }}
        title="Next period (or drag left)"
        className="period-btn inline-flex items-center gap-1 h-[25px] px-2 rounded-md border border-transparent bg-card text-ink text-[11px] font-semibold shrink-0 shadow-[0_1px_2px_rgba(20,24,31,0.04)] transition-all disabled:opacity-30 disabled:cursor-not-allowed enabled:hover:bg-white enabled:hover:border-slate-300 enabled:hover:text-blue enabled:active:bg-blue-bg enabled:active:border-blue-300 enabled:active:text-blue enabled:active:scale-[1.06]"
      >
        <span>Next</span>
        <span className="text-[13px] leading-none font-bold">›</span>
      </button>

      <div ref={pillRef} className="drag-cue-pill" aria-hidden="true"></div>
    </div>
  )
}
