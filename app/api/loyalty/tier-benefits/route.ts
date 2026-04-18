import { NextResponse } from 'next/server'
import { getTierBenefits } from '@/lib/loyalty'

// ---------------------------------------------------------------------------
// GET /api/loyalty/tier-benefits  — public endpoint (no auth required)
// Returns the static tier benefits lookup table.
// ---------------------------------------------------------------------------

export async function GET() {
  const benefits = getTierBenefits()

  return NextResponse.json({
    success: true,
    data: benefits,
  })
}
