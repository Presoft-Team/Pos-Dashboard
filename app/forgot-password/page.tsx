'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setSent(true)
      setLoading(false)
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
          <p className="text-sand mt-1 text-sm">Reset your password</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 space-y-5">
          {sent ? (
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-mint/10">
                <svg className="w-6 h-6 text-mint-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-base font-semibold text-gray-900">Check your email</h2>
              <p className="text-sm text-gray-500">We sent a password reset link to <strong>{email}</strong></p>
              <Link href="/login" className="block w-full py-2.5 px-4 bg-brand hover:bg-brand-dark text-ink font-medium rounded-lg text-sm transition-colors text-center">
                Back to Sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="bg-danger/10 border border-danger/20 text-danger rounded-lg px-4 py-3 text-sm">{error}</div>
              )}
              <p className="text-sm text-gray-500">Enter your email and we&apos;ll send you a link to reset your password.</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
                  placeholder="you@example.com"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-brand hover:bg-brand-dark disabled:opacity-60 text-ink font-medium rounded-lg text-sm transition-colors"
              >
                {loading ? 'Sending…' : 'Send reset link'}
              </button>
              <p className="text-center text-sm text-gray-500">
                <Link href="/login" className="text-brand-dark hover:underline font-medium">Back to Sign in</Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
