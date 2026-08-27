'use client'

// API connection smoke test — not linked from nav. Answers one question:
// can this dashboard actually reach and read the tenant's own IIS-hosted
// presoft-api? Previously this page ran ad-hoc SQL against a hardcoded SQL
// Server; that link is gone, so it now tests the API path instead.
import { useCallback, useEffect, useState } from 'react'
import { Play, RefreshCw } from 'lucide-react'

interface ConnectionResult {
  ok: boolean
  stage: string
  apiUrl?: string
  elapsedMs?: number
  error?: string
  hint?: string
  status?: number
  body?: string
  title?: string
  version?: string
  pathCount?: number
  paths?: string[]
}

interface ProbeResult {
  ok: boolean
  status: number
  elapsedMs: number
  path: string
  method?: string
  rowCount: number | null
  sample: unknown
  error?: string
}

// This API's data endpoints take a POST body of
// { CompanyId, FromDateTime, ToDateTime }. CompanyId is filled in
// server-side from PRESOFT_COMPANY_ID, so it's deliberately absent here —
// only the parts that vary per call belong in the editor.
function defaultBody(): string {
  const to = new Date()
  const from = new Date(to)
  from.setMonth(from.getMonth() - 1)
  return JSON.stringify(
    { FromDateTime: from.toISOString(), ToDateTime: to.toISOString() },
    null,
    2
  )
}

const STAGE_LABEL: Record<string, string> = {
  config: 'PRESOFT_API_URL / PRESOFT_API_KEY not set',
  reach: 'Cannot reach the API host',
  http: 'API host answered with an error',
  parse: 'Answered, but not with an OpenAPI spec',
  done: 'Connected',
}

