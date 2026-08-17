// Postgres connection to the master-admin DB (business/customer/member —
// tenant identity + per-business presoft-api config). Separate from
// lib/mssql.ts, which is an unrelated future SQL Server POS integration.
// Server-only: imported by the client bundle, this throws at build time
// instead of silently leaking connection details to the browser.
import 'server-only'
import { Pool } from 'pg'

// Cached on globalThis so Next.js dev-mode hot reloads reuse the same pool
// instead of opening new Postgres connections on every file change (same
// reasoning as lib/mssql.ts's pooling).
const globalForPg = globalThis as unknown as { masterAdminPool?: Pool }

function getPool(): Pool {
  if (!globalForPg.masterAdminPool) {
    globalForPg.masterAdminPool = new Pool({
      connectionString: process.env.MASTER_ADMIN_DATABASE_URL,
      max: 5,
    })
  }
  return globalForPg.masterAdminPool
}

// Run a parameterized query against the master-admin database. Always pass
// user-influenced values via `params`, never string-concatenated into
// `text` — pg binds $1/$2/... safely (SQL injection guard).
export async function query<T = unknown>(text: string, params?: unknown[]): Promise<T[]> {
  const result = await getPool().query(text, params)
  return result.rows as T[]
}
