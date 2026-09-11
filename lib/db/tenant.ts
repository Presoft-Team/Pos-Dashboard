// Multi-tenant client lookup — reads the SAME `clients` table the
// license-portal app writes (shared DATABASE_URL). Server-only: this must
// never reach the client bundle, same as lib/presoft-api.ts.
import 'server-only'
import { Pool } from 'pg'

// Postgres over TLS: Railway's *public* endpoint (*.proxy.rlwy.net) presents
// a certificate node-postgres won't validate against the system roots, so
// verification is relaxed for it. Inside Railway's private network
// (*.railway.internal) and against a local dev Postgres, TLS is off.
// An explicit sslmode= in the URL always wins.
function sslFor(connectionString: string): { rejectUnauthorized: boolean } | undefined {
  if (/[?&]sslmode=disable/i.test(connectionString)) return undefined
  if (/railway\.internal/i.test(connectionString)) return undefined
  if (/@(localhost|127\.0\.0\.1)[:/]/i.test(connectionString)) return undefined
  return { rejectUnauthorized: false }
}

let pool: Pool | null = null

function getPool(): Pool | null {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) return null
  if (!pool) pool = new Pool({ connectionString, ssl: sslFor(connectionString) })
  return pool
}

export interface TenantClient {
  id: string
  name: string
  username: string
  passwordHash: string
  apiUrl: string
  apiKey: string
  companyId: string
  status: string
  expiresAt: Date | null
}

// Returns null both when DATABASE_URL isn't configured (no-DB deployments
// still fall back to env-based single-tenant config, see presoft-api.ts)
// and when no matching client row exists.
export async function getClientByUsername(username: string): Promise<TenantClient | null> {
  const p = getPool()
  if (!p) return null

  const { rows } = await p.query(
    `SELECT id, name, username, password_hash, api_url, api_key, company_id, status, expires_at
     FROM clients WHERE username = $1`,
    [username]
  )
  const row = rows[0]
  if (!row) return null

  return {
    id: row.id,
    name: row.name,
    username: row.username,
    passwordHash: row.password_hash,
    apiUrl: row.api_url,
    apiKey: row.api_key,
    companyId: row.company_id ?? '',
    status: row.status,
    expiresAt: row.expires_at ? new Date(row.expires_at) : null,
  }
}
