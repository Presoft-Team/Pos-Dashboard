// Standalone endpoint for the /test page — deliberately NOT routed through
// lib/db/client.ts's rpc() shim (which currently points at presoft-api), so
// this keeps working regardless of which backend the rest of the dashboard
// is wired to. Queries SQL Server directly via lib/mssql.ts.
import { NextRequest, NextResponse } from 'next/server'
import { getCreditPaidIndividual } from '@/lib/db/queries/testQueries'

export async function GET(req: NextRequest) {
  try {
    const search = req.nextUrl.searchParams.get('search')
    const data = await getCreditPaidIndividual(search)
    return NextResponse.json(data)
  } catch (err) {
    console.error('GET /api/test/credit-paid failed:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Query failed' },
      { status: 500 }
    )
  }
}
