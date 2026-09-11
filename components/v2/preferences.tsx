'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

const PREFS_STORAGE_KEY = 'sales_dashboard_prefs_v2'

export interface V2Preferences {
  dynamicTopN: boolean
  showSearch: boolean
  dynamicGrouping: boolean
}

export type V2PreferenceKey = keyof V2Preferences

const DEFAULT_PREFS: V2Preferences = {
  dynamicTopN: false,
  showSearch: false,
  dynamicGrouping: false,
}

function readStoredPrefs(): V2Preferences {
  try {
    const raw = window.localStorage.getItem(PREFS_STORAGE_KEY)
    if (!raw) return { ...DEFAULT_PREFS }
    const parsed = JSON.parse(raw) as Partial<Record<V2PreferenceKey, unknown>>
    return {
      dynamicTopN: parsed.dynamicTopN === true,
      showSearch: parsed.showSearch === true,
      dynamicGrouping: parsed.dynamicGrouping === true,
    }
  } catch {
    // Private mode, blocked site data, corrupt JSON — defaults are fine.
    return { ...DEFAULT_PREFS }
  }
}

interface PreferencesContextValue {
  prefs: V2Preferences
  setPref: (key: V2PreferenceKey, value: boolean) => void
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null)

// These three are genuine per-viewer display preferences (which optional
// controls a card shows), not data — localStorage is the right home for
// them, as in the prototype.
//
// Unlike the prototype, the stored value is NOT read during render:
// the server has no localStorage, so seeding useState from it would render
// one tree on the server and a different one on the client and React would
// report a hydration mismatch. First paint is always the defaults; the
// stored value is applied in an effect immediately after mount.
export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<V2Preferences>(DEFAULT_PREFS)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setPrefs(readStoredPrefs())
    setHydrated(true)
  }, [])

  // Guarded on `hydrated` so the defaults rendered before the read above
  // can't overwrite what the user actually saved.
  useEffect(() => {
    if (!hydrated) return
    try {
      window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs))
    } catch {
      // ignore write failures (private mode, quota, etc.)
    }
  }, [prefs, hydrated])

  function setPref(key: V2PreferenceKey, value: boolean) {
    setPrefs((p) => ({ ...p, [key]: value }))
  }

  return <PreferencesContext.Provider value={{ prefs, setPref }}>{children}</PreferencesContext.Provider>
}

export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext)
  if (!ctx) throw new Error('usePreferences must be used within a PreferencesProvider')
  return ctx
}
