'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const supabase = createClient()
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [expired, setExpired] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)

    // Supabase appends ?error=... when the link is expired or invalid
    if (params.get('error')) {
      setExpired(true)
      return
    }

    // Listen for PASSWORD_RECOVERY event (implicit / OTP flow)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true)
    })

    // The Supabase client auto-exchanges the ?code via _initialize() and fires
    // PASSWORD_RECOVERY. Calling exchangeCodeForSession manually would consume
    // the single-use code a second time and cause a failure. Use getSession()
    // as a fallback for cases where the session was set server-side (/auth/callback).
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true)
    })

    // After 3s with no valid session or recovery event, treat link as expired
    const timeout = setTimeout(() => {
      setReady(currentReady => {
        if (!currentReady) setExpired(true)
        return currentReady
      })
    }, 3000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand mb-4">
            <span className="text-ink text-2xl font-bold">P</span>
          </div>
          <h1 className="text-2xl font-bold text-ink">Presoft Dashboard Platform</h1>
          <p className="text-sand mt-1 text-sm">Set a new password</p>
        </div>

        {expired ? (
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center space-y-4">
            <p className="text-sm text-gray-600">This reset link has expired or is invalid.</p>
            <Link
              href="/forgot-password"
              className="block w-full py-2.5 px-4 bg-brand hover:bg-brand-dark text-ink font-medium rounded-lg text-sm transition-colors"
            >
              Request a new link
            </Link>
          </div>
        ) : !ready ? (
          <div className="flex justify-center">
            <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl p-8 space-y-5">
            {error && (
              <div className="bg-danger/10 border border-danger/20 text-danger rounded-lg px-4 py-3 text-sm">{error}</div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">New Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
                placeholder="••••••••"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-brand hover:bg-brand-dark disabled:opacity-60 text-ink font-medium rounded-lg text-sm transition-colors"
            >
              {loading ? 'Updating…' : 'Update password'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
