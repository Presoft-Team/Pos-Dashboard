// Real SQL Server connection (AED_Presoft account book) — see PLAN.md.
// Server-only: imported by the client bundle, this throws at build time
// instead of silently leaking credentials/query logic to the browser.
import 'server-only'
import sql from 'mssql'

// MSSQL_HOST may be a plain host ("myhost") or a named-instance form
// ("HOST\INSTANCE", e.g. "DESKTOP-26VS865\A2006"). Named instances almost
// never listen on the default port 1433 — they listen on a dynamic port
// that SQL Server Browser resolves at connect time using the instance
// name, NOT a fixed port. mssql/tedious can't be given both `port` and
// `options.instanceName` at once, so: if there's an instance name and no
// explicit MSSQL_PORT override, use instanceName-based resolution (requires
// the SQL Server Browser service running and UDP 1434 reachable); if
// MSSQL_PORT *is* set, trust it and connect to that fixed port directly
// instead (the usual setup once someone's found the instance's static port
// via SQL Server Configuration Manager).
const [rawHost, instanceName] = (process.env.MSSQL_HOST ?? '').split('\\')
const explicitPort = process.env.MSSQL_PORT ? Number(process.env.MSSQL_PORT) : undefined
const useInstanceName = Boolean(instanceName) && explicitPort === undefined

const config: sql.config = {
  server: rawHost,
  database: process.env.MSSQL_DATABASE!,
  user: process.env.MSSQL_USER!,
  password: process.env.MSSQL_PASSWORD!,
  ...(useInstanceName ? {} : { port: explicitPort ?? 1433 }),
  options: {
    ...(useInstanceName ? { instanceName } : {}),
    // Tunnels/on-prem SQL Server usually present a self-signed or no
    // cert — set MSSQL_TRUST_SERVER_CERT=true if connections fail on
    // certificate validation once the tunnel is live.
    encrypt: process.env.MSSQL_ENCRYPT !== 'false',
    trustServerCertificate: process.env.MSSQL_TRUST_SERVER_CERT === 'true',
  },
}

// Cached on globalThis so Next.js dev-mode hot reloads reuse the same pool
// instead of opening a new SQL Server connection on every file change.
//
// IMPORTANT: process.env is only populated from .env.local once, at process
// startup — editing .env.local while `next dev` is already running does NOT
// update it, no matter how many times the page reloads or how many files
// get hot-reloaded. A real fix always needs a full stop + restart of
// `npm run dev`, not just a browser refresh.
const globalForMssql = globalThis as unknown as {
  mssqlPool?: Promise<sql.ConnectionPool>
}

function getPool(): Promise<sql.ConnectionPool> {
  if (!globalForMssql.mssqlPool) {
    // If the connection attempt fails, evict it from the cache instead of
    // caching the rejection forever — otherwise every request after the
    // first failure reuses that same broken promise until the process
    // restarts, even once the underlying problem (wrong port, unreachable
    // host, ...) is actually fixed.
    const pool = new sql.ConnectionPool(config).connect()
    pool.catch(() => {
      if (globalForMssql.mssqlPool === pool) globalForMssql.mssqlPool = undefined
    })
    globalForMssql.mssqlPool = pool
  }
  return globalForMssql.mssqlPool
}

// A fresh request bound to the shared pool — use this (not `query()`) when
// a query needs explicitly-typed parameters (e.g. NULL date/string filters
// that need `sql.Date`/`sql.NVarChar` spelled out) or multiple statements.
export async function getRequest(): Promise<sql.Request> {
  const pool = await getPool()
  return pool.request()
}

// Run a parameterized query against the real database. Always pass
// user-influenced values via `params`, never string-concatenated into
// `queryText` — mssql's `.input()` binds them safely (SQL injection guard).
export async function query<T = unknown>(
  queryText: string,
  params?: Record<string, unknown>
): Promise<T[]> {
  const pool = await getPool()
  const request = pool.request()
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      request.input(key, value)
    }
  }
  const result = await request.query<T>(queryText)
  return result.recordset
}

export { sql }
