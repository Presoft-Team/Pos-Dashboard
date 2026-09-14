'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Login failed')
        setLoading(false)
        return
      }
      router.push(params.get('next') ?? '/')
      router.refresh()
    } catch {
      setError('Unable to reach the server')
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <form
        onSubmit={onSubmit}
        className="w-80 rounded-lg border border-ink/10 bg-paper p-6 shadow-sm"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/presoft.png" alt="Presoft" className="h-10 w-auto mb-4" />
        <h1 className="text-lg font-bold text-ink mb-4">Sign in</h1>
        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        <div className="mb-4">
          <label htmlFor="username" className="mb-1 block text-sm font-medium text-sand">
            Username
          </label>
          <input
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            required
            className="w-full rounded-md border border-ink/10 px-3 py-2 text-sm"
          />
        </div>
        <div className="mb-4">
          <label htmlFor="password" className="mb-1 block text-sm font-medium text-sand">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full rounded-md border border-ink/10 px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-brand py-2 text-sm font-semibold text-ink"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}
