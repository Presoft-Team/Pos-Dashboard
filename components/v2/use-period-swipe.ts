'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { GROUPBY_CONFIG, periodLabel, type V2GroupBy } from '@/lib/v2/periods'

const SWIPE_THRESHOLD = 40
const INTERACTIVE_SELECTOR = 'select, button, input, a, option, .top-n-toggle, .card-search, .card-bottom-toggle'

export interface PeriodSwipe {
  cardRef: React.RefObject<HTMLDivElement | null>
  prevBtnRef: React.RefObject<HTMLButtonElement | null>
  nextBtnRef: React.RefObject<HTMLButtonElement | null>
  pillRef: React.RefObject<HTMLDivElement | null>
  offset: number
  periodText: string
  prevDisabled: boolean
  nextDisabled: boolean
  stepPrev: () => void
  stepNext: () => void
}

// Ported from the prototype's src/hooks/usePeriodSwipe.js. The gesture
// itself stays imperative (direct style/class mutation through refs) —
// only `offset`, which decides which period's data is fetched, is React
// state.
export function usePeriodSwipe(groupBy: V2GroupBy): PeriodSwipe {
  const cardRef = useRef<HTMLDivElement | null>(null)
  const prevBtnRef = useRef<HTMLButtonElement | null>(null)
  const nextBtnRef = useRef<HTMLButtonElement | null>(null)
  const pillRef = useRef<HTMLDivElement | null>(null)

  const [offset, setOffset] = useState(0)
  const offsetRef = useRef(0)
  const groupByRef = useRef(groupBy)
  groupByRef.current = groupBy

  // Reset paging to the current period whenever Group By changes.
  useEffect(() => {
    offsetRef.current = 0
    setOffset(0)
  }, [groupBy])

  const animateCardTransition = useCallback((direction: 'prev' | 'next', onMidpoint: () => void) => {
    const card = cardRef.current
    if (!card) {
      onMidpoint()
      return
    }
    const isPrev = direction === 'prev'
    const exitX = isPrev ? 85 : -85
    const enterFromX = isPrev ? -65 : 65

    card.style.transition = 'transform 0.14s cubic-bezier(0.2, 0.8, 0.4, 1), opacity 0.14s ease'
    card.style.transform = `translateX(${exitX}px) rotate(${isPrev ? 1.5 : -1.5}deg)`
    card.style.opacity = '0.35'

    setTimeout(() => {
      onMidpoint()
      card.style.transition = 'none'
      card.style.transform = `translateX(${enterFromX}px) rotate(${isPrev ? -1 : 1}deg)`
      card.style.opacity = '0.5'

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          card.style.transition = 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease'
          card.style.transform = 'translateX(0) rotate(0deg)'
          card.style.opacity = '1'
          setTimeout(() => {
            card.style.transition = ''
            card.style.transform = ''
            card.style.opacity = ''
          }, 260)
        })
      })
    }, 140)
  }, [])

  const applyPeriodChange = useCallback((newOffset: number) => {
    offsetRef.current = newOffset
    setOffset(newOffset)
  }, [])

  const maxOffset = GROUPBY_CONFIG[groupBy].maxOffset

  const stepPrev = useCallback(() => {
    if (offsetRef.current >= GROUPBY_CONFIG[groupByRef.current].maxOffset) return
    animateCardTransition('prev', () => applyPeriodChange(offsetRef.current + 1))
  }, [animateCardTransition, applyPeriodChange])

  const stepNext = useCallback(() => {
    if (offsetRef.current > 0) {
      animateCardTransition('next', () => applyPeriodChange(offsetRef.current - 1))
    }
  }, [animateCardTransition, applyPeriodChange])

  useEffect(() => {
    const card = cardRef.current
    if (!card) return undefined

    let startX = 0
    let startY = 0
    let startTime = 0
    let currentDx = 0
    let isDragging = false
    let dragIntent: 'horizontal' | 'vertical' | null = null
    let activePointerId: number | null = null

    function onPointerDown(e: PointerEvent) {
      if (e.button !== 0) return
      if (e.target instanceof Element && e.target.closest(INTERACTIVE_SELECTOR)) return

      startX = e.clientX
      startY = e.clientY
      startTime = Date.now()
      currentDx = 0
      isDragging = false
      dragIntent = null
      activePointerId = e.pointerId
    }

    function onPointerMove(e: PointerEvent) {
      if (!card) return
      if (activePointerId === null || e.pointerId !== activePointerId) return

      const dx = e.clientX - startX
      const dy = e.clientY - startY

      if (!isDragging) {
        if (dragIntent === 'vertical') return
        if (Math.hypot(dx, dy) < 6) return

        if (Math.abs(dy) > Math.abs(dx)) {
          dragIntent = 'vertical'
          return
        }

        dragIntent = 'horizontal'
        isDragging = true
        try { card.setPointerCapture(activePointerId) } catch { /* ignore */ }
        card.classList.add('is-dragging')
      }

      e.preventDefault()

      const offsetNow = offsetRef.current
      const groupByNow = groupByRef.current
      const atOldest = offsetNow >= GROUPBY_CONFIG[groupByNow].maxOffset
      const prevBtn = prevBtnRef.current
      const nextBtn = nextBtnRef.current
      const pill = pillRef.current

      if (dx < 0 && offsetNow === 0) {
        currentDx = -Math.min(22, Math.pow(Math.abs(dx), 0.6) * 2.2)
      } else if (dx > 0 && atOldest) {
        currentDx = Math.min(22, Math.pow(Math.abs(dx), 0.6) * 2.2)
      } else {
        currentDx = dx * 0.85
        if (currentDx < -130) currentDx = -130 + (currentDx + 130) * 0.2
        if (currentDx > 130) currentDx = 130 + (currentDx - 130) * 0.2
      }

      card.style.transform = `translateX(${currentDx}px) rotate(${currentDx * 0.02}deg)`

      // Directional visual cues: Right = PREVIOUS, Left = NEXT
      if (currentDx > 8) {
        if (nextBtn) nextBtn.classList.remove('is-active-target')
        if (atOldest) {
          if (prevBtn) prevBtn.classList.remove('is-active-target')
          if (pill) {
            pill.classList.add('is-visible', 'boundary')
            pill.classList.remove('ready')
            pill.textContent = 'No earlier period'
          }
        } else {
          if (prevBtn) prevBtn.classList.add('is-active-target')
          if (pill) {
            pill.classList.add('is-visible')
            pill.classList.remove('boundary')
            const targetName = periodLabel(groupByNow, offsetNow + 1)
            if (currentDx >= SWIPE_THRESHOLD) {
              pill.classList.add('ready')
              pill.innerHTML = `✓ Release for <strong>${targetName}</strong>`
            } else {
              pill.classList.remove('ready')
              pill.innerHTML = `Drag right for <strong>${targetName}</strong> ›`
            }
          }
        }
      } else if (currentDx < -8) {
        if (prevBtn) prevBtn.classList.remove('is-active-target')

        if (offsetNow === 0) {
          if (nextBtn) nextBtn.classList.remove('is-active-target')
          if (pill) {
            pill.classList.add('is-visible', 'boundary')
            pill.classList.remove('ready')
            pill.textContent = 'Current period (already latest)'
          }
        } else {
          if (nextBtn) nextBtn.classList.add('is-active-target')
          if (pill) {
            pill.classList.add('is-visible')
            pill.classList.remove('boundary')
            const targetName = periodLabel(groupByNow, offsetNow - 1)
            if (currentDx <= -SWIPE_THRESHOLD) {
              pill.classList.add('ready')
              pill.innerHTML = `✓ Release for <strong>${targetName}</strong>`
            } else {
              pill.classList.remove('ready')
              pill.innerHTML = `‹ Drag left for <strong>${targetName}</strong>`
            }
          }
        }
      } else {
        if (prevBtn) prevBtn.classList.remove('is-active-target')
        if (nextBtn) nextBtn.classList.remove('is-active-target')
        if (pill) pill.classList.remove('is-visible', 'ready', 'boundary')
      }
    }

    function endDrag(e: PointerEvent) {
      if (!card) return
      if (activePointerId === null || (e && e.pointerId !== activePointerId)) return
      try {
        if (card.hasPointerCapture(activePointerId)) card.releasePointerCapture(activePointerId)
      } catch { /* ignore */ }
      activePointerId = null

      if (!isDragging) {
        dragIntent = null
        return
      }

      isDragging = false
      dragIntent = null
      card.classList.remove('is-dragging')
      const prevBtn = prevBtnRef.current
      const nextBtn = nextBtnRef.current
      const pill = pillRef.current
      if (prevBtn) prevBtn.classList.remove('is-active-target')
      if (nextBtn) nextBtn.classList.remove('is-active-target')
      if (pill) pill.classList.remove('is-visible', 'ready', 'boundary')

      const offsetNow = offsetRef.current
      const atOldest = offsetNow >= GROUPBY_CONFIG[groupByRef.current].maxOffset
      const elapsed = Math.max(1, Date.now() - startTime)
      const velocity = currentDx / elapsed
      const isQuickFlickRight = currentDx > 20 && velocity > 0.35
      const isQuickFlickLeft = currentDx < -20 && velocity < -0.35

      if ((currentDx >= SWIPE_THRESHOLD || isQuickFlickRight) && !atOldest) {
        animateCardTransition('prev', () => applyPeriodChange(offsetNow + 1))
      } else if ((currentDx <= -SWIPE_THRESHOLD || isQuickFlickLeft) && offsetNow > 0) {
        animateCardTransition('next', () => applyPeriodChange(offsetNow - 1))
      } else {
        card.style.transition = 'transform 0.28s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
        card.style.transform = 'translateX(0) rotate(0deg)'
        setTimeout(() => {
          card.style.transition = ''
          card.style.transform = ''
        }, 290)
      }
    }

    card.addEventListener('pointerdown', onPointerDown)
    card.addEventListener('pointermove', onPointerMove)
    card.addEventListener('pointerup', endDrag)
    card.addEventListener('pointercancel', endDrag)

    return () => {
      card.removeEventListener('pointerdown', onPointerDown)
      card.removeEventListener('pointermove', onPointerMove)
      card.removeEventListener('pointerup', endDrag)
      card.removeEventListener('pointercancel', endDrag)
    }
  }, [animateCardTransition, applyPeriodChange])

  return {
    cardRef,
    prevBtnRef,
    nextBtnRef,
    pillRef,
    offset,
    periodText: periodLabel(groupBy, offset),
    prevDisabled: offset >= maxOffset,
    nextDisabled: offset === 0,
    stepPrev,
    stepNext,
  }
}
