// Standalone endpoint for the /test page — same pattern as
// /api/test/credit-paid. Queries SQL Server directly via lib/mssql.ts.
import { NextResponse } from 'next/server'
import { getRevenueJoinIntegrity } from '@/lib/db/queries/testQueries'

export async function GET() {
  try {
    const data = await getRevenueJoinIntegrity()
    return NextResponse.json(data)
  } catch (err) {
    console.error('GET /api/test/join-integrity failed:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Query failed' },
      { status: 500 }
    )
  }
}