export default function TestPage() {
  const [conn, setConn] = useState<ConnectionResult | null>(null)
  const [connLoading, setConnLoading] = useState(true)

  const [path, setPath] = useState('/api/v1/kpi-summary')
  const [method, setMethod] = useState<'GET' | 'POST'>('POST')
  const [body, setBody] = useState(defaultBody)
  const [bodyError, setBodyError] = useState('')
  const [probe, setProbe] = useState<ProbeResult | null>(null)
  const [probeLoading, setProbeLoading] = useState(false)

  const checkConnection = useCallback(() => {
    setConnLoading(true)
    fetch('/api/test/connection')
      .then((res) => res.json())
      .then(setConn)
      .catch((err) => setConn({ ok: false, stage: 'reach', error: String(err) }))
      .finally(() => setConnLoading(false))
  }, [])

  useEffect(() => {
    checkConnection()
  }, [checkConnection])

  const runProbe = useCallback(
    (target: string, verb: 'GET' | 'POST', rawBody: string) => {
      setPath(target)
      setMethod(verb)
      setBodyError('')

      // Parse before firing so a typo in the editor shows up as "fix your
      // JSON" rather than a confusing error from the API.
      let parsedBody: unknown = {}
      if (verb === 'POST' && rawBody.trim()) {
        try {
          parsedBody = JSON.parse(rawBody)
        } catch (err) {
          setBodyError(err instanceof Error ? err.message : 'Body is not valid JSON')
          return
        }
      }

      setProbeLoading(true)
      setProbe(null)

      const req =
        verb === 'GET'
          ? fetch(`/api/test/probe?path=${encodeURIComponent(target)}`)
          : fetch('/api/test/probe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ path: target, body: parsedBody }),
            })

      req
        .then((res) => res.json())
        .then(setProbe)
        .catch((err) =>
          setProbe({ ok: false, status: 0, elapsedMs: 0, path: target, rowCount: null, sample: null, error: String(err) })
        )
        .finally(() => setProbeLoading(false))
    },
    []
  )

  return (
    <div className="p-4 lg:p-6 space-y-4">
      {/* 1. Can we reach the API at all, and what does it expose? */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 lg:p-5">
        <div className="flex items-center justify-between gap-3 mb-3">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">API Connection</p>
          <button
            onClick={checkConnection}
            disabled={connLoading}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw size={12} className={connLoading ? 'animate-spin' : ''} />
            Retest
          </button>
        </div>

        {connLoading && <p className="text-sm text-gray-400">Testing…</p>}

        {!connLoading && conn && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span
                className={`inline-block w-2 h-2 rounded-full ${conn.ok ? 'bg-emerald-500' : 'bg-danger'}`}
              />
              <span className="text-sm font-medium">{STAGE_LABEL[conn.stage] ?? conn.stage}</span>
              {conn.elapsedMs !== undefined && (
                <span className="text-xs text-gray-400">{conn.elapsedMs} ms</span>
              )}
            </div>

            <dl className="text-sm space-y-1">
              {conn.apiUrl && (
                <div className="flex gap-2">
                  <dt className="text-gray-500 w-24 shrink-0">API URL</dt>
                  <dd className="font-mono text-xs break-all">{conn.apiUrl}</dd>
                </div>
              )}
              {conn.ok && (
                <div className="flex gap-2">
                  <dt className="text-gray-500 w-24 shrink-0">Reported</dt>
                  <dd>
                    {conn.title} <span className="text-gray-400">v{conn.version}</span> ·{' '}
                    {conn.pathCount} endpoints
                  </dd>
                </div>
              )}
            </dl>

            {conn.error && (
              <div className="bg-danger/10 border border-danger/20 text-danger rounded-lg px-4 py-3 text-sm space-y-1">
                <p className="font-mono text-xs break-all">{conn.error}</p>
                {conn.hint && <p className="text-xs opacity-80">{conn.hint}</p>}
                {conn.body && (
                  <pre className="text-xs bg-white/50 rounded p-2 overflow-x-auto whitespace-pre-wrap">
                    {conn.body}
                  </pre>
                )}
              </div>
            )}

            {conn.ok && conn.paths && (
              <div>
                <p className="text-xs text-gray-500 mb-1.5">
                  Endpoints your API advertises — click one to call it:
                </p>
                <div className="flex flex-wrap gap-1.5 max-h-56 overflow-y-auto">
                  {conn.paths.map((p) => {
                    const [verb, ...rest] = p.split(' ')
                    const target = rest.join(' ')
                    const testable = verb === 'GET' || verb === 'POST'
                    return (
                      <button
                        key={p}
                        onClick={() => runProbe(target, verb as 'GET' | 'POST', body)}
                        disabled={!testable}
                        title={testable ? `Call ${target}` : `${verb} not testable from here`}
                        className="font-mono text-[11px] px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-transparent"
                      >
                        <span className="text-gray-400 mr-1">{verb}</span>
                        {target}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. Does an actual data endpoint return usable rows? */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 lg:p-5">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Call an endpoint</p>

        <div className="flex gap-2 mb-3">
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as 'GET' | 'POST')}
            className="px-2 py-1.5 text-sm font-mono border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand"
          >
            <option>POST</option>
            <option>GET</option>
          </select>
          <input
            type="text"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runProbe(path, method, body)}
            placeholder="/api/v1/kpi-summary"
            className="flex-1 px-3 py-1.5 text-sm font-mono border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand"
          />
          <button
            onClick={() => runProbe(path, method, body)}
            disabled={probeLoading}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-brand hover:bg-brand-dark text-ink font-medium disabled:opacity-50"
          >
            <Play size={13} />
            Call
          </button>
        </div>

        {method === 'POST' && (
          <div className="mb-3">
            <label className="block text-xs text-gray-500 mb-1.5">
              Request body — <span className="font-mono">CompanyId</span> is added server-side from{' '}
              <span className="font-mono">PRESOFT_COMPANY_ID</span>
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              spellCheck={false}
              className="w-full px-3 py-2 text-xs font-mono border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand"
            />
            {bodyError && <p className="text-xs text-danger mt-1">{bodyError}</p>}
          </div>
        )}

        {probeLoading && <p className="text-sm text-gray-400">Calling…</p>}

        {!probeLoading && probe && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <span className={`inline-block w-2 h-2 rounded-full ${probe.ok ? 'bg-emerald-500' : 'bg-danger'}`} />
              <span className="font-medium">
                {probe.method ?? ''} HTTP {probe.status || '—'}
              </span>
              <span className="text-xs text-gray-400">{probe.elapsedMs} ms</span>
              {probe.rowCount !== null && (
                <span className="text-xs text-gray-500">{probe.rowCount} rows</span>
              )}
            </div>
            {probe.error && <p className="text-sm text-danger">{probe.error}</p>}
            <pre className="text-xs bg-gray-50 rounded-lg p-3 overflow-auto max-h-80 whitespace-pre-wrap">
              {JSON.stringify(probe.sample, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}
