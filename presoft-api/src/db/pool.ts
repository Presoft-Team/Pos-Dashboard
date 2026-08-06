// Real SQL Server connection (AutoCount/Presoft account book). Ported from
// the dashboard app's lib/mssql.ts — same driver, same config shape, just
// no Next.js 'server-only' guard needed (this whole service is server code).
import sql from 'mssql'

// MSSQL_HOST may be a plain host or a named-instance form
// ("HOST\INSTANCE", e.g. "DESKTOP-26VS865\A2006"). Named instances almost
// never listen on the default port 1433 — they listen on a dynamic port
// SQL Server Browser resolves at connect time via the instance name, not a
// fixed port. mssql/tedious can't take both `port` and
// `options.instanceName` at once: if there's an instance name and no
// explicit MSSQL_PORT, use instanceName-based resolution (needs SQL Server
// Browser running, UDP 1434 reachable); if MSSQL_PORT is set, trust it and
// connect to that fixed port directly instead.
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
    encrypt: process.env.MSSQL_ENCRYPT !== 'false',
    trustServerCertificate: process.env.MSSQL_TRUST_SERVER_CERT === 'true',
  },
}

let poolPromise: Promise<sql.ConnectionPool> | null = null

function getPool(): Promise<sql.ConnectionPool> {
  if (!poolPromise) {
    // Evict a failed connection attempt instead of caching the rejection
    // forever — otherwise every request after the first failure reuses
    // that same broken promise until the process restarts.
    const pool = new sql.ConnectionPool(config).connect()
    pool.catch(() => {
      if (poolPromise === pool) poolPromise = null
    })
    poolPromise = pool
  }
  return poolPromise
}

// A fresh request bound to the shared pool — use for explicitly-typed
// parameters (NULL-safe filters, multi-statement queries).
export async function getRequest(): Promise<sql.Request> {
  const pool = await getPool()
  return pool.request()
}

export { sql }
