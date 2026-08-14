'use client'

// Blocking, non-dismissible prompt shown over the dashboard the first time
// a logged-in tenant's business has no api_url/api_key on file — nothing
// else in the dashboard can fetch data until this is filled in. Deliberately
// has no close button/backdrop-click/Escape handling (unlike components/
// modal.tsx), since skipping it isn't a valid state to leave the user in.
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ApiConfigModal() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [checked, setChecked] = useState(false)
  const [apiUrl, setApiUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : { user: null }))
      .then(({ user }) => {
        setOpen(Boolean(user) && user.hasApiConfig === false)
        setChecked(true)
      })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/auth/business-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiUrl, apiKey }),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}) as { error?: string })
      setError(body.error ?? 'Could not save API settings')
      setLoading(false)
    } else {
      setOpen(false)
      router.refresh()
    }
  }

  if (!checked || !open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-8 space-y-5">
        <div>
          <h3 className="text-lg font-bold text-ink">Connect your business</h3>
          <p className="text-sand mt-1 text-sm">Enter your presoft-api URL and key to start syncing data.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="bg-danger/10 border border-danger/20 text-danger rounded-lg px-4 py-3 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">API URL</label>
            <input
              type="url"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
              placeholder="https://api.yourbusiness.example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
              placeholder="••••••••••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-brand hover:bg-brand-dark disabled:opacity-60 text-ink font-medium rounded-lg text-sm transition-colors"
          >
            {loading ? 'Saving…' : 'Save and continue'}
          </button>
        </form>
      </div>
    </div>
  )
}
