// Per-tenant config for talking to a business's presoft-api instance.
// Previously this held one global PRESOFT_API_URL/PRESOFT_API_KEY from env
// (single-tenant); now each business row in the master-admin DB carries its
// own api_url + encrypted api_key, resolved here at request time by
// businessId. Deliberately not NEXT_PUBLIC_-prefixed / server-only — the
// browser never talks to presoft-api directly, only this server does.
import 'server-only'
import { query } from '@/lib/db/master-admin'

export interface TenantApiConfig {
  apiUrl: string
  apiKey: string
}

interface BusinessRow {
  api_url: string | null
  api_key: string | null
}

export async function getTenantApiConfig(businessId: number): Promise<TenantApiConfig | null> {
  const passphrase = process.env.MASTER_ADMIN_ENCRYPTION_PASSPHRASE
  const rows = await query<BusinessRow>(
    `SELECT api_url,
            CASE WHEN api_key IS NULL THEN NULL ELSE pgp_sym_decrypt(api_key, $2) END AS api_key
     FROM business WHERE business_id = $1`,
    [businessId, passphrase]
  )
  const row = rows[0]
  if (!row?.api_url || !row?.api_key) return null
  return { apiUrl: row.api_url, apiKey: row.api_key }
}

export function tenantApiHeaders(apiKey: string, extra?: Record<string, string>): Record<string, string> {
  return { 'x-api-key': apiKey, ...extra }
}
