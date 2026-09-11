'use client'

import { useEffect, useRef } from 'react'
import { fmtBarVal } from '@/lib/v2/format'
import type { ChartBar } from '@/lib/v2/periods'

interface Props {
  bars: ChartBar[]
  currency: string
  loading?: boolean
}

export default function SalesChart({ bars, currency, loading = false }: Props) {
  const scrollerRef = useRef<HTMLDivElement | null>(null)

  // Dynamically size bars so exactly 6 bars fit within one visible screen.
  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return undefined

    function updateChartBarSizing() {
      const el = scrollerRef.current
      if (!el) return
      const style = window.getComputedStyle(el)
      const padLeft = parseFloat(style.paddingLeft) || 16
      const padRight = parseFloat(style.paddingRight) || 16
      const availWidth = el.clientWidth - padLeft - padRight
      if (availWidth <= 0) return
      const gap = 10
      const barWidth = Math.max(28, (availWidth - 5 * gap) / 6)
      el.style.setProperty('--chart-gap', `${gap}px`)
      el.style.setProperty('--chart-bar-w', `${barWidth.toFixed(2)}px`)
    }

    updateChartBarSizing()
    window.addEventListener('resize', updateChartBarSizing)
    let ro: ResizeObserver | undefined
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(updateChartBarSizing)
      // Observe the card, not the scroller: the scroller's own width is
      // what this callback goes on to change (via the bar width), so
      // watching it feeds its output back into its input and the chart
      // grows without bound.
      ro.observe(scroller.parentElement ?? scroller)
    }
    return () => {
      window.removeEventListener('resize', updateChartBarSizing)
      if (ro) ro.disconnect()
    }
    // Re-run when `loading` flips: while loading this component returns the
    // spinner early, so scrollerRef.current is null and the measurement
    // above bails out. Without these deps it would never run again once the
    // real scroller mounted, leaving every bar at the CSS fallback width
    // instead of filling the card.
  }, [loading, bars.length])

  // Drag-to-scroll + wheel-to-horizontal-scroll on the chart scroller.
  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return undefined

    let isDown = false
    let startX = 0
    let startScrollLeft = 0

    function onMouseDown(e: MouseEvent) {
      if (!el || e.button !== 0) return
      isDown = true
      el.classList.add('is-dragging')
      startX = e.pageX - el.offsetLeft
      startScrollLeft = el.scrollLeft
    }
    function onMouseUp() {
      if (el && isDown) {
        isDown = false
        el.classList.remove('is-dragging')
      }
    }
    function onMouseMove(e: MouseEvent) {
      if (!el || !isDown) return
      e.preventDefault()
      const x = e.pageX - el.offsetLeft
      const walk = (x - startX) * 1.5
      el.scrollLeft = startScrollLeft - walk
    }
    function onWheel(e: WheelEvent) {
      if (!el) return
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && el.scrollWidth > el.clientWidth) {
        e.preventDefault()
        el.scrollLeft += e.deltaY
      }
    }

    el.addEventListener('mousedown', onMouseDown)
    document.addEventListener('mouseup', onMouseUp)
    el.addEventListener('mousemove', onMouseMove)
    el.addEventListener('wheel', onWheel, { passive: false })

    return () => {
      el.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('mouseup', onMouseUp)
      el.removeEventListener('mousemove', onMouseMove)
      el.removeEventListener('wheel', onWheel)
    }
  }, [])

  // Always jump to the rightmost edge ("Now") whenever the bars change.
  useEffect(() => {
    const scroller = scrollerRef.current
    requestAnimationFrame(() => {
      if (scroller) scroller.scrollLeft = scroller.scrollWidth
    })
  }, [bars])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[218px]">
        <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Bars can be negative (a period whose credit notes outweigh its
  // invoices), and every bar can be zero on a quiet book — either would
  // make a naive max() produce NaN heights, so the scale is taken from the
  // largest magnitude and floored at 1.
  const max = Math.max(1, ...bars.map((b) => Math.abs(b.amt)))

  return (
    <div
      ref={scrollerRef}
      className="chart-scroll overflow-x-auto overflow-y-hidden -mx-4 px-4 pt-11 pb-2 cursor-grab"
      style={{ scrollBehavior: 'smooth' }}
    >
      <div className="chart-wrap flex items-end h-[175px] w-max box-border">
        {bars.map((x, idx) => {
          const isNow = x.today
          const isHighRow = idx % 2 === 1
          const heightPct = Math.max((Math.abs(x.amt) / max) * 100, 8)
          return (
            <div key={`${x.d}-${x.date}-${idx}`} className="bar-col flex flex-col items-center h-full justify-end gap-1.5">
              <div
                className={
                  'w-full rounded-t-[7px] rounded-b-[3px] relative ' +
                  (isNow
                    ? 'bg-gradient-to-b from-sky-400 to-blue shadow-[0_0_0_2px_rgba(37,99,235,0.22)]'
                    : x.amt < 0
                    ? 'bg-gradient-to-b from-red-300 to-red'
                    : // Weekends read as muted in Date mode, as in the
                      // prototype; a zero bar is muted in every mode.
                    x.weekend || x.amt === 0
                    ? 'bg-gradient-to-b from-slate-200 to-slate-300'
                    : 'bg-gradient-to-b from-amber-300 to-brand-dark')
                }
                style={{ height: `${heightPct}%` }}
              >
                {/* A label on every empty period turns a quiet book into a
                    wall of "RM 0" and buries the bars that do carry value,
                    so zero bars are left bare. */}
                {x.amt !== 0 && (
                  <span className={'bar-val text-ink text-[9.5px] font-bold ' + (isHighRow ? 'row-high' : 'row-low')}>
                    {fmtBarVal(x.amt, currency)}
                  </span>
                )}
              </div>
              {x.d && <span className="text-[10.5px] text-sand font-bold">{x.d}</span>}
              <span className={'text-sand font-semibold ' + (x.d ? 'text-[9px] -mt-1 text-[#b7bcc5] font-medium' : 'text-[10px]')}>
                {x.date}
              </span>
              {isNow && (
                <span className="text-[8.5px] font-bold uppercase text-blue bg-blue-bg px-1 py-px rounded leading-none mt-px tracking-wide border border-blue-200">
                  Now
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
