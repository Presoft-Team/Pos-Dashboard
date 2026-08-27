'use client'

import { useEffect, useState } from 'react'
import { Play, RefreshCw } from 'lucide-react'

// Smoke test for the whole chain — this app -> presoft-api -> AutoCount
// SQL Server. Not linked from nav. Replaces the old direct-to-SQL-Server
// verification queries, which went away with lib/mssql.ts: this app has no
// database connection of its own anymore, so the only thing worth testing
// here is the API hop.

interface ConnectionResult {
  ok: boolean
  stage: string
  apiUrl?: string
  elapsedMs?: number
  error?: string
  hint?: string
  body?: string
  status?: number
  title?: string
  version?: string
  pathCount?: number
  paths?: string[]
}

interface ProbeResult {
  ok: boolean
  status?: number
  elapsedMs?: number
  path?: string
  rowCount?: number | null
  sample?: unknown
  error?: string
}

const STAGE_HINT: Record<string, string> = {
  config: 'Environment variables are missing.',
  reach: 'The API host could not be reached.',
  http: 'The host answered, but with an error status.',
  parse: 'Something answered, but it was not presoft-api.',
}

export default function TestPage() {
  const [conn, setConn] = useState<ConnectionResult | null>(null)
  const [connLoading, setConnLoading] = useState(true)

  const [path, setPath] = useState('/api/v1/kpi-summary')
  const [probe, setProbe] = useState<ProbeResult | null>(null)
  const [probeLoading, setProbeLoading] = useState(false)

  function checkConnection() {
    setConnLoading(true)
    fetch('/api/test/connection')
      .then((res) => res.json())
      .then(setConn)
      .catch((err) => setConn({ ok: false, stage: 'reach', error: err instanceof Error ? err.message : 'Fetch failed' }))
      .finally(() => setConnLoading(false))
  }

  useEffect(checkConnection, [])

  function runProbe() {
    setProbeLoading(true)
    setProbe(null)
    fetch(`/api/test/probe?path=${encodeURIComponent(path)}`)
      .then((res) => res.json())
      .then(setProbe)
      .catch((err) => setProbe({ ok: false, error: err instanceof Error ? err.message : 'Fetch failed' }))
      .finally(() => setProbeLoading(false))
  }

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-5xl">
      {/* Connection */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 lg:p-5">
        <div className="flex items-center justify-between gap-3 mb-3">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">API Connection</p>
          <button
            onClick={checkConnection}
            disabled={connLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 hover:bg-gray-50 disabled:opacity-50 text-gray-700 text-sm rounded-lg transition-colors"
          >
            <RefreshCw size={14} className={connLoading ? 'animate-spin' : ''} />
            Re-check
          </button>
        </div>

        {connLoading && <p className="text-sm text-gray-400">Checking…</p>}

        {!connLoading && conn && (
          <div className="space-y-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`px-2 py-0.5 rounded text-xs font-medium ${
                  conn.ok ? 'bg-mint/15 text-mint' : 'bg-danger/10 text-danger'
                }`}
              >
                {conn.ok ? 'Connected' : `Failed at: ${conn.stage}`}
              </span>
              {conn.apiUrl && <code className="text-xs text-gray-500">{conn.apiUrl}</code>}
              {conn.elapsedMs != null && <span className="text-xs text-gray-400">{conn.elapsedMs} ms</span>}
            </div>

            {conn.ok ? (
              <>
                <p className="text-gray-700">
                  {conn.title} <span className="text-gray-400">v{conn.version}</span> — {conn.pathCount} endpoints
                </p>
                <details>
                  <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-700">
                    Show endpoints
                  </summary>
                  <ul className="mt-2 max-h-64 overflow-y-auto space-y-0.5">
                    {conn.paths?.map((p) => (
                      <li key={p}>
                        <button
                          onClick={() => setPath(p.replace(/^[A-Z]+\s+/, ''))}
                          className="text-left text-xs font-mono text-gray-600 hover:text-brand"
                        >
                          {p}
                        </button>
                      </li>
                    ))}
                  </ul>
                </details>
              </>
            ) : (
              <>
                <p className="text-gray-700">{STAGE_HINT[conn.stage] ?? ''}</p>
                <p className="text-danger">{conn.error}</p>
                {conn.hint && <p className="text-xs text-gray-500">{conn.hint}</p>}
                {conn.body && (
                  <pre className="text-xs bg-gray-50 p-2 rounded overflow-x-auto">{conn.body}</pre>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Probe */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 lg:p-5">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Call an endpoint</p>

        <div className="flex flex-col sm:flex-row gap-2 mb-3">
          <input
            type="text"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runProbe()}
            placeholder="/api/v1/kpi-summary"
            className="flex-1 px-3 py-1.5 text-sm font-mono border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand"
          />
          <button
            onClick={runProbe}
            disabled={probeLoading}
            className="flex items-center justify-center gap-1.5 px-4 py-1.5 bg-brand hover:opacity-90 disabled:opacity-50 text-ink text-sm font-medium rounded-lg transition-opacity"
          >
            <Play size={14} />
            {probeLoading ? 'Calling…' : 'Call'}
          </button>
        </div>

        {probe && (
          <div className="space-y-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`px-2 py-0.5 rounded text-xs font-medium ${
                  probe.ok ? 'bg-mint/15 text-mint' : 'bg-danger/10 text-danger'
                }`}
              >
                {probe.status ?? 'error'}
              </span>
              {probe.elapsedMs != null && <span className="text-xs text-gray-400">{probe.elapsedMs} ms</span>}
              {probe.rowCount != null && (
                <span className="text-xs text-gray-500">{probe.rowCount} rows</span>
              )}
            </div>
            {probe.error && <p className="text-danger">{probe.error}</p>}
            {probe.sample != null && (
              <pre className="text-xs bg-gray-50 p-2 rounded overflow-x-auto max-h-96">
                {typeof probe.sample === 'string' ? probe.sample : JSON.stringify(probe.sample, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400">
        If a probe returns rows, the dashboard pages will work — they use the identical path.
      </p>
    </div>
  )
}
