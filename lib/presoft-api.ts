// Shared server-side config for talking to presoft-api. Deliberately not
// NEXT_PUBLIC_-prefixed — that prefix tells Next.js to inline a value into
// the browser bundle, which would defeat the point of a server-only API
// key. Only server code (Route Handlers) should ever import this.
import 'server-only'

export const PRESOFT_API_URL = process.env.PRESOFT_API_URL ?? 'http://localhost:4000'

export function presoftApiHeaders(extra?: Record<string, string>): Record<string, string> {
  const key = process.env.PRESOFT_API_KEY
  if (!key) {
    throw new Error('PRESOFT_API_KEY is not set')
  }
  return { 'x-api-key': key, ...extra }
}
